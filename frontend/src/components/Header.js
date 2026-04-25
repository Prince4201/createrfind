'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import styles from './Header.module.css';

export default function Header({ title, user }) {
    const router = useRouter();

    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>{title || 'Dashboard'}</h1>

            <div className={styles.actions}>
                <Link href="/dashboard/profile" style={{ textDecoration: 'none' }}>
                    <div className={styles.user} style={{ cursor: 'pointer', borderRadius: 'var(--radius-sm)', padding: '4px 8px', transition: 'background var(--transition-fast)' }}
                         onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                         onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <div className={styles.avatar}>
                            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.userName}>{user?.name || user?.email || 'User'}</span>
                    </div>
                </Link>
                
                <button className={`btn btn-ghost ${styles.themeBtn}`} onClick={toggleTheme} aria-label="Toggle Theme" title="Toggle Light/Dark Theme">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </header>
    );
}
