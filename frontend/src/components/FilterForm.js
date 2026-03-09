'use client';
import { useState } from 'react';
import styles from './FilterForm.module.css';

export default function FilterForm({ onSubmit, loading = false }) {
    const [filters, setFilters] = useState({
        keyword: '',
        minSubscribers: 1000,
        maxSubscribers: 1000000,
        minAvgViews: 500,
        maxChannels: 30,
    });

    const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(filters);
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.grid}>
                <div className={styles.field}>
                    <label className={styles.label}>Niche Keyword</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. tech reviews, cooking, fitness"
                        value={filters.keyword}
                        onChange={(e) => update('keyword', e.target.value)}
                        required
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Min Subscribers</label>
                    <input
                        type="number"
                        className="input-field"
                        min="0"
                        value={filters.minSubscribers}
                        onChange={(e) => update('minSubscribers', parseInt(e.target.value) || 0)}
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Max Subscribers</label>
                    <input
                        type="number"
                        className="input-field"
                        min="1"
                        value={filters.maxSubscribers}
                        onChange={(e) => update('maxSubscribers', parseInt(e.target.value) || 1)}
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Min Average Views</label>
                    <input
                        type="number"
                        className="input-field"
                        min="0"
                        value={filters.minAvgViews}
                        onChange={(e) => update('minAvgViews', parseInt(e.target.value) || 0)}
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>
                        Max Channels to Collect: <strong>{filters.maxChannels}</strong>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        value={filters.maxChannels}
                        onChange={(e) => update('maxChannels', parseInt(e.target.value))}
                        className={styles.slider}
                    />
                    <div className={styles.sliderLabels}>
                        <span>1</span>
                        <span>25</span>
                        <span>50</span>
                    </div>
                </div>
            </div>

            <button
                type="submit"
                className={`btn btn-primary ${styles.triggerBtn}`}
                disabled={loading || !filters.keyword.trim()}
            >
                {loading ? (
                    <>
                        <span className={styles.spinner} />
                        Discovering...
                    </>
                ) : (
                    <>🔍 Trigger Discovery</>
                )}
            </button>
        </form>
    );
}
