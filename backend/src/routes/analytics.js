import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * GET /api/analytics
 * Compute real-time dashboard analytics for the current user.
 */
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Parallel count queries for total stats
        const [channelsRes, campaignsRes, emailsSentRes, searchesRes] = await Promise.all([
            // Total Channels found by user ever
            supabase.from('channels').select('*', { count: 'exact', head: true }).eq('fetched_by_user_id', userId),
            
            // Total campaigns
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            
            // Total emails sent
            supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'sent'),
            
            // Recent search history
            supabase.from('search_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        ]);

        const totalChannels = channelsRes.count || 0;
        const totalCampaigns = campaignsRes.count || 0;
        const totalEmailsSent = emailsSentRes.count || 0;
        const recentSearches = searchesRes.data || [];

        const recentActivity = recentSearches.map(s => ({
            id: s.id,
            action: 'discovery',
            timestamp: s.created_at,
            metadata: {
                query: s.query,
                channelsFound: s.returned_count,
                status: s.refresh_status,
            },
        }));

        res.json({
            data: {
                totalChannels, // Now reflects total discovered creators
                totalEmailsSent,
                totalCampaigns,
                lastDiscoveryAt: recentSearches[0]?.created_at || null,
                recentActivity,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
