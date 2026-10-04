import PreviewModal, {
    PreviewIdentidade,
} from '../../../components/people/PreviewModal';
import { resolverImagemPerfil } from '../../../components/people/imagemPerfil';

function getProfessorNome(professor) {
    return (
        String(professor?.nome || professor?.pessoa?.nome || '').trim() || '-'
    );
}

function getProfessorNif(professor) {
    return String(professor?.nif || professor?.pessoa?.nif || '').trim() || '-';
}

// Ficha rápida do professor, aberta a partir da tabela.
export default function ProfessorPreviewModal({ professor, onFechar }) {
    return (
        <PreviewModal titulo="Ficha do Professor" onFechar={onFechar}>
            <div className="grid grid-cols-1 gap-4 px-5 py-5 text-sm md:grid-cols-2">
                <PreviewIdentidade
                    imagem={resolverImagemPerfil(professor)}
                    nome={getProfessorNome(professor)}
                    entidade="professor"
                    className="md:col-span-2"
                />

                <p className="text-slate-700">
                    <strong>Nome:</strong> {getProfessorNome(professor)}
                </p>
                <p className="text-slate-700">
                    <strong>NIF:</strong> {getProfessorNif(professor)}
                </p>
                <p className="text-slate-700">
                    <strong>Email:</strong> {professor.email}
                </p>
                <p className="text-slate-700">
                    <strong>Contacto:</strong> {professor.contacto}
                </p>
                <p className="text-slate-700">
                    <strong>Área de Ensino:</strong> {professor.area_ensino}
                </p>
                <p className="text-slate-700">
                    <strong>Nível:</strong> {professor.nivel}
                </p>
                <p className="text-slate-700 md:col-span-2">
                    <strong>Habilitação:</strong> {professor.habilitacao}
                </p>
                <p className="text-slate-700 md:col-span-2">
                    <strong>Data de Entrada:</strong>{' '}
                    {new Date(professor.data_entrada).toLocaleDateString('pt-PT')}
                </p>
            </div>
        </PreviewModal>
    );
}
