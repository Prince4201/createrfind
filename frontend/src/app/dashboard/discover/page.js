'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import api from '@/lib/api';
import FilterForm from '@/components/FilterForm';
import ChannelTable from '@/components/ChannelTable';

export default function DiscoverPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleDiscover = async (filters) => {
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await api.discoverChannels(filters);
            setResult(res.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">
            <h2 className="page-title">Discover Creators</h2>
            <p className="page-subtitle">
                Search YouTube for creators matching your criteria. Each trigger collects up to 50 valid channels.
            </p>

            <FilterForm onSubmit={handleDiscover} loading={loading} />

            {error && (
                <div style={{
                    marginTop: 20,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,107,107,0.08)',
                    border: '1px solid rgba(255,107,107,0.15)',
                    color: '#ff6b6b',
                    fontSize: '0.875rem'
                }}>
                    {error}
                </div>
            )}

            {loading && (
                <div style={{
                    marginTop: 24,
                    padding: 40,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                }}>
                    <div style={{
                        width: 48, height: 48, margin: '0 auto 16px',
                        border: '3px solid rgba(255,255,255,0.08)',
                        borderTopColor: 'var(--brand)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <p>Discovering channels... This may take a minute.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                        Searching YouTube, fetching stats, calculating average views...
                    </p>
                </div>
            )}

            {result && (
                <div style={{ marginTop: 24 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16,
                    }}>
                        <span className="badge badge-success">
                            {result.totalFound} channels found
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {result.totalProcessed} total processed
                        </span>
                    </div>
                    <ChannelTable channels={result.channels} />
                </div>
            )}
        </div>
    );
}
