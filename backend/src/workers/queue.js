import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => {
        if (times > 3) {
            console.warn('⚠️ Redis connection failed. Background jobs (BullMQ) will not run. Falling back to in-memory processing.');
            return null; // Abort retrying
        }
        return Math.min(times * 50, 2000);
    }
});

// Prevent process crash if Redis is unavailable
redisConnection.on('error', (err) => {
    // We only log this once via retryStrategy above, so we keep this silent to avoid spamming the console
});

// Create Queues
export const youtubeFetchQueue = new Queue('youtube-fetch', { connection: redisConnection });
export const emailCampaignQueue = new Queue('email-campaign', { connection: redisConnection });

console.log('BullMQ queues initialized.');
