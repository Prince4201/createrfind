import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './config/logger.js';
import { loadSecrets } from './config/secrets.js';
import authMiddleware from './middleware/supabaseAuth.js';
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
import adminRoutes from './routes/admin.js';

// Service imports
import YouTubeService from './services/youtubeService.js';
import FilterEngine from './services/filterEngine.js';
import EmailService from './services/emailService.js';
import SheetsService from './services/sheetsService.js';

// ─── App factory ─────────────────────────────────────────────────────────────
// getApp() initialises all services and returns the configured Express app.
// It is called by the Vercel entry point (api/index.js) and by start() below.
// We cache the promise so that Vercel's warm-lambda reuse doesn't re-init.
// ─────────────────────────────────────────────────────────────────────────────
let _appPromise = null;

export async function getApp() {
    if (_appPromise) return _appPromise;

    _appPromise = (async () => {
        const app = express();

        // ------- Security -------
        app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));
        
        const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000', 'http://localhost:3001'];
        app.use(cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        app.use(express.json({ limit: '1mb' }));
        
        // Request logging middleware
        app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`, {
                origin: req.headers.origin,
                userAgent: req.headers['user-agent']
            });
            next();
        });

        app.use(generalLimiter);

        app.get("/", (req, res) => {
            res.json({ message: "YouTube Creator Discovery API" });
        });

        // ------- Health check (no auth) -------
        app.get('/health', (_req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // ------- Public routes -------
        app.use('/api/auth', authRoutes);

        // ------- Protected routes (Supabase JWT auth) -------
        app.use('/api/channels', authMiddleware, channelRoutes);
        app.use('/api/campaigns', authMiddleware, campaignRoutes);
        app.use('/api/emails', authMiddleware, emailRoutes);
        app.use('/api/analytics', authMiddleware, analyticsRoutes);
        app.use('/api/sheets', authMiddleware, sheetRoutes);
        app.use('/api/settings', authMiddleware, settingsRoutes);
        app.use('/api/admin', adminRoutes); // Has its own auth + admin check

        // ------- Error handler -------
        app.use(errorHandler);

        // ------- Bootstrap services -------
        logger.info('Loading secrets...');
        const secrets = await loadSecrets();

        const youtubeService = new YouTubeService(secrets.youtubeApiKey);

        let sheetsCredentials = null;
        if (secrets.sheetsCredentials) {
            sheetsCredentials = secrets.sheetsCredentials;
        }

        const filterEngine = new FilterEngine(youtubeService, null);
        const emailService = new EmailService();

        // Attach services to app for route access
        app.set('youtubeService', youtubeService);
        app.set('filterEngine', filterEngine);
        app.set('emailService', emailService);
        app.set('sheetsCredentials', sheetsCredentials);

        logger.info('App ready', {
            env: process.env.NODE_ENV,
            services: {
                youtube: !!secrets.youtubeApiKey,
                sheets: !!sheetsCredentials,
            },
        });

        return app;
    })();

    return _appPromise;
}

// ─── Local dev entry ─────────────────────────────────────────────────────────
// Only runs when executed directly (not imported by Vercel).
// ─────────────────────────────────────────────────────────────────────────────
async function start() {
    try {
        const app = await getApp();
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Run only when this file is the entry point (local dev)
if (process.argv[1] && process.argv[1].endsWith('app.js')) {
    start();
}
