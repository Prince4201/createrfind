import { google } from 'googleapis';
import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════════════
//  Google Sheets Service — Production-grade
//  • Service Account auth (JSON from env or Secret Manager)
//  • Auto-creates header row if sheet is empty
//  • Batch append (30–50 rows in single API call)
//  • 1 automatic retry on transient failures
//  • Structured error classification & logging
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
];

const MAX_ROWS_PER_BATCH = 50;
const RETRY_DELAY_MS = 2000;
const MAX_DESCRIPTION_LENGTH = 500;

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

    // ── Authentication ──────────────────────────────────────

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
            logger.error('Failed to initialize Sheets service', {
                error: error.message,
            });
            this.sheets = null;
        }
    }

    // ── Primary Public API ──────────────────────────────────

    /**
     * Append filtered YouTube channels to the configured Google Sheet.
     * Creates header row if sheet is empty. Caps at 50 rows per call.
     * Retries once on transient API failures.
     *
     * @param {Array<object>} channels — Array of channel objects
     * @returns {Promise<{appended: number}>}
     */
    async appendChannelsToSheet(channels) {
        if (!this.sheets || !this.spreadsheetId) {
            logger.warn('Sheets: service not configured — skipping sync');
            return { appended: 0 };
        }

        if (!Array.isArray(channels) || channels.length === 0) {
            logger.warn('Sheets: no channels provided — nothing to sync');
            return { appended: 0 };
        }

        logger.info(`Sheets: syncing ${channels.length} channels (clear + rewrite)`, {
            spreadsheetId: this.spreadsheetId,
        });

        // Step 1: Ensure header row exists
        await this._ensureHeaders();

        // Step 2: Clear all existing data rows (keep headers in row 1)
        await this._clearDataRows();

        // Step 3: Deduplicate by channelId before writing
        const seen = new Set();
        const uniqueChannels = [];
        for (const ch of channels) {
            const key = ch.channelId || ch.id;
            if (key && !seen.has(key)) {
                seen.add(key);
                uniqueChannels.push(ch);
            }
        }

        // Step 4: Transform channel objects → 2D array
        const rows = uniqueChannels.map((ch) => [
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
        ]);

        // Step 5: Write all rows at once (starting at row 2)
        if (rows.length > 0) {
            await this._writeRows(rows);
        }

        logger.info(`Sheets: successfully synced ${rows.length} unique rows`, {
            spreadsheetId: this.spreadsheetId,
        });

        return { appended: rows.length };
    }

    /**
     * Backward-compatible alias — used by filterEngine.js
     */
    async appendChannels(channels) {
        return this.appendChannelsToSheet(channels);
    }

    // ── Header Row Management ───────────────────────────────

    async _ensureHeaders() {
        try {
            const existing = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A1:J1',
            });

            if (existing.data.values && existing.data.values.length > 0) {
                return; // Headers already present
            }
        } catch (error) {
            // If the sheet doesn't exist or is empty, we'll create headers below
            this._classifyAndLogError(error, 'checking headers');
        }

        // Insert header row
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A1:J1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [HEADER_ROW],
                },
            });
            logger.info('Sheets: header row created');
        } catch (error) {
            this._classifyAndThrow(error, 'creating headers');
        }
    }

    // ── Clear + Write (for dedup sync) ────────────────────────

    /**
     * Clear all data rows (everything below the header row).
     */
    async _clearDataRows() {
        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A2:J',
            });
            logger.info('Sheets: cleared existing data rows');
        } catch (error) {
            this._classifyAndLogError(error, 'clearing data rows');
            // Non-fatal: if clear fails on empty sheet, we can still write
        }
    }

    /**
     * Write rows starting at row 2 (below headers). Uses update instead of
     * append to avoid duplicate rows.
     */
    async _writeRows(rows) {
        const endCol = 'J';
        const endRow = rows.length + 1; // +1 because row 1 is headers
        const range = `Sheet1!A2:${endCol}${endRow}`;

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range,
                valueInputOption: 'RAW',
                requestBody: { values: rows },
            });
        } catch (error) {
            const status = error?.response?.status || error?.code;
            // Retry once on transient errors
            if (status === 429 || (typeof status === 'number' && status >= 500)) {
                logger.warn(`Sheets: transient error (${status}), retrying...`);
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
                try {
                    await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range,
                        valueInputOption: 'RAW',
                        requestBody: { values: rows },
                    });
                    return;
                } catch (retryError) {
                    this._classifyAndThrow(retryError, 'writing rows (retry)');
                }
            }
            this._classifyAndThrow(error, 'writing rows');
        }
    }

    // ── Batch Append with Retry (legacy) ────────────────────

    async _appendWithRetry(rows) {
        const params = {
            spreadsheetId: this.spreadsheetId,
            range: 'Sheet1!A2',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rows },
        };

        try {
            await this.sheets.spreadsheets.values.append(params);
        } catch (error) {
            const status = error?.response?.status || error?.code;

            // Retry once on transient errors (429 rate limit, 5xx server errors)
            if (status === 429 || (typeof status === 'number' && status >= 500)) {
                logger.warn(`Sheets: transient error (${status}), retrying in ${RETRY_DELAY_MS}ms...`, {
                    error: error.message,
                });
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

                try {
                    await this.sheets.spreadsheets.values.append(params);
                    logger.info('Sheets: retry succeeded');
                    return;
                } catch (retryError) {
                    this._classifyAndThrow(retryError, 'appending rows (retry)');
                }
            }

            this._classifyAndThrow(error, 'appending rows');
        }
    }

    // ── Row Count (for status endpoint) ─────────────────────

    /**
     * @returns {Promise<number>} Number of data rows (excluding header)
     */
    async getRowCount() {
        if (!this.sheets || !this.spreadsheetId) return 0;

        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A:A',
            });
            return res.data.values ? Math.max(res.data.values.length - 1, 0) : 0;
        } catch (error) {
            logger.error('Sheets: failed to get row count', { error: error.message });
            return 0;
        }
    }

    // ── Error Classification ────────────────────────────────

    _classifyAndLogError(error, context) {
        const status = error?.response?.status || error?.code;

        if (status === 404) {
            logger.error(`Sheets [${context}]: spreadsheet not found — check GOOGLE_SHEET_ID`, {
                spreadsheetId: this.spreadsheetId,
            });
        } else if (status === 403) {
            logger.error(`Sheets [${context}]: permission denied — ensure service account has Editor access`, {
                spreadsheetId: this.spreadsheetId,
            });
        } else if (status === 429) {
            logger.warn(`Sheets [${context}]: rate limit hit — slow down requests`);
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
                    ? 'Permission denied — service account lacks Editor access to this spreadsheet'
                    : status === 429
                        ? 'Google Sheets API rate limit exceeded — try again later'
                        : `Sheets API error: ${error.message}`
        );
        wrapped.statusCode = status === 429 ? 429 : status || 500;
        throw wrapped;
    }
}

export default SheetsService;
