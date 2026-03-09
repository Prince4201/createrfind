'use client';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import styles from './Header.module.css';

export default function Header({ title, user }) {
    const router = useRouter();

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/');
    };

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>{title || 'Dashboard'}</h1>

            <div className={styles.actions}>
                <div className={styles.user}>
                    <div className={styles.avatar}>
                        {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.userName}>{user?.name || user?.email || 'User'}</span>
                </div>
                <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </header>
    );
}
