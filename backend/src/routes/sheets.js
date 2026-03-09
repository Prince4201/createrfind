import { Router } from 'express';
import { db } from '../config/firestore.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * POST /api/sheets/sync
 * Manually sync all channels (or recent channels) to Google Sheet.
 */
router.post('/sync', async (req, res, next) => {
    try {
        const sheetsService = req.app.get('sheetsService');

        if (!sheetsService) {
            return res.status(503).json({ error: 'Google Sheets service not configured' });
        }

        // Fetch user's channels (no orderBy to avoid composite index)
        const snapshot = await db
            .collection('channels')
            .where('createdByUserId', '==', req.user.uid)
            .get();

        const allChannels = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            scrapedAt: doc.data().scrapedAt?.toDate?.() || new Date(),
        }));

        // Sort by scrapedAt desc in memory
        allChannels.sort((a, b) => {
            const ta = a.scrapedAt instanceof Date ? a.scrapedAt.getTime() : 0;
            const tb = b.scrapedAt instanceof Date ? b.scrapedAt.getTime() : 0;
            return tb - ta;
        });

        // Sync ALL channels (clear + rewrite ensures no duplicates)
        if (allChannels.length === 0) {
            return res.json({
                success: true,
                data: { syncedCount: 0, message: 'No channels to sync' },
            });
        }

        await sheetsService.appendChannels(allChannels);

        // Mark them as synced in Firestore
        const BATCH_LIMIT = 500;
        for (let i = 0; i < allChannels.length; i += BATCH_LIMIT) {
            const batch = db.batch();
            const chunk = allChannels.slice(i, i + BATCH_LIMIT);
            for (const ch of chunk) {
                const docRef = db.collection('channels').doc(ch.id);
                batch.update(docRef, { sheetSynced: true });
            }
            await batch.commit();
        }

        logger.info('Sheets sync completed', {
            channelCount: allChannels.length,
            userId: req.user.uid,
        });

        res.json({
            success: true,
            data: { syncedCount: allChannels.length },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/sheets/status
 * Get Google Sheet sync status.
 */
router.get('/status', async (req, res, next) => {
    try {
        const sheetsService = req.app.get('sheetsService');
        const rowCount = sheetsService ? await sheetsService.getRowCount() : 0;

        res.json({
            data: {
                configured: !!sheetsService,
                spreadsheetId: process.env.GOOGLE_SHEET_ID || null,
                rowCount,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
