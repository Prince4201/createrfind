import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { triggerLimiter } from '../middleware/rateLimiter.js';
import { validateDiscoverFilters, validatePagination } from '../middleware/validator.js';
import HybridFetchService from '../services/hybridFetchService.js';

const router = Router();

/**
 * POST /api/channels/discover
 * Trigger the hybrid discovery pipeline: DB-first + background YouTube API fetch.
 * Rate-limited to 10 requests per minute.
 */
router.post('/discover', triggerLimiter, validateDiscoverFilters, async (req, res, next) => {
    try {
        const filters = {
            keyword: req.body.keyword,
            maxChannels: Math.min(parseInt(req.body.maxChannels) || 30, 50),
        };

        logger.info('Discovery triggered', { filters, userId: req.user.id });

        // Use hybrid fetch: returns cached results immediately, queues background API fetch if needed
        const result = await HybridFetchService.searchCreators(req.user.id, filters.keyword, {
            requestedCount: filters.maxChannels,
            niche: filters.keyword,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        if (error.statusCode === 429) {
            return res.status(429).json({ error: 'YouTube API quota exceeded. Try again tomorrow.' });
        }
        next(error);
    }
});

/**
 * GET /api/channels/discover/status/:searchHistoryId
 * Poll for background fetch job status.
 */
router.get('/discover/status/:searchHistoryId', async (req, res, next) => {
    try {
        const { searchHistoryId } = req.params;

        const { data, error } = await supabase
            .from('search_history')
            .select('*')
            .eq('id', searchHistoryId)
            .eq('user_id', req.user.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Search not found' });
        }

        // If returned_count is null, it's still polling.
        // If it's >= 0, it's completed. If it's -1, it failed.
        let status = 'polling';
        if (data.returned_count !== null) {
            status = data.returned_count >= 0 ? 'completed' : 'failed';
        }

        // If completed, also return the new channels
        let channels = [];
        if (status === 'completed') {
            const { data: ch } = await supabase
                .from('channels')
                .select('*')
                .eq('niche', data.query)
                .order('subscribers', { ascending: false })
                .limit(data.requested_count || 50);
            channels = ch || [];
        }

        res.json({
            data: {
                status,
                returnedCount: data.returned_count > 0 ? data.returned_count : 0,
                cacheHitCount: data.cache_hit,
                channels,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/channels
 * List channels with pagination and optional filters.
 * Channels are globally shared — all authenticated users can read.
 */
router.get('/', validatePagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('channels')
            .select('*', { count: 'exact' })
            .eq('is_discovered', true);

        // Optional filters
        if (req.query.minSubscribers) {
            query = query.gte('subscribers', parseInt(req.query.minSubscribers));
        }
        if (req.query.maxSubscribers) {
            query = query.lte('subscribers', parseInt(req.query.maxSubscribers));
        }
        if (req.query.minAvgViews) {
            query = query.gte('avg_views', parseInt(req.query.minAvgViews));
        }
        if (req.query.emailSent !== undefined) {
            query = query.eq('email_sent', req.query.emailSent === 'true');
        }
        if (req.query.niche) {
            query = query.eq('niche', req.query.niche);
        }
        if (req.query.search) {
            query = query.ilike('name', `%${req.query.search}%`);
        }

        const { data: channels, count, error } = await query
            .order('subscribers', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            data: channels,
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
 * GET /api/channels/:id
 * Get a single channel by channel_id.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('channel_id', req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        res.json({ data });
    } catch (error) {
        next(error);
    }
});

export default router;
