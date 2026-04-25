import { supabase } from '../config/supabase.js';

export default class HybridFetchService {
    /**
     * Executes a synchronous search: DB First -> API Fallback
     */
    static async searchCreators(userId, query, filters = {}) {
        const { requestedCount = 30, niche } = filters;

        // 1. Query Supabase for existing cached channels matching criteria
        const { data: cachedChannels, error: fetchError } = await supabase
            .from('channels')
            .select('*')
            .eq('niche', niche || query)
            .eq('is_discovered', true)
            .limit(requestedCount);
        
        if (fetchError) throw fetchError;

        const foundCount = cachedChannels ? cachedChannels.length : 0;
        const missingCount = requestedCount - foundCount;

        let finalChannels = cachedChannels || [];

        if (missingCount > 0) {
            console.log(`[HybridFetch] Insufficient data. Found ${foundCount}. Fetching ${missingCount} more synchronously.`);
            
            try {
                const { default: YouTubeService } = await import('./youtubeService.js');
                const { default: FilterEngine } = await import('./filterEngine.js');
                
                const ytService = new YouTubeService(process.env.YOUTUBE_API_KEY);
                const engine = new FilterEngine(ytService, null);
                
                const result = await engine.discover({
                    keyword: query || niche || 'youtube',
                    maxChannels: missingCount
                }, userId);

                // Combine cached and new results
                finalChannels = [...finalChannels, ...result.channels];
            } catch (err) {
                console.error('[HybridFetch] Synchronous fetch failed:', err.message);
                throw err;
            }
        }

        // Return final results immediately
        return {
            status: 'complete',
            returnedCount: finalChannels.length,
            channels: finalChannels
        };
    }
}
