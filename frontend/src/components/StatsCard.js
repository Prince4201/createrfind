'use client';
import { useEffect, useState } from 'react';
import styles from './StatsCard.module.css';

export default function StatsCard({ label, value, icon, gradient = 'brand', suffix = '' }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const target = typeof value === 'number' ? value : parseInt(value) || 0;
        if (target === 0) { setDisplayValue(0); return; }

        let start = 0;
        const duration = 800;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) {
                setDisplayValue(target);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <div className={styles.card}>
            <div className={`${styles.iconWrap} ${styles[gradient]}`}>
                <span className={styles.icon}>{icon}</span>
            </div>
            <div className={styles.content}>
                <span className={styles.label}>{label}</span>
                <span className={styles.value}>
                    {displayValue.toLocaleString()}{suffix}
                </span>
            </div>
        </div>
    );
}
