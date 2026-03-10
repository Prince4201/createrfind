import { google } from 'googleapis';
import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════════════
//  Google Sheets Service — Single Sheet, Multi-User Upsert
//
//  All users share ONE "Channels" sheet tab.
//  Every row has an "Owner Email" column.
//
//  On sync for User X:
//   1. Read all existing rows from the sheet
//   2. Find rows where Owner Email == User X's email
//   3. Upsert by Channel ID:
//      - Update existing rows for User X in-place
//      - Append brand-new channels at the bottom
//      - NEVER touch rows belonging to other users
// ═══════════════════════════════════════════════════════════

const SHEET_TAB = 'Channels';

const HEADER_ROW = [
    'Channel Name',      // A
    'Channel ID',        // B  ← upsert key
    'Channel URL',       // C
    'Subscribers',       // D
    'Avg Views',         // E
    'Category',          // F
    'Email',             // G
    'Description',       // H
    'Date Scraped',      // I
    'Email Sent',        // J
    'Owner Email',       // K  ← user identifier
];

// 0-based column indices
const COL_CHANNEL_ID = 1;   // B
const COL_OWNER_EMAIL = 10; // K

const MAX_DESCRIPTION_LENGTH = 500;
const RETRY_DELAY_MS = 2000;
const TOTAL_COLS = 11; // A–K

class SheetsService {
    constructor(credentials, spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
        this.sheets = null;
        this._initAuth(credentials);
    }

    // ── Auth ─────────────────────────────────────────────────

    _initAuth(credentials) {
        try {
            if (!credentials) {
                logger.warn('Sheets: no credentials — service disabled');
                return;
            }
            const creds = typeof credentials === 'string'
                ? JSON.parse(credentials) : credentials;

            const auth = new google.auth.GoogleAuth({
                credentials: creds,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            this.sheets = google.sheets({ version: 'v4', auth });
            logger.info('Google Sheets service initialized', {
                spreadsheetId: this.spreadsheetId,
                account: creds.client_email,
            });
        } catch (err) {
            logger.error('Sheets init failed', { error: err.message });
            this.sheets = null;
        }
    }

    // ── Primary API ──────────────────────────────────────────

    /**
     * Sync channels for a specific user.
     * Only touches rows owned by that user — never deletes other users' data.
     *
     * @param {Array<object>} channels
     * @param {string} userEmail
     * @returns {Promise<{synced, added, updated}>}
     */
    async syncUserChannels(channels, userEmail) {
        if (!this.sheets) {
            logger.warn('Sheets: not configured — skipping');
            return { synced: 0, added: 0, updated: 0 };
        }
        if (!channels?.length) {
            logger.warn('Sheets: no channels to sync');
            return { synced: 0, added: 0, updated: 0 };
        }

        const email = (userEmail || 'unknown').toLowerCase().trim();
        logger.info(`Sheets: syncing ${channels.length} channels for ${email}`);

        // 1. Ensure the "Channels" tab + header exist
        await this._ensureTab();

        // 2. Read all existing data rows
        const allRows = await this._readAllRows(); // [[...], [...], ...] — no header

        // 3. Build a map: channelId → { rowIndex (1-based sheet row), ownerEmail }
        //    Row 1 = header, so data starts at sheet row 2 → allRows[0] = sheet row 2
        const channelMap = new Map(); // channelId → sheet row number (1-based)
        for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            const channelId = row[COL_CHANNEL_ID];
            const owner = (row[COL_OWNER_EMAIL] || '').toLowerCase().trim();
            if (channelId && owner === email) {
                channelMap.set(channelId, i + 2); // +2: 1-based + skip header row
            }
        }

        // 4. Classify: update existing vs append new
        const toUpdate = [];
        const toAppend = [];

        for (const ch of channels) {
            const channelId = ch.channelId || ch.id || '';
            const row = this._toRow(ch, email);
            if (channelId && channelMap.has(channelId)) {
                toUpdate.push({ sheetRow: channelMap.get(channelId), row });
            } else {
                toAppend.push(row);
            }
        }

        // 5. Update existing rows in-place
        if (toUpdate.length > 0) {
            await this._batchUpdate(toUpdate);
        }

        // 6. Append new rows
        if (toAppend.length > 0) {
            await this._appendWithRetry(toAppend);
        }

        logger.info('Sheets: sync complete', {
            user: email,
            updated: toUpdate.length,
            added: toAppend.length,
        });

        return {
            synced: toUpdate.length + toAppend.length,
            updated: toUpdate.length,
            added: toAppend.length,
        };
    }

    // ── Backward-compatible aliases ──────────────────────────

    async appendChannels(channels, userEmail = null) {
        if (userEmail) return this.syncUserChannels(channels, userEmail);
        return this.syncUserChannels(channels, 'unknown');
    }

    async appendChannelsToSheet(channels, userEmail = null) {
        return this.appendChannels(channels, userEmail);
    }

    // ── Tab + Header Management ──────────────────────────────

    async _ensureTab() {
        try {
            const meta = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            const tabs = meta.data.sheets.map(s => s.properties.title);

            if (!tabs.includes(SHEET_TAB)) {
                // Create the tab
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    requestBody: {
                        requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
                    },
                });
                logger.info(`Sheets: created tab "${SHEET_TAB}"`);
            }

            // Always ensure header row is correct
            const headerCheck = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${SHEET_TAB}!A1:K1`,
            });

            if (!headerCheck.data.values?.length) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${SHEET_TAB}!A1:K1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [HEADER_ROW] },
                });
                logger.info('Sheets: header row written');
            }
        } catch (err) {
            this._classifyAndThrow(err, 'ensuring tab');
        }
    }

    // ── Read / Write Helpers ─────────────────────────────────

    /** Read all DATA rows (no header). Returns 2D array. */
    async _readAllRows() {
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${SHEET_TAB}!A2:K`,
            });
            return res.data.values || [];
        } catch (err) {
            logger.warn('Sheets: could not read rows', { error: err.message });
            return [];
        }
    }

    /** Batch-update specific rows using a single batchUpdate call. */
    async _batchUpdate(updates) {
        const data = updates.map(({ sheetRow, row }) => ({
            range: `${SHEET_TAB}!A${sheetRow}:K${sheetRow}`,
            values: [row],
        }));

        try {
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    valueInputOption: 'RAW',
                    data,
                },
            });
        } catch (err) {
            logger.error('Sheets: batchUpdate failed', { error: err.message });
            // Non-fatal — still attempt to append new rows
        }
    }

    /** Append rows at the bottom of the Channels tab. Retries once on transient errors. */
    async _appendWithRetry(rows) {
        const params = {
            spreadsheetId: this.spreadsheetId,
            range: `${SHEET_TAB}!A1`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rows },
        };

        try {
            await this.sheets.spreadsheets.values.append(params);
        } catch (err) {
            const status = err?.response?.status || err?.code;
            if (status === 429 || (typeof status === 'number' && status >= 500)) {
                logger.warn(`Sheets: transient error (${status}), retrying...`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                await this.sheets.spreadsheets.values.append(params);
                return;
            }
            this._classifyAndThrow(err, 'appending rows');
        }
    }

    // ── Row Transform ────────────────────────────────────────

    _toRow(ch, ownerEmail) {
        return [
            ch.channelName || '',
            ch.channelId || ch.id || '',
            ch.channelUrl || '',
            ch.subscribers ?? 0,
            ch.avgViews ?? 0,
            ch.category || ch.niche || '',
            ch.email || '',
            (ch.description || '').substring(0, MAX_DESCRIPTION_LENGTH),
            ch.scrapedAt instanceof Date
                ? ch.scrapedAt.toISOString()
                : ch.scrapedAt || new Date().toISOString(),
            ch.emailSent ? 'Sent' : 'Not Sent',
            ownerEmail,
        ];
    }

    // ── Row Count (for status endpoint) ─────────────────────

    async getRowCount(userEmail = null) {
        if (!this.sheets) return 0;
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${SHEET_TAB}!A:A`,
            });
            const allRows = res.data.values || [];
            if (!userEmail) return Math.max(allRows.length - 1, 0);

            // Count only rows belonging to this user
            const rows = await this._readAllRows();
            const email = userEmail.toLowerCase().trim();
            return rows.filter(r =>
                (r[COL_OWNER_EMAIL] || '').toLowerCase().trim() === email
            ).length;
        } catch (err) {
            logger.error('Sheets: getRowCount failed', { error: err.message });
            return 0;
        }
    }

    // ── Error Handling ───────────────────────────────────────

    _classifyAndLogError(err, ctx) {
        const status = err?.response?.status || err?.code;
        if (status === 404) logger.error(`Sheets [${ctx}]: spreadsheet not found`);
        else if (status === 403) logger.error(`Sheets [${ctx}]: permission denied — give service account Editor access`);
        else if (status === 429) logger.warn(`Sheets [${ctx}]: rate limit hit`);
        else logger.error(`Sheets [${ctx}]: ${err.message}`, { status });
    }

    _classifyAndThrow(err, ctx) {
        this._classifyAndLogError(err, ctx);
        const status = err?.response?.status || err?.code;
        const msg =
            status === 404 ? `Invalid spreadsheet ID: ${this.spreadsheetId}` :
            status === 403 ? 'Service account needs Editor access to the spreadsheet' :
            status === 429 ? 'Rate limit exceeded — try again later' :
            `Sheets API error: ${err.message}`;
        const wrapped = new Error(msg);
        wrapped.statusCode = status === 429 ? 429 : status || 500;
        throw wrapped;
    }
}

export default SheetsService;
