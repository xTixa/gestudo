import NotificationsPage from '../../components/notifications/NotificationsPage';
import UsersPageHeader from '../../components/layout/UsersPageHeader';
import { Bell } from 'lucide-react';

export default function StudentNotificationsPage() {
    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Painel do Aluno"
                title="Notificações"
                subtitle="Acompanhe os alertas e avisos associados à sua conta"
                icon={Bell}
            />
            <NotificationsPage />
        </section>
    );
}
