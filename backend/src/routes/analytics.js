import { Router } from 'express';
import { db } from '../config/firestore.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * GET /api/analytics
 * Compute real-time dashboard analytics from user's data.
 */
router.get('/', async (req, res, next) => {
    try {
        const uid = req.user.uid;

        // Compute real analytics from collections (parallel queries)
        const [channelsSnap, campaignsSnap, emailLogsSnap, activitySnap] = await Promise.all([
            db.collection('channels').where('createdByUserId', '==', uid).get(),
            db.collection('campaigns').where('userId', '==', uid).get(),
            db.collection('emailLogs').where('userId', '==', uid).get(),
            db.collection('activityLogs').where('userId', '==', uid).get(),
        ]);

        const totalChannels = channelsSnap.size;
        const totalCampaigns = campaignsSnap.size;
        const totalEmailsSent = emailLogsSnap.docs.filter(d => d.data().status === 'Sent').length;

        // Get recent activity (sort in memory to avoid composite index)
        const activity = activitySnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
        }));
        activity.sort((a, b) => {
            const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
            const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
            return tb - ta;
        });

        res.json({
            data: {
                totalChannels,
                totalEmailsSent,
                totalCampaigns,
                lastDiscoveryAt: activity.find(a => a.action === 'discovery')?.timestamp || null,
                recentActivity: activity.slice(0, 30),
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;

