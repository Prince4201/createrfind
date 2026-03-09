'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function EmailsPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // For send UI
    const [campaigns, setCampaigns] = useState([]);
    const [channels, setChannels] = useState([]);
    const [selectedCampaign, setSelectedCampaign] = useState('');
    const [selectedChannels, setSelectedChannels] = useState([]);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        Promise.all([
            api.getEmailHistory().catch((err) => { console.error('Failed to load email history:', err); return { data: [] }; }),
            api.getCampaigns().catch((err) => { console.error('Failed to load campaigns:', err); return { data: [] }; }),
            api.getChannels('limit=100&emailSent=false').catch((err) => { console.error('Failed to load channels:', err); return { data: [] }; }),
        ]).then(([h, c, ch]) => {
            setHistory(h.data);
            setCampaigns(c.data);
            setChannels(ch.data);
            setLoading(false);
        });
    }, []);

    const handleSend = async () => {
        if (!selectedCampaign || selectedChannels.length === 0) return;
        setSending(true);
        setResult(null);
        try {
            const res = await api.sendEmails({
                campaignId: selectedCampaign,
                channelIds: selectedChannels,
            });
            setResult(res.data);
            setSelectedChannels([]);
            // Refresh history and channels
            const [h, ch] = await Promise.all([
                api.getEmailHistory(),
                api.getChannels('limit=100&emailSent=false').catch(() => ({ data: [] })),
            ]);
            setHistory(h.data);
            setChannels(ch.data);
        } catch (err) {
            console.error('Failed to send emails:', err);
            setResult({ error: err.message });
        } finally {
            setSending(false);
        }
    };

    const toggleChannel = (id) => {
        setSelectedChannels((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        setSelectedChannels(channels.map((ch) => ch.channelId || ch.id));
    };

    const deselectAll = () => {
        setSelectedChannels([]);
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
            <h2 className="page-title">Email Outreach</h2>
            <p className="page-subtitle">Send personalized emails and track delivery history</p>

            {/* Send Section */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 28,
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Send Emails</h3>

                {/* Campaign selector */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                        Select Campaign
                    </label>
                    <select
                        className="input-field"
                        value={selectedCampaign}
                        onChange={(e) => setSelectedCampaign(e.target.value)}
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', maxWidth: 500 }}
                    >
                        <option value="">Choose a campaign...</option>
                        {campaigns.map((c) => (
                            <option key={c.id} value={c.id}>{c.campaignName}</option>
                        ))}
                    </select>
                </div>

                {/* Channel selection */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Select Channels ({channels.length} available, {selectedChannels.length} selected)
                        </label>
                        {channels.length > 0 && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    onClick={selectAll}
                                    style={{
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        border: '1px solid rgba(99, 102, 241, 0.25)',
                                        color: 'var(--brand)',
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    ✓ Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={deselectAll}
                                    style={{
                                        background: 'rgba(255, 107, 107, 0.08)',
                                        border: '1px solid rgba(255, 107, 107, 0.2)',
                                        color: '#ff6b6b',
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    ✕ Deselect All
                                </button>
                            </div>
                        )}
                    </div>

                    {channels.length > 0 ? (
                        <div style={{
                            maxHeight: 280, overflowY: 'auto',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)', padding: 4,
                            background: 'rgba(0,0,0,0.15)',
                        }}>
                            {channels.map((ch) => {
                                const chId = ch.channelId || ch.id;
                                const isSelected = selectedChannels.includes(chId);
                                return (
                                    <label key={chId} style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem',
                                        transition: 'background 0.15s',
                                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleChannel(chId)}
                                            style={{ accentColor: 'var(--brand)', width: 16, height: 16, flexShrink: 0 }}
                                        />
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, minWidth: 160 }}>
                                            {ch.channelName}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', flex: 1 }}>
                                            {ch.email}
                                        </span>
                                        <span style={{
                                            color: 'var(--text-muted)', fontSize: '0.72rem',
                                            background: 'rgba(255,255,255,0.06)', padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
                                        }}>
                                            {(ch.subscribers || 0).toLocaleString()} subs
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{
                            padding: 24, textAlign: 'center', color: 'var(--text-muted)',
                            border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)',
                            fontSize: '0.85rem',
                        }}>
                            No channels available. Discover channels first from the Discover page.
                        </div>
                    )}
                </div>

                {/* Send button */}
                <button
                    className="btn btn-primary"
                    disabled={sending || !selectedCampaign || selectedChannels.length === 0}
                    onClick={handleSend}
                    style={{ minWidth: 220 }}
                >
                    {sending ? 'Sending...' : `Send to ${selectedChannels.length} channel${selectedChannels.length !== 1 ? 's' : ''}`}
                </button>

                {result && (
                    <div style={{
                        marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                        background: result.error ? 'rgba(255,107,107,0.08)' : 'rgba(46,229,157,0.08)',
                        border: `1px solid ${result.error ? 'rgba(255,107,107,0.15)' : 'rgba(46,229,157,0.15)'}`,
                        color: result.error ? '#ff6b6b' : 'var(--accent-green)',
                        fontSize: '0.85rem',
                    }}>
                        {result.error
                            ? `Error: ${result.error}`
                            : `✅ ${result.sent} sent, ${result.failed} failed`}
                    </div>
                )}
            </div>

            {/* History Section */}
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Send History</h3>
            {history.length === 0 ? (
                <div style={{
                    padding: 40, textAlign: 'center', color: 'var(--text-muted)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                }}>
                    No email history yet
                </div>
            ) : (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Channel ID</th>
                                <th>Email Address</th>
                                <th>Subject</th>
                                <th>Status</th>
                                <th>Sent Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h) => (
                                <tr key={h.id}>
                                    <td style={{ fontWeight: 500 }}>{h.channelId || '—'}</td>
                                    <td>{h.email || '—'}</td>
                                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.subject || '—'}</td>
                                    <td>
                                        <span className={`badge ${h.status === 'Sent' ? 'badge-success' : 'badge-danger'}`}>
                                            {h.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        {h.sentAt ? new Date(h.sentAt).toLocaleString() : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
