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
router.get('/', async (req, res, next) => {
    try {
        const { sessionId, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('channels')
            .select('*', { count: 'exact' })
            .eq('fetched_by_user_id', req.user.id);

        // If a specific sessionId is requested, filter by it. Otherwise, show everything.
        if (sessionId) {
            query = query.eq('search_history_id', sessionId);
        }

        // Apply remaining filters
        if (req.query.search) {
            query = query.or(`name.ilike.%${req.query.search}%,niche.ilike.%${req.query.search}%,email.ilike.%${req.query.search}%`);
        }
        if (req.query.minSubscribers) {
            query = query.gte('subscribers', parseInt(req.query.minSubscribers));
        }
        if (req.query.maxSubscribers) {
            query = query.lte('subscribers', parseInt(req.query.maxSubscribers));
        }
        if (req.query.minAvgViews) {
            query = query.gte('avg_views', parseInt(req.query.minAvgViews));
        }
        if (req.query.status) {
            const emailSent = req.query.status === 'Emailed';
            query = query.eq('email_sent', emailSent);
        }
        if (req.query.dateFrom) {
            query = query.gte('last_fetched_at', req.query.dateFrom);
        }
        if (req.query.dateTo) {
            query = query.lte('last_fetched_at', req.query.dateTo);
        }

        const { data: channels, count, error } = await query
            .order('subscribers', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            data: channels,
            pagination: { 
                total: count || 0, 
                totalPages: Math.ceil((count || 0) / limit),
                currentPage: parseInt(page)
            }
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
