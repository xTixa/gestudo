import NotificationsPage from '../../components/notifications/NotificationsPage';
import AdminPageHeader from '../../components/layout/AdminPageHeader';

export default function AdminNotificationsPage() {
    return (
        <section className="space-y-6">
            <AdminPageHeader
                title="Notificações"
                subtitle="Alertas e avisos associados à sua conta."
            />
            <NotificationsPage />
        </section>
    );
}
