import { Router } from 'express';
import { admin, db } from '../config/firestore.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * POST /api/auth/login
 * Verify Firebase ID token, save user profile to Firestore, and return user profile.
 */
router.post('/login', async (req, res, next) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email,
            picture: decodedToken.picture || null,
        };

        // Save/update user profile in Firestore
        try {
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                name: user.name,
                lastLoginAt: new Date(),
            }, { merge: true });
        } catch (err) {
            logger.warn('Failed to save user profile', { error: err.message });
        }

        logger.info('User authenticated', { uid: user.uid, email: user.email });

        res.json({ user });
    } catch (error) {
        next(error);
    }
});

export default router;

