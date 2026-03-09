import nodemailer from 'nodemailer';
import { db, admin } from '../config/firestore.js';
const { FieldValue } = admin.firestore;
import logger from '../config/logger.js';

class EmailService {
    constructor() {
        this.transporter = null;
        this.settings = null;
    }

    /**
     * Load SMTP configuration from Firestore.
     */
    async loadSMTPSettings() {
        try {
            const doc = await db.collection('systemSettings').doc('smtp').get();
            if (doc.exists) {
                this.settings = doc.data();
                this._createTransporter();
                logger.info('SMTP settings loaded successfully');
                return true;
            }
            logger.warn('No SMTP settings found in Firestore.');
            return false;
        } catch (error) {
            logger.error('Failed to load SMTP settings', { error: error.message });
            return false;
        }
    }

    /**
     * Use Nodemailer to create an SMTP transporter.
     */
    _createTransporter() {
        if (!this.settings || !this.settings.smtpHost) return;

        this.transporter = nodemailer.createTransport({
            host: this.settings.smtpHost,
            port: this.settings.smtpPort,
            secure: this.settings.smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: this.settings.smtpUser,
                pass: this.settings.smtpPassword,
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
        if (!this.transporter) {
            const loaded = await this.loadSMTPSettings();
            if (!loaded || !this.transporter) {
                throw new Error('SMTP transporter is not configured. Please set it in the Email Settings.');
            }
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

                await this.transporter.sendMail({
                    from: `"${this.settings.senderEmail}" <${this.settings.senderEmail}>`,
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
