import EducandoScope from '../../components/guardian/EducandoScope';
import AgendaPage from '../Student/agenda';

export default function AgendaEncarregadoPage() {
    return (
        <EducandoScope>
            {(educando, selector) => (
                <AgendaPage
                    key={educando.idAluno}
                    agendaPath={`/api/encarregado/educandos/${educando.idAluno}/agenda`}
                    eyebrow="Área do encarregado"
                    title={`Agenda de ${educando.nome.split(' ')[0]}`}
                    subtitle="Sessões e atividades agendadas do seu educando."
                    headerActions={selector}
                />
            )}
        </EducandoScope>
    );
}
