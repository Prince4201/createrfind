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
        const doc = await db.collection('systemSettings').doc('smtp').get();
        if (!doc.exists) {
            return res.json({ data: null });
        }
        
        const data = doc.data();
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
        const { senderEmail, smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;
        
        const updateData = {
            senderEmail,
            smtpHost,
            smtpPort: parseInt(smtpPort, 10),
            smtpUser,
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Only update password if provided
        if (smtpPassword) {
            updateData.smtpPassword = smtpPassword;
        }

        const docRef = db.collection('systemSettings').doc('smtp');
        
        // Use set with merge to create if not exists
        await docRef.set(updateData, { merge: true });
        
        // If this is the first creation, set createdAt
        const doc = await docRef.get();
        if (!doc.data().createdAt) {
            await docRef.update({ createdAt: FieldValue.serverTimestamp() });
        }

        logger.info('SMTP settings updated', { userId: req.user.uid });

        // Reload the email service if it exists (we'll implement loadSMTPSettings later)
        const emailService = req.app.get('emailService');
        if (emailService && typeof emailService.loadSMTPSettings === 'function') {
            await emailService.loadSMTPSettings();
        }

        res.json({ success: true, message: 'SMTP settings saved successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
