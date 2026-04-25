import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { validateSendEmails, validatePagination } from '../middleware/validator.js';

const router = Router();

/**
 * POST /api/emails/send
 * Send personalized emails to selected channels for a campaign.
 * Delegates to the email service which reads SMTP config from Supabase.
 */
router.post('/send', validateSendEmails, async (req, res, next) => {
    try {
        const { campaignId, channelIds } = req.body;

        // Verify campaign belongs to user
        const { data: campaign, error: campErr } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .eq('user_id', req.user.id)
            .single();

        if (campErr || !campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Fetch channels by YouTube ID
        const { data: channels, error: chErr } = await supabase
            .from('channels')
            .select('*')
            .in('channel_id', channelIds.slice(0, 50))
            .not('email', 'is', null);

        if (chErr) {
            console.error('[Emails] DB search failed:', chErr.message);
            throw chErr;
        }

        if (!channels || channels.length === 0) {
            return res.status(400).json({ error: 'No valid channels with emails found' });
        }

        // Send emails
        const emailService = req.app.get('emailService');
        const result = await emailService.sendBulk(
            { ...campaign, userId: req.user.id },
            channels
        );

        logger.info('Emails sent', { campaignId, ...result, userId: req.user.id });

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
 * Get email send history for the current user.
 */
router.get('/history', validatePagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { data: history, count, error } = await supabase
            .from('email_logs')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id)
            .order('sent_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('[HistoryFetch] Error:', error.message);
            throw error;
        }

        console.log(`[HistoryFetch] Found ${history?.length || 0} logs for user ${req.user.id}`);

        res.json({
            data: history,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
