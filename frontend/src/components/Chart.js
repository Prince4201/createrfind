'use client';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import styles from './Chart.module.css';

const COLORS = ['#7C6AFF', '#5B9AFF', '#34D399', '#FFB86C', '#B18CFF', '#38BDF8'];

const darkTooltipStyle = {
    backgroundColor: 'rgba(14, 15, 26, 0.95)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '8px',
    color: '#EEEEF4',
    fontSize: '0.75rem',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '8px 12px',
};

export function BarChartWidget({ data, xKey, yKey, title, color = '#6C5CE7' }) {
    return (
        <div className={styles.chartCard}>
            {title && <h3 className={styles.chartTitle}>{title}</h3>}
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey={xKey} tick={{ fill: '#52547A', fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fill: '#52547A', fontSize: 11 }} axisLine={false} />
                    <Tooltip contentStyle={darkTooltipStyle} />
                    <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function LineChartWidget({ data, xKey, yKey, title, color = '#4D8EFF' }) {
    return (
        <div className={styles.chartCard}>
            {title && <h3 className={styles.chartTitle}>{title}</h3>}
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey={xKey} tick={{ fill: '#52547A', fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fill: '#52547A', fontSize: 11 }} axisLine={false} />
                    <Tooltip contentStyle={darkTooltipStyle} />
                    <Line
                        type="monotone"
                        dataKey={yKey}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ fill: color, r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function PieChartWidget({ data, nameKey, valueKey, title }) {
    return (
        <div className={styles.chartCard}>
            {title && <h3 className={styles.chartTitle}>{title}</h3>}
            <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey={valueKey}
                        nameKey={nameKey}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={darkTooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '0.75rem', color: '#52547A' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
