'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import FilterForm from '@/components/FilterForm';
import ChannelTable from '@/components/ChannelTable';

export default function DiscoverPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [backgroundStatus, setBackgroundStatus] = useState(null); // 'polling' | 'complete' | 'failed'
    const pollingRef = useRef(null);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const pollForUpdates = useCallback((searchHistoryId) => {
        setBackgroundStatus('polling');

        pollingRef.current = setInterval(async () => {
            try {
                const res = await api.getDiscoverStatus(searchHistoryId);
                const { status, channels } = res.data;

                if (status === 'completed') {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    setBackgroundStatus('complete');

                    if (channels && channels.length > 0) {
                        setResult(prev => ({
                            ...prev,
                            channels: channels,
                            totalFound: channels.length,
                            status: 'complete_from_cache',
                        }));
                    }
                } else if (status === 'failed') {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    setBackgroundStatus('failed');
                }
            } catch {
                // Ignore polling errors silently
            }
        }, 5000); // Poll every 5 seconds
    }, []);

    const handleDiscover = async (filters) => {
        setLoading(true);
        setError('');
        setResult(null);
        setBackgroundStatus(null);
        if (pollingRef.current) clearInterval(pollingRef.current);

        try {
            const res = await api.discoverChannels(filters);
            setResult(res.data);

            // If partial results, start polling for background job completion
            if (res.data.status === 'partial_fetching_background' && res.data.searchHistoryId) {
                pollForUpdates(res.data.searchHistoryId);
            }
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
                Search YouTube for creators matching your criteria. Results from cache load instantly, new data fetches in the background.
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
                    <p>Discovering channels... This may take a moment.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                        Checking cache first, then fetching fresh data from YouTube...
                    </p>
                </div>
            )}

            {/* Background fetch status banner */}
            {backgroundStatus === 'polling' && (
                <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(91,154,255,0.08)',
                    border: '1px solid rgba(91,154,255,0.15)',
                    color: '#5B9AFF',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }}>
                    <div style={{
                        width: 16, height: 16,
                        border: '2px solid rgba(91,154,255,0.3)',
                        borderTopColor: '#5B9AFF',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    Fetching more results from YouTube in the background... Results will update automatically.
                </div>
            )}

            {backgroundStatus === 'complete' && (
                <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(46,229,157,0.08)',
                    border: '1px solid rgba(46,229,157,0.15)',
                    color: 'var(--accent-green)',
                    fontSize: '0.85rem',
                }}>
                    ✅ Background fetch complete! All results are now loaded.
                </div>
            )}

            {backgroundStatus === 'failed' && (
                <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,107,107,0.08)',
                    border: '1px solid rgba(255,107,107,0.15)',
                    color: '#ff6b6b',
                    fontSize: '0.85rem',
                }}>
                    ⚠️ Background fetch failed. Showing cached results only. The YouTube API quota may be exceeded.
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
                            {result.returnedCount || result.totalFound || 0} channels found
                        </span>
                        {result.status === 'partial_fetching_background' && (
                            <span className="badge" style={{
                                background: 'rgba(91,154,255,0.12)',
                                color: '#5B9AFF',
                            }}>
                                {result.missingCount} more loading...
                            </span>
                        )}
                        {result.totalProcessed > 0 && (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {result.totalProcessed} total processed
                            </span>
                        )}
                    </div>
                    <ChannelTable channels={result.channels} />
                </div>
            )}
        </div>
    );
}
