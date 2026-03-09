'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Step 1: Create the Firebase account
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(cred.user, { displayName: name });
        }

        // Step 2: Validate secret key on backend + auto-verify email
        const keyRes = await fetch(`${API_BASE}/api/auth/validate-signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretKey, uid: cred.user.uid }),
        });
        const keyData = await keyRes.json();

        if (!keyRes.ok) {
          // Secret key invalid — account was deleted by backend
          await auth.signOut();
          throw new Error(keyData.error || 'Invalid secret key');
        }

        // Step 3: Force token refresh to get updated emailVerified claim
        await cred.user.getIdToken(true);

        // Step 4: Redirect to dashboard
        router.push('/dashboard');
      } else {
        // Sign in
        const cred = await signInWithEmailAndPassword(auth, email, password);

        // Check if email is verified
        if (!cred.user.emailVerified) {
          await auth.signOut();
          setError('Your account is not yet verified. Please contact the admin.');
          return;
        }

        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Background gradient orbs */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgOrb3} />

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>▶</div>
          <h1 className={styles.brand}>CreatorFind</h1>
          <p className={styles.tagline}>YouTube Creator Discovery & Outreach</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {isSignUp && (
            <>
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

              <div className={styles.field}>
                <label className={styles.label}>Secret Key</label>
                <input
                  id="signup-secret"
                  type="password"
                  className="input-field"
                  placeholder="Enter invite key"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  required
                  style={{ letterSpacing: '4px' }}
                />
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: 4,
                  display: 'block',
                }}>
                  🔐 Required invite key to create an account
                </span>
              </div>
            </>
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
            <input
              id="login-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
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
