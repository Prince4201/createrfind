import { google } from 'googleapis';
import logger from '../config/logger.js';

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;

class YouTubeService {
    constructor(apiKeys) {
        // apiKeys can be a single string or a comma-separated list
        this.apiKeys = typeof apiKeys === 'string' ? apiKeys.split(',').map(k => k.trim()) : apiKeys;
        this.currentKeyIndex = 0;
        this._updateClient();
    }

    _updateClient() {
        const apiKey = this.apiKeys[this.currentKeyIndex];
        this.youtube = google.youtube({ version: 'v3', auth: apiKey });
        this.apiKey = apiKey;
        logger.info(`YouTube API key rotated to index ${this.currentKeyIndex}`);
    }

    _rotateKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        this._updateClient();
    }

    /* ---------- search.list — find channels by keyword ---------- */
    async searchChannels(keyword, pageToken = null) {
        const params = {
            part: 'snippet',
            q: keyword,
            type: 'channel',
            maxResults: 50,
            order: 'relevance',
        };
        if (pageToken) params.pageToken = pageToken;

        const res = await this._call(() => this.youtube.search.list(params));
        return {
            channels: (res.data.items || []).map((item) => ({
                channelId: item.snippet.channelId || item.id.channelId,
                channelName: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.default?.url,
            })),
            nextPageToken: res.data.nextPageToken || null,
        };
    }

    /* ---------- channels.list — subscriber count + full snippet ---------- */
    async getChannelDetails(channelIds) {
        const ids = Array.isArray(channelIds) ? channelIds : [channelIds];
        const batches = [];
        for (let i = 0; i < ids.length; i += 50) {
            batches.push(ids.slice(i, i + 50));
        }

        const results = [];
        for (const batch of batches) {
            const res = await this._call(() =>
                this.youtube.channels.list({
                    part: 'snippet,statistics',
                    id: batch.join(','),
                })
            );
            for (const item of res.data.items || []) {
                results.push({
                    channelId: item.id,
                    channelName: item.snippet.title,
                    description: item.snippet.description,
                    channelUrl: `https://www.youtube.com/channel/${item.id}`,
                    subscribers: parseInt(item.statistics.subscriberCount, 10) || 0,
                    videoCount: parseInt(item.statistics.videoCount, 10) || 0,
                    category: item.snippet?.categoryId || '',
                    thumbnail: item.snippet.thumbnails?.default?.url,
                });
            }
        }
        return results;
    }

    /* ---------- search.list — recent videos for a channel ---------- */
    async getRecentVideos(channelId, maxResults = 30) {
        const res = await this._call(() =>
            this.youtube.search.list({
                part: 'id',
                channelId,
                order: 'date',
                maxResults: Math.min(maxResults, 50),
                type: 'video',
            })
        );

        return (res.data.items || [])
            .filter((item) => item.id.videoId)
            .map((item) => item.id.videoId);
    }

    /* ---------- videos.list — view counts ---------- */
    async getVideoStats(videoIds) {
        if (!videoIds.length) return [];
        const batches = [];
        for (let i = 0; i < videoIds.length; i += 50) {
            batches.push(videoIds.slice(i, i + 50));
        }

        const results = [];
        for (const batch of batches) {
            const res = await this._call(() =>
                this.youtube.videos.list({
                    part: 'statistics',
                    id: batch.join(','),
                })
            );
            for (const item of res.data.items || []) {
                results.push({
                    videoId: item.id,
                    viewCount: parseInt(item.statistics.viewCount, 10) || 0,
                });
            }
        }
        return results;
    }

    /* ---------- Calculate average views from last N videos ---------- */
    async calculateAvgViews(channelId) {
        const videoIds = await this.getRecentVideos(channelId, 30);
        if (videoIds.length === 0) return 0;

        const stats = await this.getVideoStats(videoIds);
        if (stats.length === 0) return 0;

        const totalViews = stats.reduce((sum, s) => sum + s.viewCount, 0);
        return Math.round(totalViews / stats.length);
    }

    /* ---------- Extract email from description ---------- */
    extractEmail(description) {
        if (!description) return null;
        const matches = description.match(EMAIL_REGEX);
        if (!matches || matches.length === 0) return null;

        // Filter out common false positives
        const filtered = matches.filter(
            (e) =>
                !e.endsWith('.png') &&
                !e.endsWith('.jpg') &&
                !e.endsWith('.gif') &&
                !e.includes('example.com') &&
                !e.includes('email@')
        );
        return filtered.length > 0 ? filtered[0].toLowerCase() : null;
    }

    /* ---------- Internal: API call with retry + quota handling ---------- */
    async _call(fn, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const status = error?.response?.status || error?.code;

                // Quota exceeded — rotate and retry if possible
                if (status === 403 || status === 429) {
                    if (this.apiKeys.length > 1) {
                        logger.warn('YouTube API quota exceeded. Rotating key...', {
                            message: error.message,
                        });
                        this._rotateKey();
                        // Reset attempt counter for the new key? 
                        // Let's just continue the loop, it will retry with the new key in the next iteration.
                        continue; 
                    } else {
                        logger.error('YouTube API quota exceeded (no more keys to rotate)', {
                            message: error.message,
                        });
                        const quotaError = new Error('YouTube API quota exceeded');
                        quotaError.statusCode = 429;
                        throw quotaError;
                    }
                }

                // Retryable errors
                if (attempt < retries && status >= 500) {
                    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                    logger.warn(`YouTube API retry ${attempt}/${retries}`, { delay, status });
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }

                throw error;
            }
        }
    }
}

export default YouTubeService;
