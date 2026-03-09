'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);

    const [smtpSettings, setSmtpSettings] = useState({
        senderEmail: '',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
    });

    useEffect(() => {
        api.getSmtpSettings()
            .then((res) => {
                if (res.data) {
                    setSmtpSettings({
                        senderEmail: res.data.senderEmail || '',
                        smtpHost: res.data.smtpHost || '',
                        smtpPort: res.data.smtpPort || 587,
                        smtpUser: res.data.smtpUser || '',
                        smtpPassword: '', // Don't show existing password
                    });
                }
            })
            .catch((err) => {
                setResult({ error: 'Failed to load settings.' });
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSmtpSettings((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setResult(null);

        try {
            await api.updateSmtpSettings(smtpSettings);
            setResult({ success: 'SMTP settings saved successfully!' });
            // clear the password field after save for security
            setSmtpSettings((prev) => ({ ...prev, smtpPassword: '' }));
        } catch (err) {
            setResult({ error: err.message || 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading Settings...
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h2 className="page-title">Email Settings</h2>
            <p className="page-subtitle">Configure your SMTP server to send bulk outreach emails directly via your own address.</p>

            <div style={{
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', 
                padding: 32, 
                maxWidth: 600
            }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                            Sender Email Address
                        </label>
                        <input
                            type="email"
                            name="senderEmail"
                            value={smtpSettings.senderEmail}
                            onChange={handleChange}
                            placeholder="e.g. outreach@yourcompany.com"
                            className="input-field"
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                                SMTP Host
                            </label>
                            <input
                                type="text"
                                name="smtpHost"
                                value={smtpSettings.smtpHost}
                                onChange={handleChange}
                                placeholder="e.g. smtp.gmail.com"
                                className="input-field"
                                required
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                                Port
                            </label>
                            <input
                                type="number"
                                name="smtpPort"
                                value={smtpSettings.smtpPort}
                                onChange={handleChange}
                                className="input-field"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                            SMTP Username
                        </label>
                        <input
                            type="text"
                            name="smtpUser"
                            value={smtpSettings.smtpUser}
                            onChange={handleChange}
                            placeholder="e.g. outreach@yourcompany.com"
                            className="input-field"
                            required
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                            SMTP Password / App Password
                        </label>
                        <input
                            type="password"
                            name="smtpPassword"
                            value={smtpSettings.smtpPassword}
                            onChange={handleChange}
                            placeholder="Leave blank to keep existing password"
                            className="input-field"
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                            If using Gmail, generate an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none' }}>App Password</a>.
                        </p>
                    </div>

                    {result && (
                        <div style={{
                            padding: '12px 14px', 
                            borderRadius: 'var(--radius-md)',
                            background: result.error ? 'rgba(255,107,107,0.08)' : 'rgba(46,229,157,0.08)',
                            border: `1px solid ${result.error ? 'rgba(255,107,107,0.15)' : 'rgba(46,229,157,0.15)'}`,
                            color: result.error ? '#ff6b6b' : 'var(--accent-green)',
                            fontSize: '0.85rem',
                        }}>
                            {result.error ? `Error: ${result.error}` : `✅ ${result.success}`}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
