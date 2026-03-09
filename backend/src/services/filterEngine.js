import logger from '../config/logger.js';
import { db, admin } from '../config/firestore.js';
const { FieldValue } = admin.firestore;
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
     *  5. Save to Firestore + Google Sheet
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
        let processedCount = 0;
        const seenIds = new Set();
        const target = Math.min(maxChannels, 50);

        logger.info('Discovery started', { keyword, target, userId });

        // Dynamically import p-limit (ESM-only package)
        const pLimit = (await import('p-limit')).default;
        const limit = pLimit(5); // Process 5 channels concurrently

        outer: while (validChannels.length < target) {
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

            // Deduplicate against Firestore database to avoid fetching existing channels
            const channelsToProcess = [];
            if (newChannels.length > 0) {
                // Fetch existing by chunk of 30 if needed, but in this case max 50
                const channelIds = newChannels.map((c) => c.channelId);
                
                // Firestore 'in' query supports up to 30 items, but empty array throws an error.
                // We also use chunk of 10 to be ultra-safe.
                const existingIds = new Set();
                const { FieldPath } = admin.firestore;
                for (let i = 0; i < channelIds.length; i += 10) {
                    const chunk = channelIds.slice(i, i + 10);
                    if (chunk.length > 0) {
                        const snapshot = await db.collection('channels')
                            .where(FieldPath.documentId(), 'in', chunk)
                            .get();
                        snapshot.forEach(doc => existingIds.add(doc.id));
                    }
                }

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

                        // Filter 1: Subscriber range
                        if (channel.subscribers < minSubscribers || channel.subscribers > maxSubscribers) {
                            logger.debug(`Filtered out (subs): ${channel.channelName}`, {
                                subscribers: channel.subscribers,
                            });
                            return null;
                        }

                        // Filter 2: Average views
                        const avgViews = await this.yt.calculateAvgViews(ch.channelId);
                        if (avgViews < minAvgViews) {
                            logger.debug(`Filtered out (views): ${channel.channelName}`, { avgViews });
                            return null;
                        }

                        // Filter 3: Keyword relevance
                        const keywordLower = keyword.toLowerCase();
                        const nameMatch = channel.channelName.toLowerCase().includes(keywordLower);
                        const descMatch = channel.description.toLowerCase().includes(keywordLower);
                        if (!nameMatch && !descMatch) {
                            logger.debug(`Filtered out (keyword): ${channel.channelName}`);
                            return null;
                        }

                        // Filter 4: Email present
                        const email = this.yt.extractEmail(channel.description);
                        if (!email) {
                            logger.debug(`Filtered out (no email): ${channel.channelName}`);
                            return null;
                        }

                        return {
                            channelId: channel.channelId,
                            channelName: channel.channelName,
                            channelUrl: channel.channelUrl,
                            thumbnailUrl: channel.thumbnail || '',
                            subscribers: channel.subscribers,
                            totalViews: 0,
                            videoCount: channel.videoCount || 0,
                            avgViews,
                            description: channel.description,
                            category: channel.category,
                            country: 'Unknown',
                            email,
                            scrapedAt: new Date(),
                            emailSent: false,
                            emailSentDate: null,
                            sheetSynced: false,
                            createdByUserId: userId,
                            userId,
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
                    processedCount++;
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

        // 3. Save to Firestore (batch write)
        if (validChannels.length > 0) {
            await this._saveToFirestore(validChannels, userId);

            // 4. Append to Google Sheet
            if (this.sheets) {
                try {
                    await this.sheets.appendChannels(validChannels);
                    // Mark as synced
                    const updateBatch = db.batch();
                    for (const ch of validChannels) {
                        const docRef = db.collection('channels').doc(ch.channelId);
                        updateBatch.update(docRef, { sheetSynced: true });
                    }
                    await updateBatch.commit();
                    logger.info(`Appended ${validChannels.length} channels to Google Sheet and marked as synced`);
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

    async _saveToFirestore(channels, userId) {
        const batch = db.batch();

        for (const ch of channels) {
            // Use channelId as doc ID to prevent duplicates
            const docRef = db.collection('channels').doc(ch.channelId);
            batch.set(docRef, ch, { merge: true });
        }

        // Update global analytics
        const analyticsRef = db.collection('analytics').doc('global');
        batch.set(
            analyticsRef,
            {
                totalChannels: FieldValue.increment(channels.length),
                lastDiscoveryAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Log activity
        const logRef = db.collection('activityLogs').doc();
        batch.set(logRef, {
            action: 'discovery',
            userId,
            metadata: {
                channelsFound: channels.length,
                channelIds: channels.map((c) => c.channelId),
            },
            timestamp: FieldValue.serverTimestamp(),
        });

        await batch.commit();
        logger.info(`Saved ${channels.length} channels to Firestore`);
    }
}

export default FilterEngine;
