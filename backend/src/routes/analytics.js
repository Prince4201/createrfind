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
        const [channelsRes, campaignsRes, emailsSentRes, searchesRes, emailLogsRes] = await Promise.all([
            // Total Channels found by user ever
            supabase.from('channels').select('*', { count: 'exact', head: true }).eq('fetched_by_user_id', userId),
            
            // Total campaigns
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            
            // Total emails sent
            supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'sent'),
            
            // Recent search history (last 30 days for chart + activity)
            supabase.from('search_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),

            // Email logs (last 30 days for chart)
            supabase.from('email_logs').select('created_at, status').eq('user_id', userId).eq('status', 'sent').order('created_at', { ascending: false }).limit(200),
        ]);

        const totalChannels = channelsRes.count || 0;
        const totalCampaigns = campaignsRes.count || 0;
        const totalEmailsSent = emailsSentRes.count || 0;
        const recentSearches = searchesRes.data || [];
        const emailLogs = emailLogsRes.data || [];

        // Build recent activity feed (mixed discoveries + emails)
        const recentActivity = recentSearches.slice(0, 10).map(s => ({
            id: s.id,
            action: 'discovery',
            timestamp: s.created_at,
            metadata: {
                query: s.query,
                channelsFound: s.returned_count,
                status: s.refresh_status,
            },
        }));

        // Build discovery chart data — group searches by date (last 7 days)
        const discoveryByDate = {};
        for (const s of recentSearches) {
            const dateKey = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            discoveryByDate[dateKey] = (discoveryByDate[dateKey] || 0) + (s.returned_count || 0);
        }
        const discoveryChartData = Object.entries(discoveryByDate)
            .slice(0, 7)
            .reverse()
            .map(([date, count]) => ({ date, count }));

        // Build emails-sent chart data — group by date (last 14 days)
        const emailsByDate = {};
        for (const e of emailLogs) {
            const dateKey = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            emailsByDate[dateKey] = (emailsByDate[dateKey] || 0) + 1;
        }
        const emailChartData = Object.entries(emailsByDate)
            .slice(0, 14)
            .reverse()
            .map(([date, sent]) => ({ date, sent }));

        res.json({
            data: {
                totalChannels,
                totalEmailsSent,
                totalCampaigns,
                lastDiscoveryAt: recentSearches[0]?.created_at || null,
                recentActivity,
                discoveryChartData,
                emailChartData,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
