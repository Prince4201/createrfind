import { google } from 'googleapis';
import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════════════
//  Google Sheets Service — Per-User Tab Strategy
//
//  Each user gets their own tab named after their email.
//  Syncing only ever touches that user's tab — other users'
//  data is never deleted or overwritten.
//
//  On each sync:
//   1. Ensure user's tab exists (creates if missing)
//   2. Read all existing rows from that tab
//   3. Upsert by Channel ID:
//      - Update existing rows in-place
//      - Append new channels at the bottom
// ═══════════════════════════════════════════════════════════

const HEADER_ROW = [
    'Channel Name',
    'Channel ID',
    'Channel URL',
    'Exact Subscribers',
    'Average Views (Last 30 Videos)',
    'Category / Niche',
    'Email',
    'Channel Description',
    'Date Scraped',
    'Email Sent Status',
    'Synced By',
];

// Column index (0-based) of Channel ID in HEADER_ROW — used for upsert key
const CHANNEL_ID_COL = 1;
const MAX_DESCRIPTION_LENGTH = 500;
const RETRY_DELAY_MS = 2000;

class SheetsService {
    /**
     * @param {string|object} credentials — Service Account JSON (string or parsed object)
     * @param {string} spreadsheetId — Target Google Spreadsheet ID
     */
    constructor(credentials, spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
        this.auth = null;
        this.sheets = null;
        this._initAuth(credentials);
    }

    // ── Authentication ───────────────────────────────────────

    _initAuth(credentials) {
        try {
            if (!credentials) {
                logger.warn('Sheets: no credentials provided — service disabled');
                return;
            }

            const creds =
                typeof credentials === 'string' ? JSON.parse(credentials) : credentials;

            this.auth = new google.auth.GoogleAuth({
                credentials: creds,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            logger.info('Google Sheets service initialized', {
                spreadsheetId: this.spreadsheetId,
                serviceAccount: creds.client_email || 'unknown',
            });
        } catch (error) {
            logger.error('Failed to initialize Sheets service', { error: error.message });
            this.sheets = null;
        }
    }

    // ── Primary Public API ───────────────────────────────────

    /**
     * Sync channels for a specific user into their own tab.
     * Never touches other users' tabs.
     *
     * @param {Array<object>} channels — Array of channel objects
     * @param {string} userEmail — The user's email (used as tab name)
     * @returns {Promise<{synced: number, added: number, updated: number}>}
     */
    async syncUserChannels(channels, userEmail) {
        if (!this.sheets || !this.spreadsheetId) {
            logger.warn('Sheets: service not configured — skipping sync');
            return { synced: 0, added: 0, updated: 0 };
        }

        if (!Array.isArray(channels) || channels.length === 0) {
            logger.warn('Sheets: no channels provided — nothing to sync');
            return { synced: 0, added: 0, updated: 0 };
        }

        // Sanitize email → valid sheet tab name (max 100 chars, no special chars)
        const tabName = this._emailToTabName(userEmail);

        logger.info(`Sheets: syncing ${channels.length} channels for user tab "${tabName}"`);

        // Step 1: Ensure the user's tab exists
        await this._ensureUserTab(tabName);

        // Step 2: Read existing rows from the user's tab
        const existingRows = await this._getUserSheetRows(tabName);

        // Build a map of channelId → row index (1-based, row 1 = header)
        // existingRows[0] = header, existingRows[1] = first data row, etc.
        const channelIdToRowIndex = new Map();
        for (let i = 1; i < existingRows.length; i++) {
            const channelId = existingRows[i]?.[CHANNEL_ID_COL];
            if (channelId) channelIdToRowIndex.set(channelId, i + 1); // +1 for 1-based sheet row
        }

        // Step 3: Build upsert plan
        const rowsToUpdate = []; // { rowIndex, values }
        const rowsToAppend = []; // values[]

        for (const ch of channels) {
            const channelId = ch.channelId || ch.id || '';
            const row = this._channelToRow(ch, userEmail);

            if (channelId && channelIdToRowIndex.has(channelId)) {
                rowsToUpdate.push({ rowIndex: channelIdToRowIndex.get(channelId), values: row });
            } else {
                rowsToAppend.push(row);
            }
        }

        // Step 4: Apply updates (in-place row updates)
        for (const { rowIndex, values } of rowsToUpdate) {
            await this._updateRow(tabName, rowIndex, values);
        }

        // Step 5: Append new rows
        if (rowsToAppend.length > 0) {
            await this._appendRows(tabName, rowsToAppend);
        }

        logger.info(`Sheets: sync complete for "${tabName}"`, {
            updated: rowsToUpdate.length,
            added: rowsToAppend.length,
        });

        return {
            synced: rowsToUpdate.length + rowsToAppend.length,
            updated: rowsToUpdate.length,
            added: rowsToAppend.length,
        };
    }

    /**
     * Backward-compatible alias — used by filterEngine.js auto-sync.
     * Falls back to a generic "Sheet1" tab.
     */
    async appendChannels(channels, userEmail = null) {
        if (userEmail) return this.syncUserChannels(channels, userEmail);
        // Legacy: append to Sheet1 without clearing (safe fallback)
        return this._legacyAppend(channels);
    }

    /**
     * Backward-compatible alias
     */
    async appendChannelsToSheet(channels, userEmail = null) {
        return this.appendChannels(channels, userEmail);
    }

    // ── Tab Management ───────────────────────────────────────

    /**
     * Convert email to a safe sheet tab name.
     * Google Sheets tab names max 100 chars, no [ ] * ? / \
     */
    _emailToTabName(email) {
        return (email || 'unknown')
            .replace(/[\[\]*?/\\]/g, '_')
            .substring(0, 100);
    }

    /**
     * Ensure a tab with the given name exists in the spreadsheet.
     * Creates it if missing, also writes the header row.
     */
    async _ensureUserTab(tabName) {
        try {
            // Get all existing sheets
            const meta = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });

            const existingTabs = meta.data.sheets.map(
                (s) => s.properties.title
            );

            if (existingTabs.includes(tabName)) return; // Already exists

            // Create the tab
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: { title: tabName },
                            },
                        },
                    ],
                },
            });

            logger.info(`Sheets: created tab "${tabName}"`);

            // Write header row to the new tab
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `'${tabName}'!A1`,
                valueInputOption: 'RAW',
                requestBody: { values: [HEADER_ROW] },
            });
        } catch (error) {
            this._classifyAndThrow(error, `ensuring tab "${tabName}"`);
        }
    }

    /**
     * Read all rows (including header) from a user's tab.
     * Returns a 2D array; [0] = header row.
     */
    async _getUserSheetRows(tabName) {
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `'${tabName}'!A:K`,
            });
            return res.data.values || [HEADER_ROW];
        } catch (error) {
            logger.warn(`Sheets: could not read rows from "${tabName}"`, {
                error: error.message,
            });
            return [HEADER_ROW];
        }
    }

    // ── Row Operations ───────────────────────────────────────

    /**
     * Update a specific row (1-based) in the user's tab.
     */
    async _updateRow(tabName, rowIndex, values) {
        const range = `'${tabName}'!A${rowIndex}:K${rowIndex}`;
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range,
                valueInputOption: 'RAW',
                requestBody: { values: [values] },
            });
        } catch (error) {
            logger.error(`Sheets: failed to update row ${rowIndex} in "${tabName}"`, {
                error: error.message,
            });
        }
    }

    /**
     * Append new rows at the bottom of the user's tab.
     */
    async _appendRows(tabName, rows) {
        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `'${tabName}'!A1`,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values: rows },
            });
        } catch (error) {
            const status = error?.response?.status || error?.code;
            if (status === 429 || (typeof status === 'number' && status >= 500)) {
                logger.warn(`Sheets: transient error (${status}), retrying append...`);
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: `'${tabName}'!A1`,
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: { values: rows },
                });
                return;
            }
            this._classifyAndThrow(error, `appending rows to "${tabName}"`);
        }
    }

    /**
     * Transform a channel object into a sheet row array.
     */
    _channelToRow(ch, userEmail = '') {
        return [
            ch.channelName || '',
            ch.channelId || ch.id || '',
            ch.channelUrl || '',
            ch.subscribers != null ? ch.subscribers : 0,
            ch.avgViews != null ? ch.avgViews : 0,
            ch.category || ch.niche || '',
            ch.email || '',
            (ch.description || '').substring(0, MAX_DESCRIPTION_LENGTH),
            ch.scrapedAt instanceof Date
                ? ch.scrapedAt.toISOString()
                : ch.scrapedAt || new Date().toISOString(),
            ch.emailSent ? 'Sent' : 'Not Sent',
            userEmail,
        ];
    }

    // ── Legacy fallback (Sheet1, append-only, no clear) ─────

    async _legacyAppend(channels) {
        if (!this.sheets || !channels?.length) return { synced: 0 };
        await this._ensureHeaders();
        const rows = channels.map((ch) => this._channelToRow(ch));
        await this._appendRows('Sheet1', rows);
        return { synced: rows.length };
    }

    async _ensureHeaders() {
        try {
            const existing = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A1:K1',
            });
            if (existing.data.values?.length > 0) return;
        } catch (_) { /* empty sheet */ }

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: 'Sheet1!A1:K1',
            valueInputOption: 'RAW',
            requestBody: { values: [HEADER_ROW] },
        });
    }

    // ── Row Count (for status endpoint) ─────────────────────

    /**
     * @param {string} [userEmail] — if provided, count only that user's tab
     * @returns {Promise<number>}
     */
    async getRowCount(userEmail = null) {
        if (!this.sheets || !this.spreadsheetId) return 0;
        const tab = userEmail ? this._emailToTabName(userEmail) : 'Sheet1';
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `'${tab}'!A:A`,
            });
            return res.data.values ? Math.max(res.data.values.length - 1, 0) : 0;
        } catch (error) {
            logger.error('Sheets: failed to get row count', { error: error.message });
            return 0;
        }
    }

    // ── Error Classification ─────────────────────────────────

    _classifyAndLogError(error, context) {
        const status = error?.response?.status || error?.code;
        if (status === 404) {
            logger.error(`Sheets [${context}]: spreadsheet not found — check GOOGLE_SHEET_ID`);
        } else if (status === 403) {
            logger.error(`Sheets [${context}]: permission denied — service account needs Editor access`);
        } else if (status === 429) {
            logger.warn(`Sheets [${context}]: rate limit hit`);
        } else {
            logger.error(`Sheets [${context}]: ${error.message}`, { status });
        }
    }

    _classifyAndThrow(error, context) {
        this._classifyAndLogError(error, context);
        const status = error?.response?.status || error?.code;
        const wrapped = new Error(
            status === 404
                ? `Invalid spreadsheet ID: ${this.spreadsheetId}`
                : status === 403
                    ? 'Permission denied — service account lacks Editor access'
                    : status === 429
                        ? 'Google Sheets API rate limit exceeded — try again later'
                        : `Sheets API error: ${error.message}`
        );
        wrapped.statusCode = status === 429 ? 429 : status || 500;
        throw wrapped;
    }
}

export default SheetsService;
