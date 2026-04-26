import express from 'express';
import { supabase } from '../config/supabase.js';
import authMiddleware from '../middleware/supabaseAuth.js';

const router = express.Router();

// Middleware to ensure user is an admin
const requireAdmin = (req, res, next) => {
    // Emergency bypass for specific admin email
    if (req.user.email === 'admin@createrfind.in') {
        req.user.role = 'admin';
    }

    console.log(`[AdminCheck] User ${req.user.email} has role: ${req.user.role}`);
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

/**
 * GET /api/admin/users
 * Lists all users with their channel and campaign counts.
 */
router.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                id, email, name, role, created_at,
                channels:channels(count),
                campaigns:campaigns(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Flatten counts for the frontend
        const formattedUsers = users.map(u => ({
            ...u,
            channelCount: u.channels?.[0]?.count || 0,
            campaignCount: u.campaigns?.[0]?.count || 0
        }));

        res.json({ users: formattedUsers });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Permanently deletes a user from public.users and auth.users.
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        // 1. Delete from Supabase Auth (Service Role required)
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError) throw authError;

        // 2. Delete from public.users (Cascades to channels/campaigns)
        const { error: dbError } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
        
        if (dbError) throw dbError;

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('[Admin] Delete failed:', error.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * PATCH /api/admin/users/:id/role
 * Updates a user's role
 */
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot change your own role' });
        }

        const { error } = await supabase.from('users').update({ role }).eq('id', id);
        if (error) throw error;

        res.json({ message: 'Role updated successfully', role });
    } catch (error) {
        console.error('[Admin] Role update failed:', error.message);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

export default router;
