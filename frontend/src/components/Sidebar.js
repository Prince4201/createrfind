'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';

import { 
    LayoutDashboard, 
    Search, 
    Tv, 
    Mail, 
    History, 
    FileSpreadsheet, 
    Settings, 
    ShieldAlert 
} from 'lucide-react';

const nav = [
    { href: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { href: '/dashboard/discover', label: 'Discover', icon: <Search size={18} /> },
    { href: '/dashboard/channels', label: 'Channels', icon: <Tv size={18} /> },
    { href: '/dashboard/campaigns', label: 'Campaigns', icon: <Mail size={18} /> },
    { href: '/dashboard/emails', label: 'Email History', icon: <History size={18} /> },
    { href: '/dashboard/sheets', label: 'Sheet Sync', icon: <FileSpreadsheet size={18} /> },
    { href: '/dashboard/settings', label: 'Email Settings', icon: <Settings size={18} /> },
    { href: '/dashboard/admin', label: 'Admin', icon: <ShieldAlert size={18} /> },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <span className={styles.logoIcon}><Tv size={20} color="white" /></span>
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
