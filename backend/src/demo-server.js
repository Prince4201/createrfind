import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import SheetsService from './services/sheetsService.js';

// Firebase / Firestore
let db = null;
let adminAuth = null;
let initCollections = null;
let firestoreAvailable = false;

try {
    const firebaseModule = await import('./config/firebaseAdmin.js');
    db = firebaseModule.db;
    adminAuth = firebaseModule.auth;
    const initModule = await import('./config/initCollections.js');
    initCollections = initModule.initCollections;
    firestoreAvailable = true;
    console.log('  🔥 Firebase Admin SDK loaded');
} catch (err) {
    console.warn(`  ⚠️  Firebase not available: ${err.message}`);
    console.warn('     Firestore persistence disabled — using in-memory only');
}

// ═══════════════════════════════════════════════════════════
//  CreatorFind — Demo Server (with REAL YouTube API)
//  Uses in-memory storage + live YouTube Data API v3.
//  Requires YOUTUBE_API_KEY env var for discovery.
// ═══════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 8080;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS || null;
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SIGNUP_SECRET_KEY = process.env.SIGNUP_SECRET_KEY || '02468';

// Initialize YouTube client
const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });

// Initialize Google Sheets service (optional — works without credentials)
let sheetsService = null;
if (SHEETS_CREDENTIALS && SHEET_ID) {
    try {
        sheetsService = new SheetsService(SHEETS_CREDENTIALS, SHEET_ID);
        console.log('  📊 Google Sheets service initialized');
    } catch (err) {
        console.warn('  ⚠️  Sheets service init failed:', err.message);
    }
}

// ── Middleware ──
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
// ═══════════════════════════════════════════════════════════
//  Firestore-Backed Per-User Data Store
//  Data persists across server restarts via Firestore.
//  In-memory Map serves as a fast cache.
// ═══════════════════════════════════════════════════════════

const userStores = new Map();

function emptyStore() {
    return {
        channels: [],
        campaigns: [],
        activityLogs: [],
        analytics: {
            totalChannels: 0,
            totalEmailsSent: 0,
            totalCampaigns: 0,
            discoveryRuns: 0,
            lastDiscoveryAt: null,
        },
        _loaded: false,
    };
}

/**
 * Load user's data from Firestore into memory cache.
 * Called once per user per server lifecycle.
 */
async function loadUserStore(uid) {
    if (!firestoreAvailable || !db) return emptyStore();

    const store = emptyStore();

    // Load channels (no orderBy to avoid needing composite indexes)
    try {
        const channelsSnap = await db.collection('channels')
            .where('createdByUserId', '==', uid)
            .limit(500)
            .get();
        store.channels = channelsSnap.docs
            .filter(d => d.id !== '_meta')
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    channelId: data.channelId || d.id,  // Ensure channelId is always set
                    scrapedAt: data.scrapedAt?.toDate?.() || data.scrapedAt,
                };
            })
            .sort((a, b) => {
                const ta = a.scrapedAt instanceof Date ? a.scrapedAt.getTime() : 0;
                const tb = b.scrapedAt instanceof Date ? b.scrapedAt.getTime() : 0;
                return tb - ta;
            });

        // Deduplicate by channelId (in case of any data anomalies)
        const seenIds = new Set();
        store.channels = store.channels.filter(ch => {
            if (seenIds.has(ch.channelId)) return false;
            seenIds.add(ch.channelId);
            return true;
        });

        console.log(`  📺 Loaded ${store.channels.length} channels for user ${uid}`);
    } catch (err) {
        console.warn(`  ⚠️  Failed to load channels: ${err.message}`);
    }

    // Load campaigns (no orderBy to avoid needing composite indexes)
    try {
        const campaignsSnap = await db.collection('campaigns')
            .where('userId', '==', uid)
            .limit(100)
            .get();
        store.campaigns = campaignsSnap.docs
            .filter(d => d.id !== '_meta')
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt,
                };
            })
            .sort((a, b) => {
                const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
                const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
                return tb - ta;
            });
        console.log(`  🚀 Loaded ${store.campaigns.length} campaigns for user ${uid}`);
    } catch (err) {
        console.warn(`  ⚠️  Failed to load campaigns: ${err.message}`);
    }

    // Load email logs (no orderBy to avoid needing composite indexes)
    try {
        const logsSnap = await db.collection('emailLogs')
            .where('userId', '==', uid)
            .limit(200)
            .get();
        store.activityLogs = logsSnap.docs
            .filter(d => d.id !== '_meta')
            .map(d => {
                const data = d.data();
                const ts = data.sentAt?.toDate?.() || data.timestamp?.toDate?.() || data.sentAt || data.timestamp;
                return { id: d.id, ...data, timestamp: ts, sentAt: ts };
            })
            .sort((a, b) => {
                const ta = a.sentAt instanceof Date ? a.sentAt.getTime() : 0;
                const tb = b.sentAt instanceof Date ? b.sentAt.getTime() : 0;
                return tb - ta;
            });
        console.log(`  📧 Loaded ${store.activityLogs.length} email logs for user ${uid}`);
    } catch (err) {
        console.warn(`  ⚠️  Failed to load email logs: ${err.message}`);
    }

    // Compute analytics from loaded data
    store.analytics.totalChannels = store.channels.length;
    store.analytics.totalCampaigns = store.campaigns.length;
    store.analytics.totalEmailsSent = store.activityLogs
        .filter(l => l.action === 'email_send')
        .reduce((sum, l) => sum + (l.metadata?.sent || 0), 0);
    store.analytics.discoveryRuns = store.activityLogs
        .filter(l => l.action === 'discovery').length;
    const lastDiscovery = store.activityLogs.find(l => l.action === 'discovery');
    store.analytics.lastDiscoveryAt = lastDiscovery?.timestamp || null;

    store._loaded = true;
    console.log(`  📦 User ${uid} store ready: ${store.channels.length} channels, ${store.campaigns.length} campaigns, ${store.activityLogs.length} logs`);
    return store;
}

/**
 * Get or load user store. Uses a short TTL cache (60s) to ensure data
 * stays fresh from Firestore across sessions.
 */
const storeTimestamps = new Map();  // Track when each user store was loaded
const STORE_TTL_MS = 60_000;        // Refresh from Firestore every 60 seconds

async function getUserStore(uid) {
    const now = Date.now();
    const lastLoaded = storeTimestamps.get(uid) || 0;
    const isStale = (now - lastLoaded) > STORE_TTL_MS;

    if (userStores.has(uid) && !isStale) {
        return userStores.get(uid);
    }

    // Reload fresh from Firestore
    const store = await loadUserStore(uid);
    userStores.set(uid, store);
    storeTimestamps.set(uid, now);
    return store;
}

/**
 * Save a campaign to Firestore.
 */
async function saveCampaignToFirestore(campaign) {
    if (!db) return;
    try {
        await db.collection('campaigns').doc(campaign.id).set(campaign, { merge: true });
    } catch (err) {
        console.warn(`  ⚠️  Failed to save campaign: ${err.message}`);
    }
}

/**
 * Save an activity log to Firestore.
 */
async function saveActivityLog(log) {
    if (!db) return;
    try {
        await db.collection('emailLogs').doc(log.id).set(log, { merge: true });
    } catch (err) {
        console.warn(`  ⚠️  Failed to save activity log: ${err.message}`);
    }
}

/**
 * Update a channel's email status in Firestore.
 */
async function updateChannelEmailStatus(channelId, emailSent, emailSentDate) {
    if (!db) return;
    try {
        await db.collection('channels').doc(channelId).set({
            emailSent,
            emailSentDate,
            updatedAt: new Date(),
        }, { merge: true });
    } catch (err) {
        console.warn(`  ⚠️  Failed to update channel email status: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════
//  YouTube API Helper Functions
// ═══════════════════════════════════════════════════════════

/**
 * Search YouTube for channels matching keyword with pagination.
 * Uses multiple pages to gather more raw results.
 */
async function searchChannels(keyword, maxResults = 50, options = {}) {
    const { regionCode, relevanceLanguage } = options;
    const allItems = [];
    let pageToken = undefined;
    const perPage = 50; // max allowed by YouTube API
    const maxPages = Math.ceil(maxResults / perPage);

    for (let page = 0; page < maxPages; page++) {
        const params = {
            part: 'snippet',
            q: keyword,
            type: 'channel',
            maxResults: perPage,
            order: 'relevance',
        };
        if (regionCode) params.regionCode = regionCode;
        if (relevanceLanguage) params.relevanceLanguage = relevanceLanguage;
        if (pageToken) params.pageToken = pageToken;

        const response = await youtube.search.list(params);
        const items = response.data.items || [];
        allItems.push(...items);

        pageToken = response.data.nextPageToken;
        if (!pageToken || allItems.length >= maxResults) break;
    }

    return allItems;
}

/**
 * Get detailed channel statistics.
 */
async function getChannelDetails(channelIds) {
    if (channelIds.length === 0) return [];

    // YouTube API allows max 50 IDs per request
    const batches = [];
    for (let i = 0; i < channelIds.length; i += 50) {
        batches.push(channelIds.slice(i, i + 50));
    }

    const allChannels = [];
    for (const batch of batches) {
        const response = await youtube.channels.list({
            part: 'snippet,statistics,brandingSettings',
            id: batch.join(','),
        });
        if (response.data.items) {
            allChannels.push(...response.data.items);
        }
    }
    return allChannels;
}

/**
 * Get the latest videos for a channel to calculate average views.
 */
async function getRecentVideos(channelId, count = 5) {
    try {
        const searchResponse = await youtube.search.list({
            part: 'id',
            channelId: channelId,
            type: 'video',
            order: 'date',
            maxResults: count,
        });

        const videoIds = (searchResponse.data.items || [])
            .map(item => item.id.videoId)
            .filter(Boolean);

        if (videoIds.length === 0) return 0;

        const videoResponse = await youtube.videos.list({
            part: 'statistics',
            id: videoIds.join(','),
        });

        const views = (videoResponse.data.items || [])
            .map(v => parseInt(v.statistics.viewCount) || 0);

        return views.length > 0
            ? Math.round(views.reduce((a, b) => a + b, 0) / views.length)
            : 0;
    } catch {
        return 0;
    }
}

/**
 * Extract email from channel description.
 */
function extractEmail(text) {
    if (!text) return null;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    if (!matches) return null;

    // Filter out common non-business emails
    const filtered = matches.filter(email => {
        const lower = email.toLowerCase();
        return !lower.includes('example.com') &&
            !lower.includes('email.com') &&
            !lower.endsWith('.png') &&
            !lower.endsWith('.jpg');
    });

    return filtered[0] || null;
}

/**
 * Full discovery pipeline: search → details → filter → store.
 * Uses multiple search strategies and pagination to maximize results.
 * Prioritizes Indian creators (regionCode: IN).
 */
async function discoverChannels(keyword, filters = {}, userId) {
    const {
        minSubscribers = 0,
        maxSubscribers = Infinity,
        minAvgViews = 0,
        maxChannels = 20,
    } = filters;

    // We need to search for many more channels than requested,
    // because most won't have a public email.
    const searchTarget = Math.max(maxChannels * 5, 150);

    console.log(`  🔍 Searching YouTube for: "${keyword}"`);
    console.log(`  🎯 Target: ${maxChannels} channels with email`);
    console.log(`  📡 Will search up to ${searchTarget} raw channels\n`);

    // Step 1: Multi-strategy search to maximize results
    const seenChannelIds = new Set();
    const allSearchResults = [];

    // Strategy 1: India-specific search (prioritize Indian creators)
    console.log('  ── Strategy 1: India-region search ──');
    const indiaResults = await searchChannels(keyword, searchTarget, {
        regionCode: 'IN',
        relevanceLanguage: 'hi',
    });
    for (const item of indiaResults) {
        const id = item.snippet?.channelId;
        if (id && !seenChannelIds.has(id)) {
            seenChannelIds.add(id);
            allSearchResults.push(item);
        }
    }
    console.log(`  📡 India search: ${indiaResults.length} results (${allSearchResults.length} unique)`);

    // Strategy 2: India region with English relevance
    if (allSearchResults.length < searchTarget) {
        console.log('  ── Strategy 2: India + English search ──');
        const indiaEnResults = await searchChannels(keyword, searchTarget - allSearchResults.length, {
            regionCode: 'IN',
            relevanceLanguage: 'en',
        });
        let added = 0;
        for (const item of indiaEnResults) {
            const id = item.snippet?.channelId;
            if (id && !seenChannelIds.has(id)) {
                seenChannelIds.add(id);
                allSearchResults.push(item);
                added++;
            }
        }
        console.log(`  📡 India+EN search: ${indiaEnResults.length} results (+${added} new unique)`);
    }

    // Strategy 3: Global fallback (no region filter)
    if (allSearchResults.length < searchTarget) {
        console.log('  ── Strategy 3: Global fallback search ──');
        const globalResults = await searchChannels(keyword + ' India', searchTarget - allSearchResults.length);
        let added = 0;
        for (const item of globalResults) {
            const id = item.snippet?.channelId;
            if (id && !seenChannelIds.has(id)) {
                seenChannelIds.add(id);
                allSearchResults.push(item);
                added++;
            }
        }
        console.log(`  📡 Global search: ${globalResults.length} results (+${added} new unique)`);
    }

    console.log(`\n  📊 Total unique channels to process: ${allSearchResults.length}`);

    // Step 2: Get detailed info (in batches of 50)
    const channelIds = allSearchResults.map(r => r.snippet.channelId);
    const detailedChannels = await getChannelDetails(channelIds);
    console.log(`  📊 Retrieved details for ${detailedChannels.length} channels`);

    // Step 3: Filter — only keep channels with a public email (required for outreach)
    const validChannels = [];
    let skippedNoEmail = 0;
    let skippedSubs = 0;
    let skippedViews = 0;

    for (const ch of detailedChannels) {
        if (validChannels.length >= maxChannels) break;

        const subs = parseInt(ch.statistics?.subscriberCount) || 0;

        if (subs < minSubscribers || subs > maxSubscribers) { skippedSubs++; continue; }
        if (ch.statistics?.hiddenSubscriberCount) { skippedSubs++; continue; }

        // Extract email from description — MUST have email to be useful for outreach
        const description = ch.snippet?.description || '';
        const email = extractEmail(description);
        if (!email) {
            skippedNoEmail++;
            continue;
        }

        // Get average views (only for channels that have email + pass subscriber filter)
        let avgViews = 0;
        try {
            avgViews = await getRecentVideos(ch.id, 5);
        } catch {
            avgViews = Math.round(parseInt(ch.statistics?.viewCount || 0) /
                Math.max(parseInt(ch.statistics?.videoCount || 1), 1));
        }

        if (avgViews < minAvgViews) { skippedViews++; continue; }

        const channel = {
            id: ch.id,
            channelId: ch.id,
            channelName: ch.snippet.title,
            channelUrl: `https://www.youtube.com/channel/${ch.id}`,
            thumbnailUrl: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url || '',
            subscribers: subs,
            totalViews: parseInt(ch.statistics?.viewCount) || 0,
            videoCount: parseInt(ch.statistics?.videoCount) || 0,
            avgViews,
            category: ch.snippet?.customUrl ? 'Custom' : (ch.topicDetails?.topicCategories?.[0]?.split('/').pop() || 'General'),
            email: email,
            description: description.slice(0, 500),
            country: ch.snippet?.country || 'Unknown',
            scrapedAt: new Date(),
            emailSent: false,
            emailSentDate: null,
        };

        validChannels.push(channel);
        console.log(`  ✅ [${validChannels.length}/${maxChannels}] ${ch.snippet.title} — ${email} (${subs.toLocaleString()} subs)`);
    }

    console.log(`\n  ═══ Filter Summary ═══`);
    console.log(`  ✅ ${validChannels.length} channels with email passed all filters`);
    console.log(`  📧 ${skippedNoEmail} skipped (no public email)`);
    console.log(`  👥 ${skippedSubs} skipped (subscriber count out of range)`);
    console.log(`  👁️ ${skippedViews} skipped (avg views too low)`);

    // Step 4: Store in user's memory (avoid duplicates)
    const store = await getUserStore(userId);
    let newCount = 0;
    for (const ch of validChannels) {
        const existing = store.channels.findIndex(c => c.channelId === ch.channelId);
        if (existing === -1) {
            store.channels.unshift(ch);
            newCount++;
        } else {
            // Update existing channel data
            store.channels[existing] = { ...store.channels[existing], ...ch, emailSent: store.channels[existing].emailSent };
        }
    }

    // Step 5: Save to Firestore (persistent storage)
    if (firestoreAvailable && db && validChannels.length > 0) {
        try {
            await saveChannelsToFirestore(validChannels, userId);
            console.log(`  🔥 Saved ${validChannels.length} channels to Firestore`);
        } catch (fsErr) {
            console.warn(`  ⚠️  Firestore save failed: ${fsErr.message}`);
        }
    }

    // Update analytics
    store.analytics.totalChannels = store.channels.length;
    store.analytics.discoveryRuns++;
    store.analytics.lastDiscoveryAt = new Date();

    // Log activity
    store.activityLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'discovery',
        userId: userId,
        metadata: { channelsFound: validChannels.length, newChannels: newCount, keyword },
        timestamp: new Date(),
    });

    return {
        channels: validChannels,
        totalFound: validChannels.length,
        newChannels: newCount,
        totalProcessed: allSearchResults.length,
    };
}

/**
 * Save channels to Firestore with duplicate prevention.
 * Uses channelId as document ID so duplicates are merged.
 */
async function saveChannelsToFirestore(channels, userId) {
    if (!db) return;

    const BATCH_LIMIT = 500; // Firestore batch limit
    for (let i = 0; i < channels.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const chunk = channels.slice(i, i + BATCH_LIMIT);

        for (const ch of chunk) {
            const docRef = db.collection('channels').doc(ch.channelId);
            batch.set(docRef, {
                channelId: ch.channelId,
                channelName: ch.channelName,
                channelUrl: ch.channelUrl,
                subscribers: ch.subscribers,
                avgViews: ch.avgViews,
                niche: ch.category || 'General',
                email: ch.email || null,
                emailSent: ch.emailSent || false,
                description: (ch.description || '').slice(0, 500),
                country: ch.country || 'Unknown',
                thumbnailUrl: ch.thumbnailUrl || '',
                totalViews: ch.totalViews || 0,
                videoCount: ch.videoCount || 0,
                createdByUserId: userId,
                scrapedAt: ch.scrapedAt || new Date(),
                updatedAt: new Date(),
            }, { merge: true });
        }

        await batch.commit();
    }
}

// ── Firebase Auth middleware (verifies token + email verification) ──
async function firebaseAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!adminAuth) {
        return res.status(503).json({ error: 'Authentication service not available' });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(idToken);

        // Check email verification
        if (!decoded.email_verified) {
            return res.status(403).json({
                error: 'Email not verified. Please check your inbox and verify your email before continuing.',
                code: 'EMAIL_NOT_VERIFIED',
            });
        }

        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name || decoded.email,
            emailVerified: decoded.email_verified,
        };
        next();
    } catch (error) {
        console.warn('  ⚠️  Auth verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ═══════════════════════════════════════════════════════════
//  Health Check
// ═══════════════════════════════════════════════════════════
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        mode: YOUTUBE_API_KEY ? 'live' : 'no-api-key',
        apiKeyConfigured: !!YOUTUBE_API_KEY,
        timestamp: new Date().toISOString(),
    });
});

// ═══════════════════════════════════════════════════════════
//  Auth Routes
// ═══════════════════════════════════════════════════════════

// Validate secret key AND auto-verify user email (called right after Firebase account creation)
app.post('/api/auth/validate-signup', async (req, res) => {
    const { secretKey, uid } = req.body;

    // Step 1: Validate secret key
    if (!secretKey || secretKey !== SIGNUP_SECRET_KEY) {
        // If uid was provided, delete the Firebase account since key is invalid
        if (uid && adminAuth) {
            try { await adminAuth.deleteUser(uid); } catch { }
        }
        return res.status(403).json({ error: 'Invalid secret key. You are not authorized to create an account.' });
    }

    // Step 2: Auto-verify email via Admin SDK (bypass unreliable Firebase email delivery)
    if (uid && adminAuth) {
        try {
            await adminAuth.updateUser(uid, { emailVerified: true });
            console.log(`  ✅ Auto-verified email for user ${uid}`);
        } catch (err) {
            console.warn(`  ⚠️  Failed to verify email: ${err.message}`);
        }
    }

    res.json({ valid: true, verified: true });
});

// Login (called AFTER Firebase sign-in to save user profile)
app.post('/api/auth/login', firebaseAuth, async (req, res) => {
    const user = req.user;

    // Save/update user profile in Firestore
    if (firestoreAvailable && db) {
        try {
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                name: user.name,
                lastLoginAt: new Date(),
            }, { merge: true });
        } catch (err) {
            console.warn('  ⚠️  Failed to save user profile:', err.message);
        }
    }

    res.json({ user });
});

// ═══════════════════════════════════════════════════════════
//  Analytics Routes
// ═══════════════════════════════════════════════════════════
app.get('/api/analytics', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    res.json({
        data: {
            ...store.analytics,
            recentActivity: store.activityLogs.slice(0, 30),
        },
    });
});

// ═══════════════════════════════════════════════════════════
//  Channel Routes — REAL YouTube API
// ═══════════════════════════════════════════════════════════
app.get('/api/channels', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    let filtered = [...store.channels];

    if (req.query.emailSent === 'true') {
        filtered = filtered.filter((ch) => ch.emailSent);
    } else if (req.query.emailSent === 'false') {
        filtered = filtered.filter((ch) => !ch.emailSent);
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    res.json({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
});

app.get('/api/channels/:id', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    const ch = store.channels.find((c) => c.id === req.params.id);
    if (!ch) return res.status(404).json({ error: 'Channel not found' });
    res.json({ data: ch });
});

app.post('/api/channels/discover', firebaseAuth, async (req, res) => {
    if (!YOUTUBE_API_KEY) {
        return res.status(503).json({
            error: 'YouTube API key not configured. Set YOUTUBE_API_KEY in backend/.env',
        });
    }

    try {
        const filters = {
            keyword: req.body.keyword || 'technology',
            minSubscribers: parseInt(req.body.minSubscribers) || 0,
            maxSubscribers: parseInt(req.body.maxSubscribers) || 10000000,
            minAvgViews: parseInt(req.body.minAvgViews) || 0,
            maxChannels: Math.min(parseInt(req.body.maxChannels) || 20, 50),
        };

        console.log('\n  ═══ Discovery Pipeline Started ═══');
        console.log(`  Keyword: "${filters.keyword}"`);
        console.log(`  Subs: ${filters.minSubscribers.toLocaleString()} – ${filters.maxSubscribers.toLocaleString()}`);
        console.log(`  Min Avg Views: ${filters.minAvgViews.toLocaleString()}`);
        console.log(`  Max Channels: ${filters.maxChannels}\n`);

        const result = await discoverChannels(filters.keyword, filters, req.user.uid);

        console.log(`\n  ═══ Discovery Complete ═══`);
        console.log(`  Total found: ${result.totalFound}`);
        console.log(`  New channels: ${result.newChannels}`);
        console.log(`  With email: ${result.channels.filter(c => c.email).length}\n`);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('  ❌ Discovery error:', error.message);

        if (error.message.includes('API key')) {
            return res.status(401).json({ error: 'Invalid YouTube API key. Please check your key.' });
        }

        res.status(500).json({ error: `Discovery failed: ${error.message}` });
    }
});

// ═══════════════════════════════════════════════════════════
//  Campaign Routes
// ═══════════════════════════════════════════════════════════
app.get('/api/campaigns', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    res.json({ data: store.campaigns });
});

app.get('/api/campaigns/:id', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    const c = store.campaigns.find((c) => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ data: c });
});

app.post('/api/campaigns', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    const campaign = {
        id: `camp-${Date.now()}`,
        campaignName: req.body.campaignName || 'Untitled Campaign',
        subject: req.body.subject || '',
        bodyTemplate: req.body.bodyTemplate || '',
        totalChannels: 0,
        emailsSent: 0,
        userId: req.user.uid,
        createdAt: new Date(),
    };

    store.campaigns.unshift(campaign);
    store.analytics.totalCampaigns++;

    // Persist to Firestore
    await saveCampaignToFirestore(campaign);

    res.status(201).json({ success: true, data: campaign });
});

// ═══════════════════════════════════════════════════════════
//  SMTP Settings Routes
// ═══════════════════════════════════════════════════════════
let smtpSettings = null;
let smtpTransporter = null;

// Load SMTP settings from Firestore on startup
async function loadSmtpSettings() {
    if (!firestoreAvailable || !db) return;
    try {
        const doc = await db.collection('systemSettings').doc('smtp').get();
        if (doc.exists) {
            smtpSettings = doc.data();
            _createTransporter();
            console.log('  📧 SMTP settings loaded from Firestore');
        }
    } catch (err) {
        console.warn(`  ⚠️  Failed to load SMTP settings: ${err.message}`);
    }
}

function _createTransporter() {
    if (!smtpSettings || !smtpSettings.smtpHost) return;
    smtpTransporter = nodemailer.createTransport({
        host: smtpSettings.smtpHost,
        port: smtpSettings.smtpPort || 587,
        secure: smtpSettings.smtpPort === 465,
        auth: {
            user: smtpSettings.smtpUser,
            pass: smtpSettings.smtpPassword,
        },
    });
}

function _personalize(template, channel) {
    if (!template) return '';
    return template
        .replace(/\{\{channelName\}\}/g, channel.channelName || '')
        .replace(/\{\{subscribers\}\}/g, (channel.subscribers || 0).toLocaleString())
        .replace(/\{\{avgViews\}\}/g, (channel.avgViews || 0).toLocaleString())
        .replace(/\{\{channelUrl\}\}/g, channel.channelUrl || '')
        .replace(/\{\{email\}\}/g, channel.email || '');
}

app.get('/api/settings/smtp', firebaseAuth, async (req, res) => {
    try {
        if (firestoreAvailable && db) {
            const doc = await db.collection('systemSettings').doc('smtp').get();
            if (!doc.exists) return res.json({ data: null });
            const data = { ...doc.data() };
            delete data.smtpPassword; // Omit password for security
            return res.json({ data });
        }
        // Fallback to in-memory
        if (smtpSettings) {
            const data = { ...smtpSettings };
            delete data.smtpPassword;
            return res.json({ data });
        }
        res.json({ data: null });
    } catch (err) {
        res.status(500).json({ error: `Failed to load SMTP settings: ${err.message}` });
    }
});

app.post('/api/settings/smtp', firebaseAuth, async (req, res) => {
    try {
        const { senderEmail, smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;

        const updateData = {
            senderEmail,
            smtpHost,
            smtpPort: parseInt(smtpPort, 10) || 587,
            smtpUser,
            updatedAt: new Date(),
        };

        // Only update password if provided
        if (smtpPassword) {
            updateData.smtpPassword = smtpPassword;
        }

        // Save to Firestore
        if (firestoreAvailable && db) {
            await db.collection('systemSettings').doc('smtp').set(updateData, { merge: true });
        }

        // Update in-memory settings
        smtpSettings = { ...smtpSettings, ...updateData };
        _createTransporter();

        console.log(`  📧 SMTP settings updated by user ${req.user.uid}`);
        res.json({ success: true, message: 'SMTP settings saved successfully' });
    } catch (err) {
        res.status(500).json({ error: `Failed to save SMTP settings: ${err.message}` });
    }
});

// ═══════════════════════════════════════════════════════════
//  Email Routes (with real Nodemailer sending)
// ═══════════════════════════════════════════════════════════

// In-memory email log store (also persisted to Firestore)
const emailLogs = [];

app.get('/api/emails/history', firebaseAuth, async (req, res) => {
    // Try Firestore first (no orderBy to avoid composite index requirement)
    if (firestoreAvailable && db) {
        try {
            const snap = await db.collection('emailLogs')
                .where('userId', '==', req.user.uid)
                .limit(200)
                .get();
            const data = snap.docs
                .filter(d => d.id !== '_meta')
                .map(d => {
                    const raw = d.data();
                    const ts = raw.sentAt?.toDate?.() || raw.timestamp?.toDate?.() || raw.sentAt || raw.timestamp;
                    return { id: d.id, ...raw, sentAt: ts };
                })
                .sort((a, b) => {
                    const ta = a.sentAt instanceof Date ? a.sentAt.getTime() : 0;
                    const tb = b.sentAt instanceof Date ? b.sentAt.getTime() : 0;
                    return tb - ta;
                });
            return res.json({ data });
        } catch (err) {
            console.warn(`  ⚠️  Firestore emailLogs read failed: ${err.message}`);
        }
    }
    // Fallback to in-memory logs for this user
    const userLogs = emailLogs.filter(l => l.userId === req.user.uid);
    res.json({ data: userLogs });
});

app.post('/api/emails/send', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    const { campaignId, channelIds = [] } = req.body;

    const campaign = store.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Reload SMTP settings if transporter is missing
    if (!smtpTransporter) {
        await loadSmtpSettings();
    }

    if (!smtpTransporter || !smtpSettings) {
        return res.status(400).json({ error: 'SMTP not configured. Please set up your email settings first.' });
    }

    let sent = 0;
    let failed = 0;

    for (const chId of channelIds) {
        const ch = store.channels.find((c) => c.id === chId || c.channelId === chId);
        if (!ch || !ch.email) { failed++; continue; }

        const personalizedSubject = _personalize(campaign.subject, ch);
        const personalizedBody = _personalize(campaign.bodyTemplate, ch);

        try {
            await smtpTransporter.sendMail({
                from: `"${smtpSettings.senderEmail}" <${smtpSettings.senderEmail}>`,
                to: ch.email,
                subject: personalizedSubject,
                html: personalizedBody,
            });

            ch.emailSent = true;
            ch.emailSentDate = new Date();
            sent++;
            console.log(`  ✅ Email sent to ${ch.email} (${ch.channelName})`);

            // Persist channel email status
            updateChannelEmailStatus(ch.channelId || ch.id, true, ch.emailSentDate);

            // Log per-channel entry
            const logEntry = {
                id: `elog-${Date.now()}-${sent}`,
                channelId: ch.channelId || ch.id,
                channelName: ch.channelName,
                email: ch.email,
                subject: personalizedSubject,
                status: 'Sent',
                sentAt: new Date(),
                userId: req.user.uid,
            };
            emailLogs.unshift(logEntry);

            // Persist to Firestore emailLogs
            if (firestoreAvailable && db) {
                try { await db.collection('emailLogs').add(logEntry); } catch {}
            }

            // Rate limit: 7 second delay between emails
            if (channelIds.indexOf(chId) < channelIds.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 7000));
            }
        } catch (err) {
            failed++;
            console.error(`  ❌ Failed to send to ${ch.email}: ${err.message}`);

            const failLog = {
                id: `elog-${Date.now()}-f${failed}`,
                channelId: ch.channelId || ch.id,
                channelName: ch.channelName,
                email: ch.email,
                subject: personalizedSubject,
                status: `Failed`,
                sentAt: new Date(),
                userId: req.user.uid,
            };
            emailLogs.unshift(failLog);

            if (firestoreAvailable && db) {
                try { await db.collection('emailLogs').add(failLog); } catch {}
            }
        }
    }

    campaign.emailsSent = (campaign.emailsSent || 0) + sent;
    store.analytics.totalEmailsSent += sent;

    // Persist campaign update
    await saveCampaignToFirestore(campaign);

    // Also add aggregate activity log
    const log = {
        id: `log-${Date.now()}`, action: 'email_send', userId: req.user.uid,
        metadata: { campaignId, campaignName: campaign.campaignName, sent, failed },
        timestamp: new Date(),
    };
    store.activityLogs.unshift(log);
    await saveActivityLog(log);

    res.json({ success: true, data: { sent, failed } });
});

// ═══════════════════════════════════════════════════════════
//  Sheets Routes
// ═══════════════════════════════════════════════════════════
app.get('/api/sheets/status', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    let rowCount = store.channels.length;
    if (sheetsService) {
        try {
            rowCount = await sheetsService.getRowCount();
        } catch { /* fallback to in-memory count */ }
    }
    res.json({
        data: {
            configured: !!sheetsService,
            spreadsheetId: SHEET_ID || 'not-configured',
            rowCount,
        },
    });
});

app.post('/api/sheets/sync', firebaseAuth, async (req, res) => {
    const store = await getUserStore(req.user.uid);
    if (sheetsService && store.channels.length > 0) {
        try {
            const result = await sheetsService.appendChannelsToSheet(store.channels);
            return res.json({ success: true, data: { syncedCount: result.appended } });
        } catch (err) {
            return res.status(500).json({ error: `Sheets sync failed: ${err.message}` });
        }
    }
    res.json({
        success: true,
        data: { syncedCount: store.channels.length },
    });
});

// ── Error handler ──
app.use((err, _req, res, _next) => {
    console.error('Error:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ──
async function startServer() {
    // Initialize Firestore collections
    if (firestoreAvailable && initCollections) {
        try {
            await initCollections();
        } catch (err) {
            console.warn(`  ⚠️  Collection init failed: ${err.message}`);
        }
    }

    // Load SMTP settings from Firestore
    await loadSmtpSettings();

    app.listen(PORT, () => {
        console.log('');
        console.log('  ╔══════════════════════════════════════════════════════╗');
        console.log('  ║  CreatorFind — API Server                            ║');
        console.log(`  ║  Running on http://localhost:${PORT}                    ║`);
        console.log(`  ║  YouTube API: ${YOUTUBE_API_KEY ? '✅ CONFIGURED' : '❌ NOT SET'}                       ║`);
        console.log(`  ║  Sheets API:  ${sheetsService ? '✅ CONFIGURED' : '⚠️  NOT SET'}                       ║`);
        console.log(`  ║  Firestore:   ${firestoreAvailable ? '✅ CONFIGURED' : '⚠️  NOT SET'}                       ║`);
        console.log('  ╚══════════════════════════════════════════════════════╝');
        console.log('');
        if (!YOUTUBE_API_KEY) {
            console.log('  ⚠️  Set YOUTUBE_API_KEY in backend/.env to enable live discovery');
        } else {
            console.log('  🔑 YouTube API key loaded');
        }
        if (!sheetsService) {
            console.log('  ⚠️  Set GOOGLE_SHEETS_CREDENTIALS + GOOGLE_SHEET_ID in .env for auto-sheet sync');
        } else {
            console.log(`  📊 Sheets target: ${SHEET_ID}`);
        }
        if (firestoreAvailable) {
            console.log('  🔥 Firestore: persistent storage enabled');
        } else {
            console.log('  ⚠️  Set FIREBASE_SERVICE_ACCOUNT in .env for Firestore persistence');
        }
        console.log(`  👥 Active users: ${userStores.size}`);
        console.log(`  🔐 Signup key: required`);
        console.log('');
    });
}

startServer();
