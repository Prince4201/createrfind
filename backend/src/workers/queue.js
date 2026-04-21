import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('⚠️ Redis connection failed. Background jobs (BullMQ) will not run.');
            return null; // Abort retrying
        }
        return Math.min(times * 50, 2000);
    }
});

// Create Queues
export const youtubeFetchQueue = new Queue('youtube-fetch', { connection: redisConnection });
export const emailCampaignQueue = new Queue('email-campaign', { connection: redisConnection });

console.log('BullMQ queues initialized.');
