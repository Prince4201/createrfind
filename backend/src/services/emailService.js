import nodemailer from 'nodemailer';
import { db, admin } from '../config/firestore.js';
const { FieldValue } = admin.firestore;
import logger from '../config/logger.js';

class EmailService {
    constructor() {}

    /**
     * Load SMTP configuration from userSettings or fallback to systemSettings.
     */
    async getSMTPSettings(userId) {
        try {
            if (userId) {
                const userDoc = await db.collection('userSettings').doc(userId).get();
                if (userDoc.exists && userDoc.data().smtp) {
                    return userDoc.data().smtp;
                }
            }
            const doc = await db.collection('systemSettings').doc('smtp').get();
            if (doc.exists) {
                return doc.data();
            }
            logger.warn('No SMTP settings found in Firestore.');
            return null;
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
            secure: settings.smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPassword,
            },
        });
    }

    /**
     * Send personalized emails to selected channels for a campaign.
     * Skips channels that have already been emailed.
     * Placed a 7-second delay between emails.
     *
     * @param {Object} campaign     - { id, subject, bodyTemplate }
     * @param {Array}  channels     - [{ channelId, channelName, email, subscribers, avgViews, emailSent }]
     * @returns {{ sent: number, failed: number }}
     */
    async sendBulk(campaign, channels) {
        const settings = await this.getSMTPSettings(campaign.userId);
        if (!settings) {
            throw new Error('SMTP settings are not configured. Please set them in Email Settings.');
        }

        const transporter = this._createTransporter(settings);
        if (!transporter) {
            throw new Error('Invalid SMTP configuration. Please check your Email Settings.');
        }

        const { id: campaignId, subject, bodyTemplate } = campaign;
        let sent = 0;
        let failed = 0;

        // Filter out already sent
        let pendingChannels = channels.filter(ch => !ch.emailSent);

        if (pendingChannels.length === 0) {
            return { sent: 0, failed: 0, reason: 'All selected channels were already emailed.' };
        }

        logger.info(`Starting campaign email send to ${pendingChannels.length} channels`, { campaignId });

        for (const channel of pendingChannels) {
            try {
                const personalizedSubject = this._personalize(subject, channel);
                const personalizedBody = this._personalize(bodyTemplate, channel);

                await transporter.sendMail({
                    from: `"${settings.senderEmail}" <${settings.senderEmail}>`,
                    to: channel.email,
                    subject: personalizedSubject,
                    html: personalizedBody,
                });

                // Update channel in Firestore
                await db.collection('channels').doc(channel.channelId || channel.id).update({
                    emailSent: true,
                    emailSentAt: FieldValue.serverTimestamp(),
                });

                // Insert into emailLogs
                await db.collection('emailLogs').add({
                    channelId: channel.channelId || channel.id,
                    channelName: channel.channelName,
                    email: channel.email,
                    subject: personalizedSubject,
                    status: 'Sent',
                    sentAt: FieldValue.serverTimestamp(),
                    userId: campaign.userId || 'system',
                    campaignId: campaignId,
                });

                sent++;
                logger.info(`Email sent to ${channel.email}`, { channelId: channel.channelId || channel.id });

                // Add 7 second delay between emails to prevent Gmail blocking
                await new Promise((resolve) => setTimeout(resolve, 7000));
            } catch (error) {
                failed++;
                logger.error(`Failed to send email to ${channel.email}`, {
                    error: error.message,
                    channelId: channel.channelId || channel.id,
                });

                // Log failure to emailLogs
                await db.collection('emailLogs').add({
                    channelId: channel.channelId || channel.id,
                    channelName: channel.channelName,
                    email: channel.email,
                    subject: this._personalize(subject, channel),
                    status: 'Failed',
                    error: error.message,
                    sentAt: FieldValue.serverTimestamp(),
                    userId: campaign.userId || 'system',
                    campaignId: campaignId,
                });
            }
        }

        // Update campaign counters
        if (campaignId) {
            await db.collection('campaigns').doc(campaignId).update({
                emailsSent: FieldValue.increment(sent),
            });
        }

        // Update global analytics
        await db
            .collection('analytics')
            .doc('global')
            .set(
                { totalEmailsSent: FieldValue.increment(sent) },
                { merge: true }
            );

        // Optionally still log to activityLogs for broader dashboard tracking sync
        await db.collection('activityLogs').add({
            action: 'email_send',
            userId: campaign.userId || 'system',
            metadata: { campaignId, sent, failed },
            timestamp: FieldValue.serverTimestamp(),
        });

        logger.info('Bulk email completed', { sent, failed, campaignId });
        return { sent, failed };
    }

    _personalize(template, channel) {
        if (!template) return '';
        return template
            .replace(/\{\{channelName\}\}/g, channel.channelName || '')
            .replace(/\{\{subscribers\}\}/g, (channel.subscribers || 0).toLocaleString())
            .replace(/\{\{avgViews\}\}/g, (channel.avgViews || 0).toLocaleString())
            .replace(/\{\{channelUrl\}\}/g, channel.channelUrl || '')
            .replace(/\{\{email\}\}/g, channel.email || '');
    }
}

export default EmailService;
