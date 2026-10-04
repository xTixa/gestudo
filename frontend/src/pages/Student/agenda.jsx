import AgendaCalendar from '../../components/agenda/AgendaCalendar';

// Também usada pela agenda do encarregado (pages/Guardian/agenda.jsx), que
// passa o endpoint do educando e os seus textos.
export default function AgendaPage({
    agendaPath = '/api/public/agenda',
    eyebrow = 'Painel do Aluno',
    title = 'A minha agenda',
    subtitle = 'Visão geral das tuas atividades, sessões e eventos agendados.',
    headerActions = null,
    showCalendarSync = true,
}) {
    return (
        <AgendaCalendar
            modo="aluno"
            agendaPath={agendaPath}
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            headerActions={headerActions}
            showCalendarSync={showCalendarSync}
        />
    );
}
