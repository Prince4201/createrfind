import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from '../config/supabase.js';
// YouTubeService and FilterEngine are imported dynamically inside the worker to pick up fresh env vars if needed

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => {
        if (times > 3) {
            console.warn('⚠️ Redis not found at 127.0.0.1:6379. Workers will be disabled. App will fallback to in-memory processing.');
            return null;
        }
        return Math.min(times * 50, 2000);
    }
});

redisConnection.on('error', (err) => {
    // Keep silent to avoid spamming, but prevents crash
});

// Worker for fetching YouTube Channels
export const youtubeFetchWorker = new Worker('youtube-fetch', async job => {
    const { userId, searchHistoryId, filters } = job.data;
    
    console.log(`[Worker] Starting YouTube Fetch Job ${job.id} for keyword: ${filters.keyword}`);
    
    try {
        // Dynamically import to avoid circular dependencies if any
        const { default: YouTubeService } = await import('../services/youtubeService.js');
        const { default: FilterEngine } = await import('../services/filterEngine.js');
        
        const ytService = new YouTubeService(process.env.YOUTUBE_API_KEY);
        const engine = new FilterEngine(ytService, null); // Sheets service null for background job for now
        
        const result = await engine.discover(filters, userId);
        
        // Update search history returned count
        await supabase
            .from('search_history')
            .update({ 
                returned_count: result.channels.length,
                refresh_status: 'completed'
            })
            .eq('id', searchHistoryId);
            
        console.log(`[Worker] Completed Fetch Job ${job.id}. Saved ${result.channels.length} channels.`);
    } catch (error) {
        console.error(`[Worker] Failed Fetch Job ${job.id}:`, error.message);
        
        await supabase
                .from('search_history')
                .update({ 
                    returned_count: -1, // Mark as failed for UI polling
                    refresh_status: 'failed' 
                })
                .eq('id', searchHistoryId);
                
        throw error; // Let BullMQ handle retries
    }
}, { 
    connection: redisConnection,
    concurrency: 1
});

// Worker for sending Emails
export const emailCampaignWorker = new Worker('email-campaign', async job => {
    // Implementation for email sending logic using user's SMTP config
    console.log(`[Worker] Processing Email Campaign Job ${job.id}`);
}, {
    connection: redisConnection,
    limiter: {
        max: 5,
        duration: 1000 // Rate limit: 5 emails per second per worker
    }
});

youtubeFetchWorker.on('failed', (job, err) => console.error(`${job.id} failed:`, err.message));
emailCampaignWorker.on('failed', (job, err) => console.error(`${job.id} failed:`, err.message));
