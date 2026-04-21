import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from '../config/supabase.js';
import YouTubeService from '../services/youtubeService.js';
// We assume we have an initialized youtubeService or we initialize one per job
const youtubeService = new YouTubeService(process.env.YOUTUBE_API_KEY);

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
    }
});

// Worker for fetching YouTube Channels
export const youtubeFetchWorker = new Worker('youtube-fetch', async job => {
    const { query, niche, minSubscribers, requestedCount, userId, searchHistoryId } = job.data;
    
    console.log(`[Worker] Starting YouTube Fetch Job ${job.id} for query: ${query}`);
    
    try {
        // Fetch channels from YouTube API
        // This is a simplified call; real implementation handles pagination and detailed stats
        const results = await youtubeService.searchChannels(query, requestedCount);
        
        if (results && results.length > 0) {
            // Upsert into Supabase
            const { error } = await supabase
                .from('channels')
                .upsert(
                    results.map(c => ({
                        channel_id: c.id,
                        name: c.title,
                        description: c.description,
                        subscribers: c.subscriberCount || 0,
                        niche: niche,
                        fetched_by_user_id: userId,
                        last_fetched_at: new Date().toISOString()
                    })),
                    { onConflict: 'channel_id' }
                );

            if (error) throw error;
            
            // Update search history returned count
            await supabase
                .from('search_history')
                .update({ 
                    returned_count: results.length,
                    refresh_status: 'completed'
                })
                .eq('id', searchHistoryId);
                
            console.log(`[Worker] Completed Fetch Job ${job.id}. Saved ${results.length} channels.`);
        }
    } catch (error) {
        console.error(`[Worker] Failed Fetch Job ${job.id}:`, error.message);
        
        await supabase
                .from('search_history')
                .update({ refresh_status: 'failed' })
                .eq('id', searchHistoryId);
                
        throw error; // Let BullMQ handle retries
    }
}, { 
    connection: redisConnection,
    concurrency: 1 // Limit concurrency to avoid hitting YT API limits too hard
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
