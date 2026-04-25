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
        let dbQuery = supabase
            .from('channels')
            .select('*')
            .gte('subscribers', minSubscribers)
            .limit(requestedCount);

        if (niche) dbQuery = dbQuery.eq('niche', niche);
        if (query) dbQuery = dbQuery.ilike('niche', `%${query}%`);

        const { data: cachedChannels, error: fetchError } = await dbQuery;
        
        if (fetchError) throw fetchError;

        const foundCount = cachedChannels ? cachedChannels.length : 0;
        const missingCount = requestedCount - foundCount;

        // 3. Evaluate freshness & quantity
        // If we have enough data and it's not stale (not implemented detailed stale logic here for brevity, 
        // but would check last_fetched_at > 7 days ago)
        
        if (missingCount > 0) {
            // We need more data from YouTube API. Queue the background job.
            console.log(`[HybridFetch] Insufficient data. Found ${foundCount}. Queuing job for ${missingCount} more.`);
            
            // Bypass Redis and execute the fetch asynchronously in memory for local reliability
            import('./youtubeService.js').then(({ default: YouTubeService }) => {
                import('./filterEngine.js').then(({ default: FilterEngine }) => {
                    const runFetch = async () => {
                        try {
                            if (!process.env.YOUTUBE_API_KEY) {
                                throw new Error('YOUTUBE_API_KEY is missing in backend/.env');
                            }
                            
                            const ytService = new YouTubeService(process.env.YOUTUBE_API_KEY);
                            const engine = new FilterEngine(ytService, null);
                            
                            await engine.discover({
                                keyword: query || niche || 'youtube',
                                minSubscribers: minSubscribers || 0,
                                maxSubscribers: 100000000, // Default max
                                minAvgViews: 0, // Default min
                                maxChannels: missingCount
                            }, userId);

                            await supabase
                                .from('search_history')
                                .update({ returned_count: missingCount })
                                .eq('id', searchHistory.id);
                        } catch (err) {
                            console.error('[HybridFetch] Async fetch failed:', err.message);
                            await supabase
                                .from('search_history')
                                .update({ returned_count: -1 })
                                .eq('id', searchHistory.id);
                        }
                    };
                    runFetch(); // Run asynchronously
                });
            });
            // We have enough data, mark history as completed
            await supabase
                .from('search_history')
                .update({ cache_hit: foundCount })
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
