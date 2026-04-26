import { supabase } from '../config/supabase.js';

export default async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error('[AuthError] Supabase rejected token:', error?.message || 'No user found');
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // Fetch role and status from public.users table
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('role, name, status')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
            console.error('[AuthError] Failed to fetch profile from public.users:', profileError.message);
        }

        if (!profile) {
            console.warn(`[AuthError] No profile found in public.users for ID: ${user.id}. Defaulting to 'user' role.`);
        }

        // Attach user info to request
        req.user = {
            id: user.id,
            email: user.email,
            name: profile?.name || user.user_metadata?.name || user.email,
            role: profile?.role || 'user',
            token: token
        };

        console.log(`[AuthSuccess] Authenticated ${user.email} as ${req.user.role}`);
        console.log(`[Backend Debug] Decoded user_id from token: ${user.id}`);

        next();
    } catch (error) {
        console.error('[AuthError] Internal error during authentication:', error.message);
        
        if (error.message.includes('timeout') || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
            return res.status(503).json({ error: 'Authentication service timeout. Please try again.' });
        }
        
        return res.status(500).json({ error: 'Internal Server Error during authentication' });
    }
}
