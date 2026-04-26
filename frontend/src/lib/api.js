import { createClient } from '@/utils/supabase/client';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://createrfind-backend.onrender.com').replace(/\/$/, '');
const IS_DEV = process.env.NODE_ENV === 'development';

// Cache supabase client singleton — avoids re-creating on every API call
let _supabase = null;
const getSupabase = () => {
    if (!_supabase) _supabase = createClient();
    return _supabase;
};

async function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };

    try {
        const supabase = getSupabase();
        // getSession() reads from local storage (instant), getUser() hits the network
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
            console.warn('[API] No active session found. Request may fail auth.');
        } else {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            console.log("TOKEN:", session.access_token.substring(0, 20) + "..."); // Truncated for security
        }
    } catch (error) {
        console.error('[API] Error fetching auth session:', error);
    }
    return headers;
}

async function request(path, options = {}) {
    const headers = await getHeaders();
    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    
    console.log("API URL:", API_BASE);
    
    if (IS_DEV) {
        console.log(`[API] Request: ${options.method || 'GET'} ${url}`);
    }

    try {
        const res = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers },
        });

        if (!res.ok) {
            let errorMsg = `HTTP ${res.status}`;
            if (res.status === 401) errorMsg = '401 Unauthorized';
            
            try {
                const errorData = await res.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                // Ignore json parse error
            }
            throw new Error(errorMsg);
        }

        return await res.json();
    } catch (error) {
        // Catch CORS or Network errors
        console.error(`[Fetch Error] on ${url}:`, error.message);
        throw error;
    }
}

const api = {
    // Auth
    verifyToken: () => request('/api/auth/verify', { method: 'POST' }),
    getProfile: () => request('/api/auth/profile'),
    updateProfile: (data) => request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

    // Channels
    discoverChannels: (filters) => request('/api/channels/discover', { method: 'POST', body: JSON.stringify(filters) }),
    getDiscoverStatus: (searchHistoryId) => request(`/api/channels/discover/status/${searchHistoryId}`),
    getChannels: (params = '') => request(`/api/channels?${params}`),
    getChannel: (id) => request(`/api/channels/${id}`),

    // Campaigns
    createCampaign: (data) => request('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    getCampaigns: (params = '') => request(`/api/campaigns?${params}`),
    getCampaign: (id) => request(`/api/campaigns/${id}`),
    updateCampaign: (id, data) => request(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCampaign: (id) => request(`/api/campaigns/${id}`, { method: 'DELETE' }),

    // Emails
    sendEmails: (data) => request('/api/emails/send', { method: 'POST', body: JSON.stringify(data) }),
    getEmailHistory: (params = '') => request(`/api/emails/history?${params}`),

    // Analytics
    getAnalytics: () => request('/api/dashboard-stats'),

    // Sheets
    syncSheets: () => request('/api/sheets/sync', { method: 'POST' }),
    getSheetsStatus: () => request('/api/sheets/status'),
    updateSheetSettings: (data) => request('/api/sheets/settings', { method: 'POST', body: JSON.stringify(data) }),

    // Settings
    getSmtpSettings: () => request('/api/settings/smtp'),
    updateSmtpSettings: (data) => request('/api/settings/smtp', { method: 'POST', body: JSON.stringify(data) }),
    testSmtpConnection: () => request('/api/settings/smtp/test', { method: 'POST' }),

    // Admin
    getAdminStats: () => request('/api/admin/stats'),
    getAdminUsers: () => request('/api/admin/users'),
    deleteAdminUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
};

export default api;
