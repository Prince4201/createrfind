import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { validateSendEmails, validatePagination } from '../middleware/validator.js';

const router = Router();

/**
 * POST /api/emails/send
 * Send personalized emails to selected channels for a campaign.
 * Returns immediately and processes emails in the background to avoid
 * Render's 30-second request timeout on free tier.
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

        // ---- Respond immediately ----
        res.json({
            success: true,
            data: {
                status: 'processing',
                message: `Sending emails to ${channels.length} channel(s). Check history for results.`,
                total: channels.length,
            },
        });

        // ---- Process emails in the background (after response is sent) ----
        const emailService = req.app.get('emailService');
        try {
            const result = await emailService.sendBulk(
                { ...campaign, userId: req.user.id },
                channels
            );
            logger.info('Background email send completed', { campaignId, ...result, userId: req.user.id });
        } catch (bgError) {
            logger.error('Background email send failed', {
                campaignId,
                error: bgError.message,
                userId: req.user.id,
            });
            
            // Log failure to DB so user sees it in history
            const failLogs = channels.map(ch => ({
                campaign_id: campaignId,
                channel_id: ch.channel_id,
                user_id: req.user.id,
                to_email: ch.email,
                subject: campaign.subject,
                status: 'failed',
                error_message: bgError.message,
                sent_at: new Date().toISOString()
            }));
            
            await supabase.from('email_logs').insert(failLogs).catch(err => 
                console.error('[Fallback DB Error] Failed to log background error:', err)
            );
        }
    } catch (error) {
        // Only reaches here if the pre-send validation/DB lookups fail
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
            .select('*, campaigns(campaign_name)', { count: 'exact' })
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
