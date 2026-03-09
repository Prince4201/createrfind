import { admin } from '../config/firestore.js';
import logger from '../config/logger.js';

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Allow demo token to bypass Firebase verification
    if (idToken === 'demo-token') {
        req.user = {
            uid: 'demo-user-001',
            email: 'demo@creatorfind.app',
            name: 'Demo User',
        };
        return next();
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email,
        };
        next();
    } catch (error) {
        logger.warn('Auth verification failed', { error: error.message });
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export default authMiddleware;
