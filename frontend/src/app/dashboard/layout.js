import DashboardLayoutClient from './DashboardLayoutClient';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }) {
    return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
