import { Bell } from 'lucide-react';
import NotificationsPage from '../../components/notifications/NotificationsPage';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

export default function NotificacoesEncarregadoPage() {
    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Área do encarregado"
                title="Notificações"
                subtitle="Avisos e comunicações do centro."
                icon={Bell}
            />
            <NotificationsPage />
        </section>
    );
}
