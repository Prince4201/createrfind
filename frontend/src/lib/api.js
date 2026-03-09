import { auth } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };

    // Get Firebase auth token
    try {
        const user = auth.currentUser;
        if (user) {
            const token = await user.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }
    } catch {
        // Not authenticated
    }
    return headers;
}

async function request(path, options = {}) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
}

const api = {
    // Auth
    login: (idToken) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ idToken }) }),

    // Channels
    discoverChannels: (filters) => request('/api/channels/discover', { method: 'POST', body: JSON.stringify(filters) }),
    getChannels: (params = '') => request(`/api/channels?${params}`),
    getChannel: (id) => request(`/api/channels/${id}`),

    // Campaigns
    createCampaign: (data) => request('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    getCampaigns: (params = '') => request(`/api/campaigns?${params}`),
    getCampaign: (id) => request(`/api/campaigns/${id}`),

    // Emails
    sendEmails: (data) => request('/api/emails/send', { method: 'POST', body: JSON.stringify(data) }),
    getEmailHistory: (params = '') => request(`/api/emails/history?${params}`),

    // Analytics
    getAnalytics: () => request('/api/analytics'),

    // Sheets
    syncSheets: () => request('/api/sheets/sync', { method: 'POST' }),
    getSheetsStatus: () => request('/api/sheets/status'),
    
    // Settings
    getSmtpSettings: () => request('/api/settings/smtp'),
    updateSmtpSettings: (data) => request('/api/settings/smtp', { method: 'POST', body: JSON.stringify(data) }),
};

export default api;
