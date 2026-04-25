'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import api from '@/lib/api';
import { User, Mail, Shield, Calendar, Save, Key, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Password change
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.getProfile();
            setProfile(res.user);
            setName(res.user.name || '');
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveName = async () => {
        if (!name.trim()) return;
        setSaving(true);
        setMessage('');
        try {
            const res = await api.updateProfile({ name: name.trim() });
            setProfile(res.user);
            setMessage('✅ Name updated successfully.');
        } catch (err) {
            setMessage(`❌ Failed to update: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setPasswordMsg('❌ Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg('❌ Passwords do not match.');
            return;
        }
        setChangingPassword(true);
        setPasswordMsg('');
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setPasswordMsg('✅ Password changed successfully.');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordForm(false);
        } catch (err) {
            setPasswordMsg(`❌ Failed to change password: ${err.message}`);
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading profile...
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="page-container">
                <div style={{ padding: 40, textAlign: 'center', color: '#ff6b6b' }}>
                    Failed to load profile.
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h2 className="page-title">My Profile</h2>
            <p className="page-subtitle">Manage your account details and security</p>

            {/* Profile Card */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', padding: 32, marginBottom: 24
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'var(--gradient-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', fontWeight: 700, color: 'white', flexShrink: 0
                    }}>
                        {(profile.name || profile.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {profile.name}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {profile.email}
                        </p>
                    </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Mail size={16} color="var(--accent-blue)" />
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{profile.email}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Shield size={16} color="var(--accent-green)" />
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{profile.role}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Calendar size={16} color="var(--accent-orange)" />
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{new Date(profile.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <User size={16} color="var(--brand)" />
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auth Provider</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{profile.provider || 'email'}</div>
                        </div>
                    </div>
                </div>

                {/* Update Name */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Update Name</h4>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 240 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                                Display Name
                            </label>
                            <input
                                type="text"
                                className="input-field"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                style={{ marginBottom: 0 }}
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveName}
                            disabled={saving || !name.trim() || name.trim() === profile.name}
                            style={{ height: 42 }}
                        >
                            {saving ? 'Saving...' : <><Save size={16} /> Save</>}
                        </button>
                    </div>
                    {message && (
                        <div style={{
                            marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                            background: message.startsWith('✅') ? 'rgba(46,229,157,0.08)' : 'rgba(255,107,107,0.08)',
                            border: `1px solid ${message.startsWith('✅') ? 'rgba(46,229,157,0.15)' : 'rgba(255,107,107,0.15)'}`,
                            color: message.startsWith('✅') ? 'var(--accent-green)' : '#ff6b6b',
                            fontSize: '0.82rem',
                        }}>
                            {message}
                        </div>
                    )}
                </div>
            </div>

            {/* Change Password Section */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', padding: 28
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPasswordForm ? 20 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Key size={18} color="var(--accent-orange)" />
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Change Password</h4>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                        {showPasswordForm ? 'Cancel' : 'Change'}
                    </button>
                </div>

                {showPasswordForm && (
                    <form onSubmit={handleChangePassword}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                                    New Password
                                </label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input-field"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min 6 characters"
                                    style={{ marginBottom: 0, paddingRight: 40 }}
                                    required
                                    minLength={6}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: 10, top: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    style={{ marginBottom: 0 }}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={changingPassword} style={{ alignSelf: 'flex-start' }}>
                                {changingPassword ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                )}

                {passwordMsg && (
                    <div style={{
                        marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                        background: passwordMsg.startsWith('✅') ? 'rgba(46,229,157,0.08)' : 'rgba(255,107,107,0.08)',
                        border: `1px solid ${passwordMsg.startsWith('✅') ? 'rgba(46,229,157,0.15)' : 'rgba(255,107,107,0.15)'}`,
                        color: passwordMsg.startsWith('✅') ? 'var(--accent-green)' : '#ff6b6b',
                        fontSize: '0.82rem',
                    }}>
                        {passwordMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
