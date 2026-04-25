import { supabase } from '../config/supabase.js';
import { youtubeFetchQueue } from '../workers/queue.js';

export default class HybridFetchService {
    /**
     * Executes a hybrid search: DB First -> API Fallback via Queue
     */
    static async searchCreators(userId, query, filters = {}) {
        const { minSubscribers = 0, requestedCount = 50, niche } = filters;

        // 1. Log the search intent
        const { data: searchHistory, error: historyError } = await supabase
            .from('search_history')
            .insert({
                user_id: userId,
                query,
                niche,
                requested_count: requestedCount
            })
            .select()
            .single();

        if (historyError) throw historyError;

        // 2. Query Supabase for existing cached channels matching criteria
        const { data: cachedChannels, error: fetchError } = await supabase
            .from('channels')
            .select('*')
            .eq('niche', niche || query)
            .eq('is_discovered', true)
            .limit(requestedCount);
        
        if (fetchError) throw fetchError;

        const foundCount = cachedChannels ? cachedChannels.length : 0;
        const missingCount = requestedCount - foundCount;

        if (missingCount > 0) {
            // We need more data from YouTube API. Queue the background job.
            console.log(`[HybridFetch] Insufficient data. Found ${foundCount}. Queuing job for ${missingCount} more.`);
            
            try {
                await youtubeFetchQueue.add('discover-channels', {
                    userId,
                    searchHistoryId: searchHistory.id,
                    filters: {
                        keyword: query || niche || 'youtube',
                        maxChannels: missingCount
                    }
                }, {
                    removeOnComplete: true,
                    removeOnFail: false,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000
                    }
                });
            } catch (queueError) {
                console.warn('[HybridFetch] Redis/Queue unavailable. Falling back to in-memory async fetch.', queueError.message);
                
                // FALLBACK: In-memory async fetch
                (async () => {
                    try {
                        const { default: YouTubeService } = await import('./youtubeService.js');
                        const { default: FilterEngine } = await import('./filterEngine.js');
                        const ytService = new YouTubeService(process.env.YOUTUBE_API_KEY);
                        const engine = new FilterEngine(ytService, null);
                        await engine.discover({
                            keyword: query || niche || 'youtube',
                            maxChannels: missingCount
                        }, userId);
                        
                        await supabase
                            .from('search_history')
                            .update({ returned_count: missingCount, refresh_status: 'completed' })
                            .eq('id', searchHistory.id);
                    } catch (err) {
                        console.error('[HybridFetch] Fallback fetch failed:', err.message);
                        await supabase
                            .from('search_history')
                            .update({ returned_count: -1, refresh_status: 'failed' })
                            .eq('id', searchHistory.id);
                    }
                })();
            }

            // Mark history as polling
            await supabase
                .from('search_history')
                .update({ cache_hit: foundCount, returned_count: null })
                .eq('id', searchHistory.id);
        } else {
            // We have enough data, mark history as completed
            await supabase
                .from('search_history')
                .update({ cache_hit: foundCount, returned_count: foundCount })
                .eq('id', searchHistory.id);
        }

        // 4. Return what we immediately have to the user for a snappy UI
        return {
            status: missingCount > 0 ? 'partial_fetching_background' : 'complete_from_cache',
            searchHistoryId: searchHistory.id,
            returnedCount: foundCount,
            missingCount: missingCount > 0 ? missingCount : 0,
            channels: cachedChannels
        };
    }
}
