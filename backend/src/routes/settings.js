import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import crypto from 'crypto';
import logger from '../config/logger.js';

const router = Router();

// Simple encryption for SMTP passwords at rest
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || 'default-32-char-encryption-key!!'; // Must be 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}

/**
 * GET /api/settings/smtp
 * Get SMTP configuration (without password for security).
 */
router.get('/smtp', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('email_settings')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // No settings found
            return res.json({ data: null });
        }
        if (error) throw error;

        // Omit encrypted password from response
        const { smtp_password_encrypted, ...safe } = data;

        res.json({
            data: {
                ...safe,
                hasPassword: !!smtp_password_encrypted,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/settings/smtp
 * Create or update SMTP configuration. Encrypts password before storing.
 */
router.post('/smtp', async (req, res, next) => {
    try {
        const { senderEmail, smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;

        if (!senderEmail || !smtpHost || !smtpPort || !smtpUser) {
            return res.status(400).json({ error: 'All SMTP fields are required' });
        }

        const upsertData = {
            user_id: req.user.id,
            sender_email: senderEmail,
            smtp_host: smtpHost,
            smtp_port: parseInt(smtpPort, 10),
            smtp_user: smtpUser,
        };

        // Encrypt password if provided
        if (smtpPassword) {
            upsertData.smtp_password_encrypted = encrypt(smtpPassword);
        } else {
            // Retain existing password
            const { data: existing } = await supabase
                .from('email_settings')
                .select('smtp_password_encrypted')
                .eq('user_id', req.user.id)
                .single();

            if (existing?.smtp_password_encrypted) {
                upsertData.smtp_password_encrypted = existing.smtp_password_encrypted;
            } else {
                return res.status(400).json({ error: 'SMTP password is required for first-time setup' });
            }
        }

        const { data, error } = await supabase
            .from('email_settings')
            .upsert(upsertData, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        logger.info('SMTP settings updated', { userId: req.user.id });

        res.json({ success: true, message: 'SMTP settings saved successfully' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/settings/smtp/test
 * Test SMTP connection with current settings.
 */
router.post('/smtp/test', async (req, res, next) => {
    try {
        const { data: settings, error } = await supabase
            .from('email_settings')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (error || !settings) {
            return res.status(404).json({ error: 'No SMTP settings found. Please save settings first.' });
        }

        // Decrypt password for test
        const nodemailer = (await import('nodemailer')).default;
        const decryptedPassword = decrypt(settings.smtp_password_encrypted);

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port,
            secure: settings.smtp_port === 465,
            auth: {
                user: settings.smtp_user,
                pass: decryptedPassword,
            },
        });

        await transporter.verify();

        res.json({ success: true, message: 'SMTP connection successful!' });
    } catch (error) {
        logger.warn('SMTP test failed', { error: error.message, userId: req.user.id });
        res.status(400).json({
            success: false,
            error: `SMTP connection failed: ${error.message}`,
        });
    }
});

// Export decrypt for use by emailService
export { decrypt };
export default router;
