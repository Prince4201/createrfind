'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import styles from './login.module.css';

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) throw signUpError;
        if (data?.user?.identities?.length === 0) {
          throw new Error('An account with this email already exists.');
        }
        router.push('/dashboard');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  return (
    <div className={styles.page}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgOrb3} />

      <button className={styles.backBtn} onClick={() => router.push('/')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Home
      </button>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>▶</div>
          <h1 className={styles.brand}>CreatorFind</h1>
          <p className={styles.tagline}>YouTube Creator Discovery & Outreach</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {isSignUp && (
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input
                id="signup-name"
                type="text"
                className="input-field"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              id="login-email"
              type="email"
              className="input-field"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.pwdWrap}>
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className={styles.pwdToggle}
                onClick={() => setShowPwd(!showPwd)}
                tabIndex={-1}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className={styles.toggle}>
          <span className={styles.toggleText}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            className={styles.toggleBtn}
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
