import { Router } from 'express';
import { db, admin } from '../config/firestore.js';
import logger from '../config/logger.js';
const { FieldValue } = admin.firestore;

const router = Router();

/**
 * GET /api/settings/smtp
 * Get SMTP configuration (without password for security)
 */
router.get('/smtp', async (req, res, next) => {
    try {
        const userId = req.user.uid;
        let data = null;

        const userDoc = await db.collection('userSettings').doc(userId).get();
        if (userDoc.exists && userDoc.data().smtp) {
            data = userDoc.data().smtp;
        } else {
            const systemDoc = await db.collection('systemSettings').doc('smtp').get();
            if (systemDoc.exists) {
                data = systemDoc.data();
            }
        }

        if (!data) {
            return res.json({ data: null });
        }
        
        // Omit password from response
        delete data.smtpPassword;
        
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/settings/smtp
 * Update SMTP configuration
 */
router.post('/smtp', async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { senderEmail, smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;
        
        const updateData = {
            senderEmail,
            smtpHost,
            smtpPort: parseInt(smtpPort, 10),
            smtpUser,
            updatedAt: FieldValue.serverTimestamp(),
        };

        // If there's no password provided, try to retain the old one
        if (smtpPassword) {
            updateData.smtpPassword = smtpPassword;
        } else {
            // Fetch existing settings to preserve password
            const userDoc = await db.collection('userSettings').doc(userId).get();
            if (userDoc.exists && userDoc.data().smtp && userDoc.data().smtp.smtpPassword) {
                updateData.smtpPassword = userDoc.data().smtp.smtpPassword;
            } else {
                const systemDoc = await db.collection('systemSettings').doc('smtp').get();
                if (systemDoc.exists && systemDoc.data().smtpPassword) {
                     updateData.smtpPassword = systemDoc.data().smtpPassword;
                }
            }
        }

        const docRef = db.collection('userSettings').doc(userId);
        
        await docRef.set({ smtp: updateData }, { merge: true });

        logger.info('SMTP settings updated for user', { userId });

        res.json({ success: true, message: 'SMTP settings saved successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
