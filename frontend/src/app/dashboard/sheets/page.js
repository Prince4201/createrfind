'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import { FileSpreadsheet, RefreshCw, Save, ShieldAlert } from 'lucide-react';

export default function SheetsPage() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);
    const [sheetIdInput, setSheetIdInput] = useState('');

    const fetchStatus = async () => {
        try {
            const res = await api.getSheetsStatus();
            setStatus(res.data);
            setSheetIdInput(res.data.spreadsheetId || '');
            setError(null);
        } catch (err) {
            if (err.message.includes('403')) {
                setError('Admin access required for Google Sheet Sync.');
            } else {
                setError(`Failed to load status: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        setMessage('');
        try {
            await api.updateSheetSettings({ spreadsheetId: sheetIdInput.trim() });
            setMessage('✅ Sheet ID saved successfully.');
            await fetchStatus();
        } catch (err) {
            setMessage(`❌ Save failed: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setMessage('');
        try {
            const res = await api.syncSheets();
            setMessage(`✅ Successfully synced ${res.data.syncedCount} channels to Google Sheet.`);
            await fetchStatus();
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

    if (error) {
        return (
            <div className="page-container">
                <div style={{
                    padding: 40, textAlign: 'center', color: '#ff6b6b',
                    background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.15)',
                    borderRadius: 'var(--radius-lg)'
                }}>
                    <ShieldAlert size={48} style={{ margin: '0 auto 16px', opacity: 0.8 }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>Access Denied</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h2 className="page-title">Google Sheet Sync</h2>
            <p className="page-subtitle">
                Configure your Google Sheet and synchronize discovered channels
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
                    icon={<FileSpreadsheet size={24} />}
                    gradient="blue"
                />
            </div>

            {/* Configuration Section */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', padding: 28, marginBottom: 24
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Sheet Configuration</h3>
                
                {status?.serviceAccountEmail && (
                    <div style={{
                        padding: '16px', background: 'rgba(99, 102, 241, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: 'var(--radius-md)',
                        marginBottom: 20
                    }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>
                            Instructions:
                        </h4>
                        <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '20px', margin: 0, lineHeight: 1.6 }}>
                            <li>Create a new or open an existing Google Sheet.</li>
                            <li>Click the <strong>Share</strong> button in the top right.</li>
                            <li>Add the following Service Account Email: <br/>
                                <code style={{ color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', userSelect: 'all' }}>
                                    {status.serviceAccountEmail}
                                </code>
                            </li>
                            <li>Give the service account <strong>Editor</strong> access.</li>
                            <li>Copy the Sheet ID from the URL (the long string between <code style={{opacity:0.8}}>/d/</code> and <code style={{opacity:0.8}}>/edit</code>).</li>
                            <li>Paste the Sheet ID below and save.</li>
                        </ol>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 280 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                            Google Sheet ID
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            value={sheetIdInput}
                            onChange={(e) => setSheetIdInput(e.target.value)}
                            placeholder="e.g. 1lIUqyPcnMVgkbCX4kD5J3v65Kp8nRIcYfz2y03o5a7g"
                        />
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={handleSaveSettings}
                        disabled={saving || !sheetIdInput.trim()}
                        style={{ height: 42 }}
                    >
                        {saving ? 'Saving...' : <><Save size={16} /> Save ID</>}
                    </button>
                </div>
            </div>

            {/* Sync Section */}
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
                    {syncing ? 'Syncing...' : <><RefreshCw size={16} /> Sync Now</>}
                </button>

                {!status?.configured && (
                    <p style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--accent-orange)' }}>
                        ⚠️ Please configure a valid Google Sheet ID above.
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

            {/* Iframe Preview */}
            {status?.spreadsheetId && status?.configured && (
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                        height: '600px',
                        width: '100%',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)'
                    }}>
                        <iframe 
                            src={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit?widget=true&headers=false`}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                        ></iframe>
                    </div>
                </div>
            )}
        </div>
    );
}
