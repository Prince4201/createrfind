'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import { BarChartWidget, LineChartWidget } from '@/components/Chart';
import { Tv, Mail, Rocket, Search, ArrowRight, Activity, PlusCircle, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getAnalytics()
            .then((res) => setAnalytics(res.data))
            .catch((err) => { console.error('Failed to load analytics:', err); })
            .finally(() => setLoading(false));
    }, []);

    // Real chart data from analytics API
    const activityData = analytics?.discoveryChartData?.length > 0
        ? analytics.discoveryChartData
        : [{ date: 'No data', count: 0 }];

    const emailData = analytics?.emailChartData?.length > 0
        ? analytics.emailChartData
        : [{ date: 'No data', sent: 0 }];

    return (
        <div className="page-container">
            <h2 className="page-title">Dashboard Overview</h2>
            <p className="page-subtitle">Monitor your creator discovery and outreach performance</p>

            <div className="stats-grid">
                <StatsCard
                    label="Total Channels"
                    value={analytics?.totalChannels || 0}
                    icon={<Tv size={24} />}
                    gradient="brand"
                />
                <StatsCard
                    label="Emails Sent"
                    value={analytics?.totalEmailsSent || 0}
                    icon={<Mail size={24} />}
                    gradient="blue"
                />
                <StatsCard
                    label="Campaigns"
                    value={analytics?.totalCampaigns || 0}
                    icon={<Rocket size={24} />}
                    gradient="green"
                />
                <StatsCard
                    label="Discovery Runs"
                    value={analytics?.recentActivity?.filter(a => a.action === 'discovery').length || 0}
                    icon={<Search size={24} />}
                    gradient="orange"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <BarChartWidget
                    data={activityData}
                    xKey="date"
                    yKey="count"
                    title="Discovery Activity"
                    color="#7C6AFF"
                />
                <LineChartWidget
                    data={emailData}
                    xKey="date"
                    yKey="sent"
                    title="Emails Sent Over Time"
                    color="#5B9AFF"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* Recent Activity Feed */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Activity size={20} color="var(--brand)" />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Activity</h3>
                    </div>
                    {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {analytics.recentActivity.slice(0, 4).map((activity, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', paddingBottom: '16px', borderBottom: idx !== 3 ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <div style={{ 
                                        width: '32px', height: '32px', borderRadius: '50%', 
                                        background: activity.action === 'discovery' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(124, 106, 255, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                    }}>
                                        {activity.action === 'discovery' ? <Search size={14} color="var(--accent-cyan)" /> : <Mail size={14} color="var(--brand)" />}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '2px' }}>
                                            {activity.action === 'discovery' ? `Discovered ${activity.metadata?.channelsFound || 0} channels` : `Sent campaign emails`}
                                        </p>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {new Date(activity.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            No recent activity recorded
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link href="/dashboard/discover" style={{ textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', transition: 'all var(--transition-fast)' }} className="quick-action-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ background: 'var(--gradient-brand)', padding: '10px', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                                        <Search size={18} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Find New Creators</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Search YouTube for new channels</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} color="var(--text-muted)" />
                            </div>
                        </Link>
                        
                        <Link href="/dashboard/campaigns" style={{ textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', transition: 'all var(--transition-fast)' }} className="quick-action-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ background: 'var(--gradient-green)', padding: '10px', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                                        <PlusCircle size={18} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Create Campaign</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Draft a new email outreach</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} color="var(--text-muted)" />
                            </div>
                        </Link>

                        <Link href="/dashboard/sheets" style={{ textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', transition: 'all var(--transition-fast)' }} className="quick-action-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ background: 'var(--gradient-orange)', padding: '10px', borderRadius: 'var(--radius-sm)', color: 'white' }}>
                                        <FileSpreadsheet size={18} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Sync to Sheets</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Export latest channel data</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} color="var(--text-muted)" />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
