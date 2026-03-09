'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import styles from './page.module.css';

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ campaignName: '', subject: '', bodyTemplate: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            const res = await api.getCampaigns();
            setCampaigns(res.data);
        } catch (err) {
            console.error('Failed to fetch campaigns:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.createCampaign(form);
            setForm({ campaignName: '', subject: '', bodyTemplate: '' });
            setShowCreate(false);
            fetchCampaigns();
        } catch (err) {
            console.error('Failed to create campaign:', err);
            alert('Failed to create campaign: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 className="page-title">Campaign Manager</h2>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>
                        Create and manage email outreach campaigns
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? 'Cancel' : '+ New Campaign'}
                </button>
            </div>

            {showCreate && (
                <form className={styles.createForm} onSubmit={handleCreate}>
                    <div className={styles.field}>
                        <label className={styles.label}>Campaign Name</label>
                        <input
                            className="input-field"
                            placeholder="e.g. Q1 Tech YouTubers Outreach"
                            value={form.campaignName}
                            onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Email Subject</label>
                        <input
                            className="input-field"
                            placeholder="e.g. Collaboration Opportunity for {{channelName}}"
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Email Body Template
                            <span className={styles.hint}>
                                Use {'{{channelName}}'}, {'{{subscribers}}'}, {'{{avgViews}}'} for personalization
                            </span>
                        </label>
                        <textarea
                            className="input-field"
                            rows={6}
                            placeholder="Hi {{channelName}}, &#10;&#10;We noticed your channel with {{subscribers}} subscribers..."
                            value={form.bodyTemplate}
                            onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                        {creating ? 'Creating...' : 'Create Campaign'}
                    </button>
                </form>
            )}

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading campaigns...
                </div>
            ) : campaigns.length === 0 ? (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>🚀</span>
                    <p>No campaigns yet. Create your first one!</p>
                </div>
            ) : (
                <div className={styles.campaignGrid}>
                    {campaigns.map((c) => (
                        <div key={c.id} className={styles.campaignCard}>
                            <h3 className={styles.campaignName}>{c.campaignName}</h3>
                            <p className={styles.campaignSubject}>{c.subject}</p>
                            <div className={styles.campaignStats}>
                                <span>
                                    <strong>{c.emailsSent || 0}</strong> emails sent
                                </span>
                                <span className={styles.campaignDate}>
                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
