'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import styles from './layout.module.css';

export default function DashboardLayoutClient({ children }) {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) {
                router.push('/');
                setLoading(false);
                return;
            }

            // Force token refresh to get latest emailVerified status from server
            try {
                await u.getIdToken(true);
                await u.reload();
            } catch {
                // Token refresh failed — user might be deleted
                await auth.signOut();
                router.push('/');
                setLoading(false);
                return;
            }

            if (!u.emailVerified) {
                await auth.signOut();
                router.push('/');
                setLoading(false);
                return;
            }

            setUser({ uid: u.uid, email: u.email, name: u.displayName || u.email });
            setLoading(false);
        });
        return () => unsub();
    }, [router]);

    if (loading) {
        return (
            <div className={styles.loader}>
                <div className={styles.spinner} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.layout}>
            <Sidebar />
            <div className={styles.main}>
                <Header user={user} />
                <main className={styles.content}>{children}</main>
            </div>
        </div>
    );
}
