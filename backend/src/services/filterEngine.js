import logger from '../config/logger.js';
import { supabase } from '../config/supabase.js';

class FilterEngine {
    constructor(youtubeService, sheetsService) {
        this.yt = youtubeService;
        this.sheets = sheetsService;
    }

    /**
     * Run the full discovery pipeline:
     *  1. Search YouTube for channels matching keyword
     *  2. For each channel, fetch details + avg views
     *  3. Apply filters sequentially
     *  4. Stop when target count reached
     *  5. Save to Supabase + Google Sheet
     */
    async discover(filters, userId) {
        const {
            keyword,
            minSubscribers,
            maxSubscribers,
            minAvgViews,
            maxChannels,
        } = filters;

        const validChannels = [];
        let pageToken = null;
        const seenIds = new Set();
        const target = Math.min(maxChannels, 50);

        logger.info('Discovery started', { keyword, target, userId });

        // Dynamically import p-limit (ESM-only package)
        const pLimit = (await import('p-limit')).default;
        const limit = pLimit(5); // Process 5 channels concurrently

        while (validChannels.length < target) {
            // 1. Search for channels
            const searchResult = await this.yt.searchChannels(keyword, pageToken);
            pageToken = searchResult.nextPageToken;

            if (searchResult.channels.length === 0) {
                logger.info('No more channels found in search results');
                break;
            }

            // Deduplicate against seen in this run
            const newChannels = searchResult.channels.filter((ch) => {
                if (seenIds.has(ch.channelId)) return false;
                seenIds.add(ch.channelId);
                return true;
            });

            // Deduplicate against Supabase database
            const channelsToProcess = [];
            if (newChannels.length > 0) {
                const channelIds = newChannels.map((c) => c.channelId);

                const { data: existing } = await supabase
                    .from('channels')
                    .select('channel_id')
                    .in('channel_id', channelIds);

                const existingIds = new Set((existing || []).map(e => e.channel_id));

                for (const ch of newChannels) {
                    if (!existingIds.has(ch.channelId)) {
                        channelsToProcess.push(ch);
                    } else {
                        logger.debug(`Filtered out (already in db): ${ch.channelId}`);
                    }
                }
            }

            // 2. Process batch concurrently with p-limit
            const tasks = channelsToProcess.map((ch) =>
                limit(async () => {
                    if (validChannels.length >= target) return null;

                    try {
                        // Fetch detailed channel info
                        const details = await this.yt.getChannelDetails(ch.channelId);
                        if (!details.length) return null;
                        const channel = details[0];

                        // Filter 1: Keyword relevance
                        const keywordLower = keyword.toLowerCase();
                        const nameMatch = channel.channelName.toLowerCase().includes(keywordLower);
                        const descMatch = channel.description.toLowerCase().includes(keywordLower);
                        if (!nameMatch && !descMatch) return null;

                        // Filter 2: Email present
                        const email = this.yt.extractEmail(channel.description);
                        if (!email) return null;

                        return {
                            channel_id: channel.channelId,
                            name: channel.channelName,
                            channel_url: channel.channelUrl,
                            description: channel.description,
                            subscribers: channel.subscribers,
                            avg_views: 0, // Optimized: do not calculate avg views initially to save quota
                            category: channel.category,
                            email,
                            niche: keyword,
                            is_discovered: true,
                            fetched_by_user_id: userId,
                            search_history_id: filters.searchHistoryId, // Link to session
                            last_fetched_at: new Date().toISOString(),
                        };
                    } catch (error) {
                        logger.error(`Error processing channel ${ch.channelId}`, {
                            error: error.message,
                        });
                        return null;
                    }
                })
            );

            const results = await Promise.all(tasks);
            for (const result of results) {
                if (result && validChannels.length < target) {
                    validChannels.push(result);
                }
            }

            // No more pages
            if (!pageToken) break;

            // Safety: don't process more than 500 candidates total
            if (seenIds.size > 500) {
                logger.warn('Safety limit: processed 500+ candidate channels');
                break;
            }
        }

        // 3. Save to Supabase
        if (validChannels.length > 0) {
            await this._saveToSupabase(validChannels, userId);

            // 5. Append to Google Sheet
            if (this.sheets) {
                try {
                    // Map to the format sheetsService expects
                    const mapped = validChannels.map(ch => ({
                        channelId: ch.channel_id,
                        channelName: ch.name,
                        channelUrl: ch.channel_url,
                        subscribers: ch.subscribers,
                        avgViews: ch.avg_views,
                        email: ch.email,
                        description: ch.description,
                        category: ch.category,
                        scrapedAt: new Date(),
                    }));
                    await this.sheets.appendChannels(mapped);
                    logger.info(`Appended ${validChannels.length} channels to Google Sheet`);
                } catch (err) {
                    logger.error('Failed to append to Google Sheet', { error: err.message });
                }
            }
        }

        logger.info('Discovery complete', {
            found: validChannels.length,
            processed: seenIds.size,
            userId,
        });

        return {
            channels: validChannels,
            totalFound: validChannels.length,
            totalProcessed: seenIds.size,
        };
    }

    async _saveToSupabase(channels, userId) {
        // Upsert channels
        const { error } = await supabase
            .from('channels')
            .upsert(channels, { onConflict: 'channel_id' });

        if (error) {
            logger.error('Failed to save channels to Supabase', { error: error.message });
            throw error;
        }

        logger.info(`Saved ${channels.length} channels to Supabase`);
    }
}

export default FilterEngine;
