'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';

const nav = [
    { href: '/dashboard', label: 'Overview', icon: '📊' },
    { href: '/dashboard/discover', label: 'Discover', icon: '🔍' },
    { href: '/dashboard/channels', label: 'Channels', icon: '📺' },
    { href: '/dashboard/campaigns', label: 'Campaigns', icon: '📧' },
    { href: '/dashboard/emails', label: 'Email History', icon: '📬' },
    { href: '/dashboard/sheets', label: 'Sheet Sync', icon: '📄' },
    { href: '/dashboard/settings', label: 'Email Settings', icon: '⚙️' },
    { href: '/dashboard/admin', label: 'Admin', icon: '🛡️' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <span className={styles.logoIcon}>▶</span>
                <span className={styles.logoText}>CreatorFind</span>
            </div>

            <nav className={styles.nav}>
                {nav.map((item) => {
                    const isActive =
                        item.href === '/dashboard'
                            ? pathname === '/dashboard'
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <div className={styles.version}>v2.0.0</div>
            </div>
        </aside>
    );
}
