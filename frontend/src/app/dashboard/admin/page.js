'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { Lock, Users, Tv, Rocket } from 'lucide-react';
import api from '@/lib/api';
import StatsCard from '@/components/StatsCard';

export default function AdminPage() {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, usersRes] = await Promise.all([
                api.getAdminStats(),
                api.getAdminUsers()
            ]);
            setStats(statsRes.stats);
            setUsers(usersRes.users);
        } catch (err) {
            if (err.message.includes('403') || err.message.includes('Forbidden')) {
                setError('Access denied. Admin privileges required.');
            } else {
                setError(err.message || 'Failed to load admin data');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDeleteUser = async (id, email) => {
        if (!confirm(`Are you sure you want to permanently delete user ${email}? This cannot be undone.`)) return;
        
        try {
            await api.deleteAdminUser(id);
            fetchData(); // Refresh
        } catch (err) {
            alert(err.message || 'Failed to delete user');
        }
    };

    if (loading && !stats) {
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
                    <Lock size={24} color="#ff6b6b" /> <span style={{ marginLeft: 8 }}>{error}</span>
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
                    icon={<Users size={24} />}
                    gradient="brand"
                />
                <StatsCard
                    label="Total Channels"
                    value={stats?.totalChannels || 0}
                    icon={<Tv size={24} />}
                    gradient="blue"
                />
                <StatsCard
                    label="Total Campaigns"
                    value={stats?.totalCampaigns || 0}
                    icon={<Rocket size={24} />}
                    gradient="green"
                />
                <StatsCard
                    label="API Quota Used Today"
                    value={stats?.dailyYoutubeApiQuotaUsed || 0}
                    icon="⚡"
                    gradient="orange"
                />
            </div>

            {/* User Management Section */}
            <div style={{
                marginTop: 24,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>User Management</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '12px 24px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Name / Email</th>
                                <th style={{ textAlign: 'center', padding: '12px 24px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Role</th>
                                <th style={{ textAlign: 'center', padding: '12px 24px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Channels</th>
                                <th style={{ textAlign: 'center', padding: '12px 24px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Campaigns</th>
                                <th style={{ textAlign: 'right', padding: '12px 24px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name || 'No Name'}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                        <span className={`badge ${user.role === 'admin' ? 'badge-success' : 'badge-info'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600 }}>{user.channelCount}</td>
                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600 }}>{user.campaignCount}</td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id, user.email)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(255,107,107,0.1)',
                                                color: '#ff6b6b',
                                                border: '1px solid rgba(255,107,107,0.2)',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.target.style.background = 'rgba(255,107,107,0.2)'}
                                            onMouseOut={(e) => e.target.style.background = 'rgba(255,107,107,0.1)'}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* System Status */}
            <div style={{
                marginTop: 24,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                    API Status
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(46,229,157,0.06)',
                        border: '1px solid rgba(46,229,157,0.1)',
                    }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>YouTube API Usage</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                            {stats?.dailyYoutubeApiQuotaUsed || 0} / {stats?.quotaLimit || 10000} units
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
