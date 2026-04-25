'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ChannelTable from '@/components/ChannelTable';
import { Search } from 'lucide-react';

export default function ChannelsPage() {
    const [channels, setChannels] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: 'all', // all | emailed | pending
        search: '',
        minSubscribers: '',
        maxSubscribers: '',
        minAvgViews: '',
        dateFrom: '',
        dateTo: ''
    });

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const fetchChannels = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (filters.status === 'emailed') params.append('status', 'Emailed');
            if (filters.status === 'pending') params.append('status', 'Pending');
            if (filters.search) params.append('search', filters.search);
            if (filters.minSubscribers) params.append('minSubscribers', filters.minSubscribers);
            if (filters.maxSubscribers) params.append('maxSubscribers', filters.maxSubscribers);
            if (filters.minAvgViews) params.append('minAvgViews', filters.minAvgViews);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);

            const res = await api.getChannels(params.toString());
            setChannels(res.data);
            setPagination(res.pagination);
        } catch (err) {
            console.error('Failed to fetch channels:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce fetching if needed, but for simplicity trigger on changes
        const timer = setTimeout(() => {
            fetchChannels();
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    return (
        <div className="page-container">
            <h2 className="page-title">Channel Database</h2>
            <p className="page-subtitle">
                Browse and filter all discovered YouTube channels
            </p>

            {/* Search bar */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                    type="text"
                    placeholder="Search by channel name, keyword, or email..."
                    className="input-field"
                    style={{ paddingLeft: 40, marginBottom: 0, width: '100%', maxWidth: 480 }}
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                />
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['all', 'pending', 'emailed'].map((f) => (
                        <button
                            key={f}
                            className={`btn ${filters.status === f ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => updateFilter('status', f)}
                            style={{ textTransform: 'capitalize', fontSize: '0.82rem', padding: '8px 16px' }}
                        >
                            {f === 'all' ? 'All Channels' : f === 'emailed' ? 'Emailed' : 'Pending'}
                        </button>
                    ))}
                </div>
                
                <input 
                    type="number" 
                    placeholder="Min Subscribers" 
                    className="input-field" 
                    style={{ width: 140, marginBottom: 0 }}
                    value={filters.minSubscribers}
                    onChange={(e) => updateFilter('minSubscribers', e.target.value)}
                />
                <input 
                    type="number" 
                    placeholder="Max Subscribers" 
                    className="input-field" 
                    style={{ width: 140, marginBottom: 0 }}
                    value={filters.maxSubscribers}
                    onChange={(e) => updateFilter('maxSubscribers', e.target.value)}
                />
                <input 
                    type="number" 
                    placeholder="Min Avg Views" 
                    className="input-field" 
                    style={{ width: 140, marginBottom: 0 }}
                    value={filters.minAvgViews}
                    onChange={(e) => updateFilter('minAvgViews', e.target.value)}
                />
                <input 
                    type="date" 
                    className="input-field" 
                    style={{ width: 150, marginBottom: 0 }}
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    title="From date"
                />
                <input 
                    type="date" 
                    className="input-field" 
                    style={{ width: 150, marginBottom: 0 }}
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    title="To date"
                />
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading channels...
                </div>
            ) : (
                <>
                    <ChannelTable channels={channels} />

                    {pagination.totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 8,
                            marginTop: 20
                        }}>
                            <button
                                className="btn btn-secondary"
                                disabled={pagination.page <= 1}
                                onClick={() => fetchChannels(pagination.page - 1)}
                                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                            >
                                Previous
                            </button>
                            <span style={{
                                display: 'flex', alignItems: 'center',
                                fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0 12px'
                            }}>
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => fetchChannels(pagination.page + 1)}
                                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
