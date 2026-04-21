'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatsCard from '@/components/StatsCard';

export default function AdminPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.getAdminStats()
            .then((res) => setStats(res.stats))
            .catch((err) => {
                if (err.message.includes('403') || err.message.includes('Forbidden')) {
                    setError('Access denied. Admin privileges required.');
                } else {
                    setError(err.message || 'Failed to load admin stats');
                }
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page-container">
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading Admin Dashboard...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container">
                <h2 className="page-title">Admin Dashboard</h2>
                <div style={{
                    marginTop: 20,
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,107,107,0.08)',
                    border: '1px solid rgba(255,107,107,0.15)',
                    color: '#ff6b6b',
                    fontSize: '0.9rem',
                }}>
                    🔒 {error}
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h2 className="page-title">Admin Dashboard</h2>
            <p className="page-subtitle">System overview — users, channels, campaigns, and API usage</p>

            <div className="stats-grid">
                <StatsCard
                    label="Total Users"
                    value={stats?.totalUsers || 0}
                    icon="👥"
                    gradient="brand"
                />
                <StatsCard
                    label="Total Channels"
                    value={stats?.totalChannels || 0}
                    icon="📺"
                    gradient="blue"
                />
                <StatsCard
                    label="Total Campaigns"
                    value={stats?.totalCampaigns || 0}
                    icon="🚀"
                    gradient="green"
                />
                <StatsCard
                    label="API Quota Used Today"
                    value={stats?.dailyYoutubeApiQuotaUsed || 0}
                    icon="⚡"
                    gradient="orange"
                />
            </div>

            <div style={{
                marginTop: 24,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                    System Status
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(46,229,157,0.06)',
                        border: '1px solid rgba(46,229,157,0.1)',
                    }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>YouTube API</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                            {stats?.dailyYoutubeApiQuotaUsed || 0} / {stats?.quotaLimit || 10000} units
                        </div>
                        <div style={{
                            marginTop: 8, height: 4, borderRadius: 2,
                            background: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${Math.min(((stats?.dailyYoutubeApiQuotaUsed || 0) / (stats?.quotaLimit || 10000)) * 100, 100)}%`,
                                background: 'var(--accent-green)',
                                borderRadius: 2,
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                    </div>
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(91,154,255,0.06)',
                        border: '1px solid rgba(91,154,255,0.1)',
                    }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Database</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#5B9AFF' }}>
                            Supabase PostgreSQL
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            RLS Enabled • Service Role Active
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
