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

        // Always ensure user exists in public.users without overwriting roles
        let { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

        if (!profile) {
            // New user - default to 'user'
            const { data: newProfile, error: insertError } = await supabase
                .from('users')
                .insert({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.name || user.email,
                    role: 'user' // Default to user, not admin
                })
                .select()
                .single();
            
            if (insertError) {
                logger.error('Failed to create user in public.users', { error: insertError });
                return res.status(500).json({ error: `Failed to create user profile: ${insertError.message}` });
            }
            profile = newProfile;
        } else {
            // Existing user - update details but preserve existing role
            const { data: updatedProfile, error: updateError } = await supabase
                .from('users')
                .update({
                    email: user.email,
                    name: user.user_metadata?.name || profile.name
                })
                .eq('id', user.id)
                .select()
                .single();
            
            if (updateError) {
                logger.error('Failed to update user in public.users', { error: updateError });
            } else {
                profile = updatedProfile;
            }
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

/**
 * GET /api/auth/profile
 * Get the current user's profile.
 */
router.get('/profile', async (req, res, next) => {
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

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({ user: { ...profile, provider: user.app_metadata?.provider || 'email' } });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/auth/profile
 * Update the current user's name.
 */
router.patch('/profile', async (req, res, next) => {
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

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const { data: profile, error: updateError } = await supabase
            .from('users')
            .update({ name: name.trim() })
            .eq('id', user.id)
            .select()
            .single();

        if (updateError) throw updateError;

        logger.info('Profile updated', { id: user.id, name: name.trim() });
        res.json({ user: profile });
    } catch (error) {
        next(error);
    }
});

export default router;
