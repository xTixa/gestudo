import { useEffect, useState } from 'react';
import {
    Download,
    Pencil,
    Trash2Icon,
    EyeOff,
    UserCog,
    Plus,
    UserRound,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getProfessorProfileImage(value) {
    const raw =
        value?.imagem_perfil_url ||
        value?.pessoa?.imagem_perfil_url ||
        value?.pessoa?.user?.imagem_perfil_url ||
        '';

    const text = String(raw || '').trim();
    if (!text) return '';

    if (/^https?:\/\//i.test(text)) {
        return text;
    }

    if (text.startsWith('/')) {
        return `${API_URL}${text}`;
    }

    return `${API_URL}/${text}`;
}

function getProfessorNome(value) {
    return (
        String(value?.nome || value?.pessoa?.nome || '').trim() || 'Professor'
    );
}

function getProfessorEmail(value) {
    return (
        String(value?.email || value?.pessoa?.user?.email || '').trim() || 'N/A'
    );
}

function getProfessorNif(value) {
    return String(value?.nif || value?.pessoa?.nif || '').trim() || 'N/A';
}

function getProfessorField(value, directKey, nestedKey) {
    return (
        String(value?.[directKey] || value?.[nestedKey] || '').trim() || 'N/A'
    );
}

export default function FichaProfPage() {
    const navigate = useNavigate();
    const { id: profId } = useParams();
    const [professor, setProfessor] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function loadProfessor() {
            try {
                const response = await apiGet(
                    `/api/gestor/professores/${profId}`
                );
                const data = await response.json();

                if (response.ok && isMounted) {
                    setProfessor(data.professor);
                }
            } catch {
                if (isMounted) {
                    setProfessor(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadProfessor();

        return () => {
            isMounted = false;
        };
    }, [profId]);

    if (loading) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="text-sm text-slate-500">
                    A carregar professor da base de dados...
                </p>
            </section>
        );
    }

    if (!professor) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <p className="text-sm text-slate-500">
                    Professor não encontrado.
                </p>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => navigate('/gestor/professores')}
                >
                    Voltar à lista de professores
                </button>
            </section>
        );
    }

    const professorImage = getProfessorProfileImage(professor);

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                        {professorImage ? (
                            <img
                                src={professorImage}
                                alt="Foto de perfil do professor"
                                className="h-full w-full object-cover"
                                onError={(event) => {
                                    const img = event.currentTarget;
                                    img.style.display = 'none';
                                    const fallback =
                                        img.parentElement?.querySelector(
                                            '[data-professor-page-fallback="1"]'
                                        );
                                    if (fallback) {
                                        fallback.classList.remove('hidden');
                                    }
                                }}
                            />
                        ) : null}
                        <div
                            data-professor-page-fallback="1"
                            className={professorImage ? 'hidden' : ''}
                        >
                            <UserRound size={30} strokeWidth={1.8} />
                        </div>
                    </div>

                    <h2 className="text-lg font-semibold">
                        {getProfessorNome(professor)}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate('/gestor/professores')}
                    >
                        <EyeOff size={16} />
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() =>
                            navigate(
                                `/gestor/professores/edit/${professor.id_professor}`
                            )
                        }
                    >
                        <Pencil size={16} />
                        Editar
                    </button>
                </div>
            </div>
            <div className="space-y-3">
                <p>
                    <strong>Email:</strong> {getProfessorEmail(professor)}
                </p>
                <p>
                    <strong>NIF:</strong> {getProfessorNif(professor)}
                </p>
                <p>
                    <strong>Habilitação:</strong>{' '}
                    {getProfessorField(professor, 'habilitacao', 'habilitacao')}
                </p>
                <p>
                    <strong>Área de Ensino:</strong>{' '}
                    {getProfessorField(professor, 'area_ensino', 'area_ensino')}
                </p>
                <p>
                    <strong>Nível de Ensino:</strong> {professor.nivel || 'N/A'}
                </p>
                <p>
                    <strong>Data de Entrada:</strong>{' '}
                    {professor.data_entrada
                        ? new Date(professor.data_entrada).toLocaleDateString()
                        : 'N/A'}
                </p>
                <p>
                    <strong>Status:</strong>{' '}
                    {professor.status ? 'Ativo' : 'Inativo'}
                </p>
            </div>
        </section>
    );
}
