import { Router } from 'express';
import { db } from '../config/firestore.js';
import logger from '../config/logger.js';
import { validateSendEmails, validatePagination } from '../middleware/validator.js';

const router = Router();

/**
 * POST /api/emails/send
 * Send personalized emails to selected channels for a campaign.
 */
router.post('/send', validateSendEmails, async (req, res, next) => {
    try {
        const { campaignId, channelIds } = req.body;

        // Fetch campaign
        const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const campaign = { id: campaignDoc.id, ...campaignDoc.data(), userId: req.user.uid };

        // Fetch channels
        const channels = [];
        for (const channelId of channelIds.slice(0, 50)) {
            const doc = await db.collection('channels').doc(channelId).get();
            if (doc.exists && doc.data().email) {
                channels.push({ id: doc.id, ...doc.data() });
            }
        }

        if (channels.length === 0) {
            return res.status(400).json({ error: 'No valid channels with emails found' });
        }

        // Send emails
        const emailService = req.app.get('emailService');
        const result = await emailService.sendBulk(campaign, channels);

        logger.info('Emails sent', { campaignId, ...result, userId: req.user.uid });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/emails/history
 * Get email send history from activity logs.
 */
router.get('/history', validatePagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // Simple query — no orderBy to avoid composite index requirements
        const snapshot = await db
            .collection('emailLogs')
            .where('userId', '==', req.user.uid)
            .get();

        const history = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            sentAt: doc.data().sentAt?.toDate?.() || doc.data().sentAt,
        }));

        // Sort in memory
        history.sort((a, b) => {
            const ta = a.sentAt instanceof Date ? a.sentAt.getTime() : 0;
            const tb = b.sentAt instanceof Date ? b.sentAt.getTime() : 0;
            return tb - ta;
        });

        // Manual pagination
        const start = (page - 1) * limit;
        const paginated = history.slice(start, start + limit);

        res.json({ data: paginated });
    } catch (error) {
        next(error);
    }
});

export default router;
