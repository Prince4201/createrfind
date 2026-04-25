'use client';
import { ExternalLink, Tv } from 'lucide-react';
import styles from './ChannelTable.module.css';

export default function ChannelTable({ channels = [], selectable = false, selected = [], onSelect }) {
    const toggleSelect = (id) => {
        if (!onSelect) return;
        onSelect(
            selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
        );
    };

    const toggleAll = () => {
        if (!onSelect) return;
        onSelect(selected.length === channels.length ? [] : channels.map((c) => c.channel_id || c.channelId));
    };

    if (channels.length === 0) {
        return (
            <div className={styles.empty}>
                <span className={styles.emptyIcon}><Tv size={48} opacity={0.3} /></span>
                <p>No channels found. Click Discover to fetch creators.</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrap}>
            <table className="data-table">
                <thead>
                    <tr>
                        {selectable && (
                            <th style={{ width: 40 }}>
                                <input
                                    type="checkbox"
                                    checked={selected.length === channels.length}
                                    onChange={toggleAll}
                                    className={styles.checkbox}
                                />
                            </th>
                        )}
                        <th>Channel</th>
                        <th>Subscribers</th>
                        <th>Avg Views</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Scraped</th>
                    </tr>
                </thead>
                <tbody>
                    {channels.map((ch, i) => (
                        <tr 
                            key={ch.channel_id || ch.channelId || i} 
                            className={styles.row}
                            onClick={(e) => {
                                // Prevent navigating if clicking a checkbox
                                if (e.target.type !== 'checkbox') {
                                    window.open(ch.channel_url || ch.channelUrl, '_blank', 'noopener,noreferrer');
                                }
                            }}
                        >
                            {selectable && (
                                <td onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(ch.channel_id || ch.channelId)}
                                        onChange={() => toggleSelect(ch.channel_id || ch.channelId)}
                                        className={styles.checkbox}
                                    />
                                </td>
                            )}
                            <td>
                                <div className={styles.channelCell}>
                                    <span className={styles.channelName}>
                                        {ch.name || ch.channelName}
                                    </span>
                                </div>
                            </td>
                            <td className={styles.number}>{(ch.subscribers || 0).toLocaleString()}</td>
                            <td className={styles.number}>{(ch.avg_views || ch.avgViews || 0).toLocaleString()}</td>
                            <td>
                                <span className={styles.email}>{ch.email || '—'}</span>
                            </td>
                            <td>
                                <span className={`badge ${ch.email_sent ? 'badge-success' : 'badge-warning'}`}>
                                    {ch.email_sent ? 'Emailed' : 'Pending'}
                                </span>
                            </td>
                            <td className={styles.date}>
                                {ch.created_at || ch.scrapedAt
                                    ? new Date(ch.created_at || ch.scrapedAt).toLocaleDateString()
                                    : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
