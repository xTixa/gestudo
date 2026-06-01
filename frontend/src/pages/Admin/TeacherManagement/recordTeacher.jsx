import { useCallback, useEffect, useState } from 'react';
import {
    Download,
    Pencil,
    Trash,
    EyeOff,
    UserCog,
    Plus,
    UserRound,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiDelete, apiGet, apiPatch } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getProfessorProfileImage(professor) {
    const raw =
        professor?.imagem_perfil_url ||
        professor?.pessoa?.imagem_perfil_url ||
        professor?.pessoa?.user?.imagem_perfil_url ||
        '';

    const value = String(raw || '').trim();
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${API_URL}${value}`;
    }

    return `${API_URL}/${value}`;
}

export default function FichaProfPage() {
    const navigate = useNavigate();
    const { id: profId } = useParams();

    const [prof, setProf] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState('');

    const carregarProf = useCallback(async function carregarProf() {
        if (!profId) {
            setError('ID do professor não especificado');
            setLoading(false);
            return;
        }

        try {
            setError('');
            const detailsResponse = await apiGet(
                `${API_URL}/api/gestor/professores/${profId}`
            );
            const detailsData = await detailsResponse.json();

            if (detailsResponse.ok) {
                setProf(detailsData.professor);
                return;
            }

            const endpointMissing =
                detailsResponse.status === 404 &&
                String(detailsData?.message || '').includes(
                    'não existe neste servidor'
                );

            if (endpointMissing) {
                const listResponse = await apiGet(
                    `${API_URL}/api/gestor/professores`
                );
                const listData = await listResponse.json();

                if (!listResponse.ok) {
                    throw new Error(
                        listData.message ||
                            'Erro ao carregar lista de professores.'
                    );
                }

                const profResumo = Array.isArray(listData?.professores)
                    ? listData.professores.find(
                          (item) => Number(item.id_professor) === Number(profId)
                      )
                    : null;

                if (!profResumo) {
                    throw new Error('Professor não encontrado.');
                }

                setProf({
                    id_professor: profResumo.id_professor,
                    habilitacao: profResumo.habilitacao,
                    area_ensino: profResumo.area_ensino,
                    nivel: profResumo.nivel,
                    pessoa: {
                        nome: profResumo.nome,
                        nif: profResumo.nif,
                        telemovel: profResumo.contacto,
                        user: {
                            email: profResumo.email,
                            status: profResumo.status,
                        },
                    },
                });
                return;
            }

            throw new Error(
                detailsData.message || 'Erro ao carregar dados do professor'
            );
        } catch (err) {
            setError(err.message || 'Erro ao carregar ficha do professor');
            console.error('Erro ao carregar professor:', err);
        } finally {
            setLoading(false);
        }
    }, [profId]);

    useEffect(() => {
        carregarProf();
    }, [carregarProf]);

    const professorAtivo = prof?.pessoa?.user?.status === true;

    async function handleToggleStatus() {
        if (!prof?.id_professor) {
            return;
        }

        const nextStatus = !professorAtivo;
        const confirmText = nextStatus
            ? 'Pretende ativar este professor?'
            : 'Pretende inativar este professor? Os serviços associados serão suspensos.';

        if (!window.confirm(confirmText)) {
            return;
        }

        try {
            setActionLoading(true);
            setActionMessage('');
            setError('');

            const response = await apiPatch(
                `${API_URL}/api/gestor/professores/${prof.id_professor}/status`,
                {
                    status: nextStatus,
                }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        'Não foi possível alterar o estado do professor.'
                );
            }

            setActionMessage(
                data.message || 'Estado do professor atualizado com sucesso.'
            );
            await carregarProf();
        } catch (err) {
            setError(err.message || 'Erro ao alterar estado do professor.');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleDeleteDefinitivo() {
        if (!prof?.id_professor) {
            return;
        }

        if (
            !window.confirm('Pretende eliminar este professor definitivamente?')
        ) {
            return;
        }

        try {
            setActionLoading(true);
            setActionMessage('');
            setError('');

            const response = await apiDelete(
                `${API_URL}/api/gestor/professores/${prof.id_professor}`
            );
            const data = await response.json();

            if (response.ok && data.deleted === true) {
                navigate('/gestor/professores', { replace: true });
                return;
            }

            if (response.status === 409) {
                setActionMessage(
                    data.message || 'Professor inativado e serviços suspensos.'
                );
                await carregarProf();
                return;
            }

            throw new Error(
                data.message || 'Não foi possível eliminar o professor.'
            );
        } catch (err) {
            setError(err.message || 'Erro ao eliminar professor.');
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-500">
                    Carregando ficha do professor...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
            </div>
        );
    }

    if (!prof) {
        return (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                Nenhum professor encontrado
            </div>
        );
    }

    const profImage = getProfessorProfileImage(prof);

    return (
        <section className="space-y-6">
            {actionMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {actionMessage}
                </div>
            ) : null}

            <AdminPageHeader
                eyebrow="Professores"
                title="Ficha de Professor"
                subtitle={
                    professorAtivo ? 'Professor ativo' : 'Professor inativo'
                }
                icon={UserRound}
                actions={
                    <>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            title="Download"
                        >
                            <Download size={14} />
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            title="Editar"
                            onClick={() =>
                                navigate(`/gestor/professores/update/${profId}`)
                            }
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            title={professorAtivo ? 'Inativar' : 'Ativar'}
                            onClick={handleToggleStatus}
                            disabled={actionLoading}
                        >
                            <EyeOff size={14} />
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            title="Eliminar definitivamente"
                            onClick={handleDeleteDefinitivo}
                            disabled={actionLoading}
                        >
                            <Trash size={14} />
                        </button>
                    </>
                }
            />

            <div className="flex items-center gap-4">
                <div className="flex items-center justify-center">
                    <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400 shadow-inner sm:h-40 sm:w-40">
                        {profImage ? (
                            <img
                                src={profImage}
                                alt="Foto de perfil do professor"
                                className="h-full w-full object-cover"
                                onError={(event) => {
                                    const img = event.currentTarget;
                                    img.style.display = 'none';
                                    const fallback =
                                        img.parentElement?.querySelector(
                                            '[data-profile-fallback="1"]'
                                        );
                                    if (fallback) {
                                        fallback.classList.remove('hidden');
                                    }
                                }}
                            />
                        ) : null}
                        <div
                            data-profile-fallback="1"
                            className={profImage ? 'hidden' : ''}
                        >
                            <UserRound size={72} strokeWidth={1.7} />
                        </div>
                    </div>
                </div>
                <p
                    className={`text-xs font-semibold uppercase ${professorAtivo ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                    {professorAtivo ? 'Ativo' : 'Inativo'}
                </p>
            </div>

            {/* Informações Pessoais */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Informações Pessoais
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nome Completo
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.nome || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Data de Nascimento
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.data_nasc
                                ? new Date(
                                      prof.pessoa.data_nasc
                                  ).toLocaleDateString('pt-PT')
                                : '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Cartão de Cidadão
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.cc || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            NIF
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.nif || '-'}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Email
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.user?.email || '-'}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Morada
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.morada || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Localidade
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.localidade || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Código Postal
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.cod_postal || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Telemóvel
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.telemovel || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Telefone
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.pessoa?.telefone || '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Informações Profissionais */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Informações Profissionais
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Habilitação
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.habilitacao || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Área de Ensino
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.area_ensino || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nível
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.nivel || '-'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Resumo Profissional
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Habilitação
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.habilitacao || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Área de Ensino
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.area_ensino || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nível
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {prof.nivel || '-'}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
