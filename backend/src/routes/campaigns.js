import { Router } from 'express';
import { supabase, createAuthClient } from '../config/supabase.js';
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
            user_id: req.user.id,
            campaign_name: req.body.campaignName,
            subject: req.body.subject,
            body_template: req.body.bodyTemplate,
            status: 'draft',
        };

        const userSupabase = createAuthClient(req.user.token);
        const { data, error } = await userSupabase
            .from('campaigns')
            .insert(campaign)
            .select()
            .single();

        if (error) throw error;

        logger.info('Campaign created', { campaignId: data.id, userId: req.user.id });

        res.status(201).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/campaigns
 * List user's campaigns with pagination.
 */
router.get('/', validatePagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const userSupabase = createAuthClient(req.user.token);
        const { data: campaigns, count, error } = await userSupabase
            .from('campaigns')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            data: campaigns,
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

/**
 * GET /api/campaigns/:id
 * Get campaign detail.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const userSupabase = createAuthClient(req.user.token);
        const { data, error } = await userSupabase
            .from('campaigns')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({ data });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/campaigns/:id
 * Update campaign status.
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const { status } = req.body;
        const allowed = ['draft', 'running', 'completed', 'paused'];
        if (status && !allowed.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
        }

        const userSupabase = createAuthClient(req.user.token);
        const { data, error } = await userSupabase
            .from('campaigns')
            .update({ status })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({ data });
    } catch (error) {
        next(error);
    }
});

export default router;
