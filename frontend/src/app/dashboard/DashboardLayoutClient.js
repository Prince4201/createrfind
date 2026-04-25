'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import styles from './layout.module.css';
import api from '@/lib/api';

export default function DashboardLayoutClient({ children }) {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();

        // getSession reads from local cookie/storage (instant), no network call
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user) {
                router.push('/');
                setLoading(false);
                return;
            }
            
            const u = session.user;

            // Ping backend to ensure user exists in public.users (resolves foreign key & admin errors)
            api.verifyToken().catch(err => console.error('Failed to verify token on backend:', err));

            setUser({
                id: u.id,
                email: u.email,
                name: u.user_metadata?.name || u.email,
            });
            setLoading(false);
        });

        // Listen for auth state changes (e.g. logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_OUT' || !session) {
                    router.push('/');
                }
            }
        );

        return () => subscription.unsubscribe();
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
