import EducandoScope from '../../components/guardian/EducandoScope';
import PresencasAlunoPage from '../Student/presences';

export default function PresencasEncarregadoPage() {
    return (
        <EducandoScope>
            {(educando, selector) => (
                <PresencasAlunoPage
                    key={educando.idAluno}
                    presencasPath={`/api/encarregado/educandos/${educando.idAluno}/presencas`}
                    eyebrow="Área do encarregado"
                    title={`Presenças de ${educando.nome.split(' ')[0]}`}
                    subtitle="Histórico de aulas e faltas por mês."
                    headerActions={selector}
                />
            )}
        </EducandoScope>
    );
}
