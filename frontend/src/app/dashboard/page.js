'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import { BarChartWidget, LineChartWidget } from '@/components/Chart';
import { Tv, Mail, Rocket, Search } from 'lucide-react';

export default function DashboardPage() {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getAnalytics()
            .then((res) => setAnalytics(res.data))
            .catch((err) => { console.error('Failed to load analytics:', err); })
            .finally(() => setLoading(false));
    }, []);

    // Mock chart data from recent activity
    const activityData = analytics?.recentActivity
        ? analytics.recentActivity
            .filter((a) => a.timestamp)
            .slice(0, 7)
            .reverse()
            .map((a) => ({
                date: new Date(a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                count: a.metadata?.channelsFound || a.metadata?.sent || 1,
            }))
        : [
            { date: 'Mon', count: 12 },
            { date: 'Tue', count: 19 },
            { date: 'Wed', count: 8 },
            { date: 'Thu', count: 25 },
            { date: 'Fri', count: 32 },
            { date: 'Sat', count: 15 },
            { date: 'Sun', count: 22 },
        ];

    const emailData = [
        { date: 'Week 1', sent: 45 },
        { date: 'Week 2', sent: 72 },
        { date: 'Week 3', sent: 56 },
        { date: 'Week 4', sent: 89 },
    ];

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
        </div>
    );
}
