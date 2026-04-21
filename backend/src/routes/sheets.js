import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * POST /api/sheets/sync
 * Sync the current user's channels into their own tab in the shared Google Sheet.
 */
router.post('/sync', async (req, res, next) => {
    try {
        const sheetsService = req.app.get('sheetsService');

        if (!sheetsService) {
            return res.status(503).json({ error: 'Google Sheets service not configured' });
        }

        const userEmail = req.user.email;
        const userId = req.user.id;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required for sheet sync' });
        }

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
 * Get sync status scoped to the current user's tab.
 */
router.get('/status', async (req, res, next) => {
    try {
        const sheetsService = req.app.get('sheetsService');
        const rowCount = sheetsService
            ? await sheetsService.getRowCount(req.user.email)
            : 0;

        res.json({
            data: {
                configured: !!sheetsService,
                spreadsheetId: process.env.GOOGLE_SHEET_ID || null,
                userTab: req.user.email || null,
                rowCount,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
