import nodemailer from 'nodemailer';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

// Encryption helpers (must match settings.js)
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
const IV_LENGTH = 16;

function decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}

class EmailService {
    constructor() {}

    /**
     * Load SMTP configuration from email_settings table.
     */
    async getSMTPSettings(userId) {
        try {
            const { data, error } = await supabase
                .from('email_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                logger.warn('No SMTP settings found', { userId });
                return null;
            }

            return {
                senderEmail: data.sender_email,
                smtpHost: data.smtp_host,
                smtpPort: data.smtp_port,
                smtpUser: data.smtp_user,
                smtpPassword: decrypt(data.smtp_password_encrypted),
            };
        } catch (error) {
            logger.error('Failed to load SMTP settings', { error: error.message });
            return null;
        }
    }

    /**
     * Use Nodemailer to create an SMTP transporter.
     */
    _createTransporter(settings) {
        if (!settings || !settings.smtpHost) return null;

        return nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpPort === 465,
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPassword,
            },
        });
    }

    /**
     * Send personalized emails to selected channels for a campaign.
     * Skips channels already emailed in this campaign (unique constraint).
     *
     * @param {Object} campaign - campaign row from Supabase
     * @param {Array}  channels - channel rows from Supabase
     * @returns {{ sent: number, failed: number, skipped: number }}
     */
    async sendBulk(campaign, channels) {
        const settings = await this.getSMTPSettings(campaign.userId || campaign.user_id);
        if (!settings) {
            throw new Error('SMTP settings are not configured. Please set them in Email Settings.');
        }

        const transporter = this._createTransporter(settings);
        if (!transporter) {
            throw new Error('Invalid SMTP configuration. Please check your Email Settings.');
        }

        const campaignId = campaign.id;
        const userId = campaign.userId || campaign.user_id;
        let sent = 0;
        let failed = 0;
        let skipped = 0;

        logger.info(`Starting campaign email send to ${channels.length} channels`, { campaignId });

        for (const channel of channels) {
            try {
                const toEmail = channel.email;
                if (!toEmail) {
                    skipped++;
                    continue;
                }

                const personalizedSubject = this._personalize(campaign.subject, channel);
                const personalizedBody = this._personalize(campaign.body_template, channel);

                await transporter.sendMail({
                    from: `"${settings.senderEmail}" <${settings.senderEmail}>`,
                    to: toEmail,
                    subject: personalizedSubject,
                    html: personalizedBody,
                });

                // Log to email_logs (Simplified to find root cause)
                const logData = {
                    campaign_id: campaignId,
                    channel_id: channel.channel_id,
                    user_id: userId,
                    to_email: toEmail,
                    subject: personalizedSubject,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                };

                const { error: logError } = await supabase
                    .from('email_logs')
                    .insert(logData);

                if (logError) {
                    console.error('[CRITICAL_DEBUG] Failed to log successful email:', {
                        error: logError.message,
                        code: logError.code,
                        dataAttempted: logData
                    });
                }

                // Update campaign counters
                await supabase
                    .from('campaigns')
                    .update({ total_sent: (campaign.total_sent || 0) + sent + 1 })
                    .eq('id', campaignId);

                sent++;
                logger.info(`Email sent to ${toEmail}`, { channelId: channel.channel_id });

                // Update channel email_sent status in DB
                await supabase
                    .from('channels')
                    .update({ email_sent: true })
                    .eq('channel_id', channel.channel_id);

                // Add 7 second delay between emails to prevent blocking
                await new Promise((resolve) => setTimeout(resolve, 7000));
            } catch (error) {
                failed++;
                logger.error(`Failed to send email to ${channel.email}`, {
                    error: error.message,
                    channelId: channel.channel_id,
                });

                // Log failure (Simplified)
                const failData = {
                    campaign_id: campaignId,
                    channel_id: channel.channel_id,
                    user_id: userId,
                    to_email: channel.email,
                    subject: campaign.subject,
                    status: 'failed',
                    error_message: error.message,
                };

                const { error: logErr } = await supabase
                    .from('email_logs')
                    .insert(failData);
                
                if (logErr) {
                    console.error('[CRITICAL_DEBUG] Failed to log email failure:', {
                        error: logErr.message,
                        code: logErr.code,
                        dataAttempted: failData
                    });
                }
            }
        }

        // Final campaign counter update
        await supabase
            .from('campaigns')
            .update({
                total_sent: sent,
                total_failed: failed,
                total_skipped: skipped,
            })
            .eq('id', campaignId);

        logger.info('Bulk email completed', { sent, failed, skipped, campaignId });
        return { sent, failed, skipped };
    }

    _personalize(template, channel) {
        if (!template) return '';
        return template
            .replace(/\{\{channelName\}\}/g, channel.name || channel.channelName || '')
            .replace(/\{\{subscribers\}\}/g, (channel.subscribers || 0).toLocaleString())
            .replace(/\{\{avgViews\}\}/g, (channel.avg_views || channel.avgViews || 0).toLocaleString())
            .replace(/\{\{channelUrl\}\}/g, channel.channel_url || channel.channelUrl || '')
            .replace(/\{\{email\}\}/g, channel.email || '');
    }
}

export default EmailService;
