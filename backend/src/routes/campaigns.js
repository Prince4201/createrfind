import { Router } from 'express';
import { db, admin } from '../config/firestore.js';
const { FieldValue } = admin.firestore;
import logger from '../config/logger.js';
import { validateCampaign, validatePagination } from '../middleware/validator.js';

const router = Router();

/**
 * POST /api/campaigns
 * Create a new email campaign.
 */
router.post('/', validateCampaign, async (req, res, next) => {
    try {
        const campaign = {
            campaignName: req.body.campaignName,
            subject: req.body.subject,
            bodyTemplate: req.body.bodyTemplate,
            totalChannels: 0,
            emailsSent: 0,
            userId: req.user.uid,
            createdAt: FieldValue.serverTimestamp(),
            createdAtISO: new Date().toISOString(),
        };

        const docRef = await db.collection('campaigns').add(campaign);

        // Update analytics
        await db.collection('analytics').doc('global').set(
            { totalCampaigns: FieldValue.increment(1) },
            { merge: true }
        );

        logger.info('Campaign created', { campaignId: docRef.id, userId: req.user.uid });

        res.status(201).json({
            success: true,
            data: { id: docRef.id, ...campaign },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/campaigns
 * List campaigns with pagination.
 */
router.get('/', validatePagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const snapshot = await db
            .collection('campaigns')
            .where('userId', '==', req.user.uid)
            .get();

        const campaigns = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }));

        // Sort in memory (avoids Firestore composite index requirement)
        // Use createdAtISO as fallback when serverTimestamp isn't resolved yet
        campaigns.sort((a, b) => {
            const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAtISO ? new Date(a.createdAtISO).getTime() : 0);
            const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAtISO ? new Date(b.createdAtISO).getTime() : 0);
            return tb - ta;
        });

        // Manual pagination
        const start = (page - 1) * limit;
        const paginated = campaigns.slice(start, start + limit);

        res.json({ data: paginated });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/campaigns/:id
 * Get campaign detail.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const doc = await db.collection('campaigns').doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({ data: { id: doc.id, ...doc.data() } });
    } catch (error) {
        next(error);
    }
});

export default router;
