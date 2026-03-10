import { google } from 'googleapis';
import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════════════
//  Google Sheets Service — Sheet1, Multi-User Safe Upsert
//
//  Uses Sheet1 (the default existing tab).
//  All users share one sheet. Each row has an "Owner Email"
//  column (K). On sync:
//
//   1. Ensure header has "Owner Email" in column K
//   2. Read all rows from Sheet1
//   3. For THIS user only (matched by Owner Email):
//      - If Channel ID already exists → update that row
//      - If new channel → append at bottom
//   4. Never touch rows belonging to other users
// ═══════════════════════════════════════════════════════════

const SHEET_TAB = 'Sheet1';

const HEADER_ROW = [
    'Channel Name',       // A col 0
    'Channel ID',         // B col 1  ← upsert key
    'Channel URL',        // C col 2
    'Subscribers',        // D col 3
    'Avg Views',          // E col 4
    'Category',           // F col 5
    'Email',              // G col 6
    'Description',        // H col 7
    'Date Scraped',       // I col 8
    'Email Sent',         // J col 9
    'Owner Email',        // K col 10 ← user identifier
];

const COL_CHANNEL_ID  = 1;   // B
const COL_OWNER_EMAIL = 10;  // K
const MAX_DESC_LEN    = 500;
const RETRY_DELAY_MS  = 2000;

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
            logger.info('Sheets: initialized', {
                spreadsheetId: this.spreadsheetId,
                account: creds.client_email,
            });
        } catch (err) {
            logger.error('Sheets: init failed', { error: err.message });
            this.sheets = null;
        }
    }

    // ── Primary API ──────────────────────────────────────────

    /**
     * Sync channels for a specific user into Sheet1.
     * Only updates/appends rows owned by this user.
     * Never modifies other users' rows.
     */
    async syncUserChannels(channels, userEmail) {
        if (!this.sheets) {
            logger.warn('Sheets: not configured');
            return { synced: 0, added: 0, updated: 0 };
        }
        if (!channels?.length) {
            logger.warn('Sheets: no channels to sync');
            return { synced: 0, added: 0, updated: 0 };
        }

        const email = (userEmail || 'unknown').toLowerCase().trim();
        logger.info(`Sheets: starting sync for ${email}, ${channels.length} channels`);

        // 1. Ensure header row has all columns including Owner Email
        await this._ensureHeader();

        // 2. Read ALL existing data rows (row 2 onwards)
        const allRows = await this._readAllDataRows();
        // allRows[i] maps to sheet row (i + 2)  [row 1 = header]

        // 3. Build map of channelId → sheetRowNumber for THIS user's rows only
        const userChannelRowMap = new Map(); // channelId → 1-based sheet row
        for (let i = 0; i < allRows.length; i++) {
            const row        = allRows[i];
            const channelId  = (row[COL_CHANNEL_ID]  || '').trim();
            const rowOwner   = (row[COL_OWNER_EMAIL] || '').toLowerCase().trim();
            const sheetRow   = i + 2; // +2 because row 1 = header

            if (channelId && rowOwner === email) {
                userChannelRowMap.set(channelId, sheetRow);
            }
        }

        logger.info(`Sheets: found ${userChannelRowMap.size} existing rows for ${email}`);

        // 4. Classify channels into updates vs appends
        const toUpdate = []; // { sheetRow, row }
        const toAppend = []; // row arrays

        for (const ch of channels) {
            const channelId = (ch.channelId || ch.id || '').trim();
            const row = this._toRow(ch, email);

            if (channelId && userChannelRowMap.has(channelId)) {
                toUpdate.push({ sheetRow: userChannelRowMap.get(channelId), row });
            } else {
                toAppend.push(row);
            }
        }

        logger.info(`Sheets: ${toUpdate.length} to update, ${toAppend.length} to append`);

        // 5. Batch-update existing rows for this user
        if (toUpdate.length > 0) {
            await this._batchUpdate(toUpdate);
        }

        // 6. Append new rows at the bottom
        if (toAppend.length > 0) {
            await this._appendWithRetry(toAppend);
        }

        logger.info(`Sheets: sync complete for ${email}`, {
            updated: toUpdate.length,
            added: toAppend.length,
        });

        return {
            synced:  toUpdate.length + toAppend.length,
            updated: toUpdate.length,
            added:   toAppend.length,
        };
    }

    // ── Backward-compatible aliases ──────────────────────────

    async appendChannels(channels, userEmail = null) {
        return this.syncUserChannels(channels, userEmail || 'unknown');
    }

    async appendChannelsToSheet(channels, userEmail = null) {
        return this.appendChannels(channels, userEmail);
    }

    // ── Header Management ────────────────────────────────────

    /**
     * Ensure Sheet1 exists and has the correct header row.
     * Migrates old headers (≤10 cols) to include Owner Email in col K.
     */
    async _ensureHeader() {
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${SHEET_TAB}!A1:K1`,
            });

            const currentHeader = res.data.values?.[0] || [];

            // If header is missing or doesn't have Owner Email yet → write full header
            if (!currentHeader.length || !currentHeader[COL_OWNER_EMAIL]) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${SHEET_TAB}!A1:K1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [HEADER_ROW] },
                });
                logger.info('Sheets: header row written/updated');
            }
        } catch (err) {
            this._classifyAndThrow(err, 'ensuring header');
        }
    }

    // ── Read / Write Helpers ─────────────────────────────────

    /** Read all data rows from Sheet1 (skipping header row 1). */
    async _readAllDataRows() {
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

    /** Update specific rows using a single batchUpdate API call. */
    async _batchUpdate(updates) {
        const data = updates.map(({ sheetRow, row }) => ({
            range: `${SHEET_TAB}!A${sheetRow}:K${sheetRow}`,
            values: [row],
        }));

        try {
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: { valueInputOption: 'RAW', data },
            });
        } catch (err) {
            logger.error('Sheets: batchUpdate failed', { error: err.message });
        }
    }

    /** Append rows at the bottom. Retries once on transient errors. */
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
            (ch.description || '').substring(0, MAX_DESC_LEN),
            ch.scrapedAt instanceof Date
                ? ch.scrapedAt.toISOString()
                : ch.scrapedAt || new Date().toISOString(),
            ch.emailSent ? 'Sent' : 'Not Sent',
            ownerEmail,
        ];
    }

    // ── Row Count ────────────────────────────────────────────

    /**
     * Count rows for a specific user (or all rows if no email given).
     */
    async getRowCount(userEmail = null) {
        if (!this.sheets) return 0;
        try {
            if (!userEmail) {
                const res = await this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: `${SHEET_TAB}!A:A`,
                });
                return Math.max((res.data.values?.length || 1) - 1, 0);
            }

            const rows  = await this._readAllDataRows();
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
        const s = err?.response?.status || err?.code;
        if (s === 404) logger.error(`Sheets [${ctx}]: spreadsheet not found — check GOOGLE_SHEET_ID`);
        else if (s === 403) logger.error(`Sheets [${ctx}]: permission denied — give service account Editor access`);
        else if (s === 429) logger.warn(`Sheets [${ctx}]: rate limit hit`);
        else logger.error(`Sheets [${ctx}]: ${err.message}`, { status: s });
    }

    _classifyAndThrow(err, ctx) {
        this._classifyAndLogError(err, ctx);
        const s = err?.response?.status || err?.code;
        const msg =
            s === 404 ? `Invalid spreadsheet ID: ${this.spreadsheetId}` :
            s === 403 ? 'Service account needs Editor access to the spreadsheet' :
            s === 429 ? 'Rate limit exceeded — try again later' :
            `Sheets API error: ${err.message}`;
        const wrapped = new Error(msg);
        wrapped.statusCode = s === 429 ? 429 : s || 500;
        throw wrapped;
    }
}

export default SheetsService;
