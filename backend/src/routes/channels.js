import { Router } from 'express';
import { db } from '../config/firestore.js';
import logger from '../config/logger.js';
import { triggerLimiter } from '../middleware/rateLimiter.js';
import { validateDiscoverFilters, validatePagination } from '../middleware/validator.js';

const router = Router();

/**
 * POST /api/channels/discover
 * Trigger the YouTube discovery pipeline.
 * Rate-limited to 10 requests per minute.
 */
router.post('/discover', triggerLimiter, validateDiscoverFilters, async (req, res, next) => {
    try {
        const filters = {
            keyword: req.body.keyword,
            minSubscribers: parseInt(req.body.minSubscribers),
            maxSubscribers: parseInt(req.body.maxSubscribers),
            minAvgViews: parseInt(req.body.minAvgViews),
            maxChannels: Math.min(parseInt(req.body.maxChannels), 50),
        };

        logger.info('Discovery triggered', { filters, userId: req.user.uid });

        // Access the filter engine from app context
        const filterEngine = req.app.get('filterEngine');
        const result = await filterEngine.discover(filters, req.user.uid);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/channels
 * List channels with pagination and optional filters.
 */
router.get('/', validatePagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // Simple query — no orderBy to avoid composite index requirements
        const snapshot = await db
            .collection('channels')
            .where('createdByUserId', '==', req.user.uid)
            .get();

        let channels = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            scrapedAt: doc.data().scrapedAt?.toDate?.() || doc.data().scrapedAt,
            emailSentDate: doc.data().emailSentDate?.toDate?.() || doc.data().emailSentDate,
        }));

        // Apply filters in memory
        if (req.query.emailSent !== undefined) {
            const emailSentFilter = req.query.emailSent === 'true';
            channels = channels.filter((ch) => ch.emailSent === emailSentFilter);
        }

        if (req.query.minSubscribers) {
            const minSubs = parseInt(req.query.minSubscribers);
            channels = channels.filter((ch) => (ch.subscribers || 0) >= minSubs);
        }

        // Sort by scrapedAt descending in memory
        channels.sort((a, b) => {
            const ta = a.scrapedAt instanceof Date ? a.scrapedAt.getTime() : 0;
            const tb = b.scrapedAt instanceof Date ? b.scrapedAt.getTime() : 0;
            return tb - ta;
        });

        const total = channels.length;

        // Manual pagination
        const start = (page - 1) * limit;
        const paginated = channels.slice(start, start + limit);

        res.json({
            data: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/channels/:id
 * Get a single channel by ID.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const doc = await db.collection('channels').doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        res.json({ data: { id: doc.id, ...doc.data() } });
    } catch (error) {
        next(error);
    }
});

export default router;
