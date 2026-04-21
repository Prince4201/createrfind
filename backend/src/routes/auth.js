import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * POST /api/auth/verify
 * Verify Supabase access token and return user profile from public.users.
 * Called by frontend after login/signup to confirm backend connectivity.
 */
router.post('/verify', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Always ensure user exists in public.users (acts as an auto-sync since we don't have SQL triggers)
        // We use the global service_role supabase client which bypasses RLS
        const { data: profile, error: upsertError } = await supabase
            .from('users')
            .upsert({
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || user.email,
                role: 'admin' // Grant admin by default for this single-user demo
            }, { onConflict: 'id' })
            .select()
            .single();

        if (upsertError) {
            logger.error('Failed to sync user to public.users', { error: upsertError });
            return res.status(500).json({ error: 'Failed to sync user profile' });
        }

        if (profile?.status === 'blocked') {
            return res.status(403).json({ error: 'Account is blocked' });
        }

        // Update last login
        await supabase
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

        logger.info('User verified', { id: user.id, email: user.email });

        res.json({ user: profile });
    } catch (error) {
        next(error);
    }
});

export default router;
