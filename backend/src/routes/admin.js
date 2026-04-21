import express from 'express';
import { supabase } from '../config/supabase.js';
import authMiddleware from '../middleware/supabaseAuth.js';

const router = express.Router();

// Middleware to ensure user is an admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

// Apply auth and admin check to all routes
router.use(authMiddleware, requireAdmin);

/**
 * GET /api/admin/stats
 * Fetches global system statistics for the admin dashboard.
 */
router.get('/stats', async (req, res) => {
    try {
        // Run aggregations (Note: in production Supabase, you might want a database view or RPC for complex counts to save bandwidth)
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: channelsCount } = await supabase.from('channels').select('*', { count: 'exact', head: true });
        const { count: campaignsCount } = await supabase.from('campaigns').select('*', { count: 'exact', head: true });
        
        // Sum API units used today
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        
        // Aggregate units_used might require RPC, this is a simplified version
        const { data: apiUsage } = await supabase
            .from('api_usage')
            .select('units_used')
            .gte('created_at', startOfDay.toISOString());
            
        const dailyQuotaUsed = apiUsage ? apiUsage.reduce((acc, curr) => acc + curr.units_used, 0) : 0;

        res.json({
            stats: {
                totalUsers: usersCount || 0,
                totalChannels: channelsCount || 0,
                totalCampaigns: campaignsCount || 0,
                dailyYoutubeApiQuotaUsed: dailyQuotaUsed,
                quotaLimit: 10000
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

export default router;
