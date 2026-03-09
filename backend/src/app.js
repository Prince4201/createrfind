import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './config/logger.js';
import { loadSecrets } from './config/secrets.js';
import authMiddleware from './middleware/auth.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import channelRoutes from './routes/channels.js';
import campaignRoutes from './routes/campaigns.js';
import emailRoutes from './routes/emails.js';
import analyticsRoutes from './routes/analytics.js';
import sheetRoutes from './routes/sheets.js';
import settingsRoutes from './routes/settings.js';

// Service imports
import YouTubeService from './services/youtubeService.js';
import FilterEngine from './services/filterEngine.js';
import EmailService from './services/emailService.js';
import SheetsService from './services/sheetsService.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ------- Security -------
app.use(helmet());
app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    })
);
app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);

// ------- Health check (no auth) -------
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ------- Public routes -------
app.use('/api/auth', authRoutes);

// ------- Protected routes -------
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/emails', authMiddleware, emailRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/sheets', authMiddleware, sheetRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// ------- Error handler -------
app.use(errorHandler);

// ------- Bootstrap services & start -------
async function start() {
    try {
        logger.info('Loading secrets...');
        const secrets = await loadSecrets();

        // Initialize services
        const youtubeService = new YouTubeService(secrets.youtubeApiKey);

        let sheetsService = null;
        if (secrets.sheetsCredentials && process.env.GOOGLE_SHEET_ID) {
            sheetsService = new SheetsService(
                secrets.sheetsCredentials,
                process.env.GOOGLE_SHEET_ID
            );
        }

        const filterEngine = new FilterEngine(youtubeService, sheetsService);

        // Initialize empty EmailService; it will load settings internally
        const emailService = new EmailService();
        await emailService.loadSMTPSettings();

        // Attach services to app for route access
        app.set('youtubeService', youtubeService);
        app.set('filterEngine', filterEngine);
        app.set('emailService', emailService);
        app.set('sheetsService', sheetsService);

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`, {
                env: process.env.NODE_ENV,
                services: {
                    youtube: !!secrets.youtubeApiKey,
                    sendgrid: !!secrets.sendgridApiKey,
                    sheets: !!sheetsService,
                },
            });
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

start();

export default app;
