import { Router } from 'express';
import { db } from '../config/firestore.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * POST /api/sheets/sync
 * Sync the current user's channels into their own tab in the shared Google Sheet.
 * Never touches other users' data.
 */
router.post('/sync', async (req, res, next) => {
    try {
        const sheetsService = req.app.get('sheetsService');

        if (!sheetsService) {
            return res.status(503).json({ error: 'Google Sheets service not configured' });
        }

        const userEmail = req.user.email;
        const userId = req.user.uid;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required for sheet sync' });
        }

        // Fetch user's channels from Firestore
        const snapshot = await db
            .collection('channels')
            .where('createdByUserId', '==', userId)
            .get();

        const allChannels = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            scrapedAt: doc.data().scrapedAt?.toDate?.() || new Date(),
        }));

        // Sort by scrapedAt desc in memory (newest first)
        allChannels.sort((a, b) => {
            const ta = a.scrapedAt instanceof Date ? a.scrapedAt.getTime() : 0;
            const tb = b.scrapedAt instanceof Date ? b.scrapedAt.getTime() : 0;
            return tb - ta;
        });

        if (allChannels.length === 0) {
            return res.json({
                success: true,
                data: { syncedCount: 0, message: 'No channels to sync' },
            });
        }

        // Sync into user's own tab — never clears other users' data
        const result = await sheetsService.syncUserChannels(allChannels, userEmail);

        // Mark channels as synced in Firestore
        const BATCH_LIMIT = 500;
        for (let i = 0; i < allChannels.length; i += BATCH_LIMIT) {
            const batch = db.batch();
            const chunk = allChannels.slice(i, i + BATCH_LIMIT);
            for (const ch of chunk) {
                const docRef = db.collection('channels').doc(ch.id);
                batch.update(docRef, { sheetSynced: true, sheetSyncedAt: new Date() });
            }
            await batch.commit();
        }

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
