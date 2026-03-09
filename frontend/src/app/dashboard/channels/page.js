'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ChannelTable from '@/components/ChannelTable';

export default function ChannelsPage() {
    const [channels, setChannels] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | emailed | pending

    const fetchChannels = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (filter === 'emailed') params.append('emailSent', 'true');
            if (filter === 'pending') params.append('emailSent', 'false');

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
        fetchChannels();
    }, [filter]);

    return (
        <div className="page-container">
            <h2 className="page-title">Channel Database</h2>
            <p className="page-subtitle">
                Browse and filter all discovered YouTube channels
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['all', 'pending', 'emailed'].map((f) => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f)}
                        style={{ textTransform: 'capitalize', fontSize: '0.82rem', padding: '8px 16px' }}
                    >
                        {f === 'all' ? 'All Channels' : f === 'emailed' ? 'Emailed' : 'Pending'}
                    </button>
                ))}
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
