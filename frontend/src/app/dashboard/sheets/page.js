'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatsCard from '@/components/StatsCard';

export default function SheetsPage() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        api.getSheetsStatus()
            .then((res) => setStatus(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setMessage('');
        try {
            const res = await api.syncSheets();
            setMessage(`✅ Successfully synced ${res.data.syncedCount} channels to Google Sheet.`);
            // Refresh status
            const s = await api.getSheetsStatus();
            setStatus(s.data);
        } catch (err) {
            setMessage(`❌ Sync failed: ${err.message}`);
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h2 className="page-title">Google Sheet Sync</h2>
            <p className="page-subtitle">
                Synchronize discovered channels to your Google Sheet
            </p>

            <div className="stats-grid">
                <StatsCard
                    label="Sheet Status"
                    value={status?.configured ? 1 : 0}
                    icon={status?.configured ? '✅' : '❌'}
                    gradient={status?.configured ? 'green' : 'brand'}
                    suffix={status?.configured ? ' Connected' : ' Not configured'}
                />
                <StatsCard
                    label="Rows in Sheet"
                    value={status?.rowCount || 0}
                    icon="📄"
                    gradient="blue"
                />
            </div>

            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', padding: 28,
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Manual Sync</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Push the latest discovered channels to your configured Google Sheet. New channels are appended with full details including subscriber count, average views, email, and more.
                </p>

                <button
                    className="btn btn-primary"
                    onClick={handleSync}
                    disabled={syncing || !status?.configured}
                >
                    {syncing ? 'Syncing...' : '🔄 Sync Now'}
                </button>

                {!status?.configured && (
                    <p style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--accent-orange)' }}>
                        ⚠️ Google Sheets service account is not configured. See deployment docs for setup.
                    </p>
                )}

                {message && (
                    <div style={{
                        marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                        background: message.startsWith('✅') ? 'rgba(46,229,157,0.08)' : 'rgba(255,107,107,0.08)',
                        border: `1px solid ${message.startsWith('✅') ? 'rgba(46,229,157,0.15)' : 'rgba(255,107,107,0.15)'}`,
                        color: message.startsWith('✅') ? 'var(--accent-green)' : '#ff6b6b',
                        fontSize: '0.85rem',
                    }}>
                        {message}
                    </div>
                )}
            </div>

            {status?.spreadsheetId && (
                <div style={{
                    marginTop: 20, padding: '14px 18px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)', fontSize: '0.85rem',
                }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sheet ID: </span>
                    <code style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                        {status.spreadsheetId}
                    </code>
                </div>
            )}
        </div>
    );
}
