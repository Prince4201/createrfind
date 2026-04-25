import { supabase } from '../config/supabase.js';

export default class HybridFetchService {
    /**
     * Executes a synchronous search: DB First -> API Fallback
     */
    static async searchCreators(userId, query, filters = {}) {
        const { requestedCount = 30, niche } = filters;

        // 1. Create a search session record
        const { data: session, error: sessionError } = await supabase
            .from('search_history')
            .insert({
                user_id: userId,
                query: query || niche,
                niche: niche || query,
                requested_count: requestedCount,
                refresh_status: 'processing'
            })
            .select()
            .single();

        if (sessionError) throw sessionError;

        // 2. Check for EXISTING data with this EXACT niche for this user (Cache check)
        const { data: cachedChannels, error: fetchError } = await supabase
            .from('channels')
            .select('*')
            .eq('fetched_by_user_id', userId)
            .eq('niche', niche || query)
            .limit(requestedCount);
        
        if (fetchError) throw fetchError;

        const foundCount = cachedChannels ? cachedChannels.length : 0;
        
        if (foundCount > 0) {
            // Update cached channels to belong to the NEW session so they appear in "current fetch"
            await supabase
                .from('channels')
                .update({ search_history_id: session.id })
                .in('channel_id', cachedChannels.map(c => c.channel_id));
        }

        const missingCount = requestedCount - foundCount;
        let finalChannels = cachedChannels || [];

        if (missingCount > 0) {
            try {
                const { default: YouTubeService } = await import('./youtubeService.js');
                const { default: FilterEngine } = await import('./filterEngine.js');
                
                const ytService = new YouTubeService(process.env.YOUTUBE_API_KEY);
                const engine = new FilterEngine(ytService, null);
                
                const result = await engine.discover({
                    keyword: query || niche || 'youtube',
                    maxChannels: missingCount,
                    searchHistoryId: session.id // Link new data to this session
                }, userId);

                finalChannels = [...finalChannels, ...result.channels];
            } catch (err) {
                await supabase.from('search_history').update({ refresh_status: 'failed' }).eq('id', session.id);
                throw err;
            }
        }

        // Update session as completed
        await supabase
            .from('search_history')
            .update({ 
                returned_count: finalChannels.length, 
                refresh_status: 'completed' 
            })
            .eq('id', session.id);

        return {
            status: 'complete',
            sessionId: session.id,
            returnedCount: finalChannels.length,
            channels: finalChannels
        };
    }
}
