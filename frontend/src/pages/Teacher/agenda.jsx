import AgendaCalendar from '../../components/agenda/AgendaCalendar';

// O backend devolve só as sessões do professor autenticado.
export default function AgendaPage() {
    return (
        <AgendaCalendar
            modo="equipa"
            eyebrow="Agenda do professor"
            title="Agenda"
            subtitle="Visualize as suas atividades, aulas e eventos agendados."
        />
    );
}
