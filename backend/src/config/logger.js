import winston from 'winston';

let cloudTransport = null;

async function initCloudLogging() {
    // Only attempt to use Cloud Logging if we explicitly have a Project ID set and credentials
    if (process.env.NODE_ENV === 'production' && process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            const { LoggingWinston } = await import('@google-cloud/logging-winston');
            cloudTransport = new LoggingWinston({
                projectId: process.env.GOOGLE_CLOUD_PROJECT,
                logName: 'youtube-creator-discovery',
            });
            
            // Catch background transport errors so they don't crash the Node process
            cloudTransport.on('error', (err) => {
                console.warn('[Logger] Cloud Logging background error:', err.message);
            });
        } catch {
            // Cloud Logging not available — will use console only
        }
    }
}

function createLogger() {
    const transports = [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ level, message, timestamp, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} [${level}]: ${message}${metaStr}`;
                })
            ),
        }),
    ];

    if (cloudTransport) {
        transports.push(cloudTransport);
    }

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        transports,
    });

    // Catch errors emitted on the logger instance itself to prevent unhandled rejections
    logger.on('error', (err) => {
        console.warn('[Logger] Winston error:', err.message);
    });

    return logger;
}

await initCloudLogging();
const logger = createLogger();

export default logger;
