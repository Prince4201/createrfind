import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import SheetsService from '../services/sheetsService.js';

const router = Router();

// Middleware to enforce admin role
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin role required for Google Sheet Sync.' });
    }
    next();
};

router.use(requireAdmin);

/**
 * Helper to get the user's active sheet settings
 */
const getUserSheetSettings = async (userId) => {
    const { data, error } = await supabase
        .from('sheet_settings')
        .select('spreadsheet_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
        
    if (error) {
        logger.error('Error fetching sheet settings', { error: error.message });
    }
    return data;
};

/**
 * POST /api/sheets/settings
 * Save or update the current user's Google Sheet ID.
 */
router.post('/settings', async (req, res, next) => {
    try {
        const { spreadsheetId } = req.body;
        if (!spreadsheetId) {
            return res.status(400).json({ error: 'Spreadsheet ID is required' });
        }

        const { data, error } = await supabase
            .from('sheet_settings')
            .upsert({ 
                user_id: req.user.id, 
                spreadsheet_id: spreadsheetId,
                is_active: true
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/sheets/sync
 * Sync the current user's channels into their own Google Sheet.
 */
router.post('/sync', async (req, res, next) => {
    try {
        const credentials = req.app.get('sheetsCredentials');
        if (!credentials) {
            return res.status(503).json({ error: 'Google Sheets service credentials not configured on backend' });
        }

        const settings = await getUserSheetSettings(req.user.id);
        if (!settings || !settings.spreadsheet_id) {
            return res.status(400).json({ error: 'No Google Sheet configured for this account' });
        }

        const sheetsService = new SheetsService(credentials, settings.spreadsheet_id);

        const userEmail = req.user.email;
        const userId = req.user.id;

        // Fetch user's channels from Supabase
        const { data: allChannels, error } = await supabase
            .from('channels')
            .select('*')
            .eq('fetched_by_user_id', userId)
            .order('last_fetched_at', { ascending: false });

        if (error) throw error;

        if (!allChannels || allChannels.length === 0) {
            return res.json({
                success: true,
                data: { syncedCount: 0, message: 'No channels to sync' },
            });
        }

        // Map Supabase columns to the format sheetsService expects
        const mapped = allChannels.map(ch => ({
            channelId: ch.channel_id,
            channelName: ch.name,
            channelUrl: ch.channel_url,
            subscribers: ch.subscribers,
            avgViews: ch.avg_views,
            email: ch.email,
            description: ch.description,
            category: ch.category,
            scrapedAt: ch.last_fetched_at ? new Date(ch.last_fetched_at) : new Date(),
        }));

        // Sync into user's own tab
        const result = await sheetsService.syncUserChannels(mapped, userEmail);

        logger.info('Sheets sync completed', { userId, userEmail, ...result });

        res.json({
            success: true,
            data: {
                syncedCount: result.synced,
                added: result.added,
                updated: result.updated,
                userTab: userEmail,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/sheets/status
 * Get sync status scoped to the current user's sheet.
 */
router.get('/status', async (req, res, next) => {
    try {
        const credentials = req.app.get('sheetsCredentials');
        const settings = await getUserSheetSettings(req.user.id);
        
        let rowCount = 0;
        let isConfigured = false;
        
        if (credentials && settings && settings.spreadsheet_id) {
            isConfigured = true;
            try {
                const sheetsService = new SheetsService(credentials, settings.spreadsheet_id);
                rowCount = await sheetsService.getRowCount(req.user.email);
            } catch (err) {
                logger.error('Failed to get row count for user sheet', { error: err.message });
            }
        }

        let serviceAccountEmail = null;
        if (credentials) {
            try {
                const parsed = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
                serviceAccountEmail = parsed.client_email;
            } catch (e) {
                // Ignore parse errors
            }
        }

        res.json({
            data: {
                configured: isConfigured,
                spreadsheetId: settings?.spreadsheet_id || null,
                userTab: req.user.email || null,
                rowCount,
                serviceAccountEmail
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
