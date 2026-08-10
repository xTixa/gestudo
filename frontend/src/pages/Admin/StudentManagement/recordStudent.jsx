import { useEffect, useState } from 'react';
import {
    Download,
    Pencil,
    Trash,
    EyeOff,
    UserCog,
    Plus,
    UserRound,
    RefreshCw,
    X,
    BookOpen,
    Clock3,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/api';
import { gerarFichaAlunoPdf } from '../../../utils/fichaAlunoPdf';

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-PT');
}

function formatNivelEnsino(value) {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    const map = {
        '1_ciclo': '1º Ciclo',
        '2_ciclo': '2º Ciclo',
        '3_ciclo': '3º Ciclo',
        secundario: 'Secundário',
        ensino_superior: 'Ensino Superior',
    };
    const key = raw.toLowerCase().replace(/\s+/g, '_');
    return map[key] || raw.replace(/_/g, ' ');
}

function formatCurrency(value) {
    if (value == null || value === '') return '-';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(numeric);
}

function parseTimeToMinutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function formatDurationLabel(horaInicio, horaFim) {
    const inicio = parseTimeToMinutes(horaInicio);
    const fim = parseTimeToMinutes(horaFim);
    if (inicio == null || fim == null || fim <= inicio) return '-';
    const totalMinutes = fim - inicio;
    const horas = Math.floor(totalMinutes / 60);
    const minutos = totalMinutes % 60;
    if (minutos === 0) return `${horas}h`;
    return `${horas}h${String(minutos).padStart(2, '0')}`;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// função para formatar uma data em formato ISO ou português para o formato de data local, retornando um hífen caso o valor seja inválido ou ausente, garantindo que as datas sejam apresentadas de forma legível e consistente na interface
function getAlunoProfileImage(aluno) {
    const raw =
        aluno?.imagem_perfil_url ||
        aluno?.pessoa?.imagem_perfil_url ||
        aluno?.pessoa?.user?.imagem_perfil_url ||
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

export default function FichaAlunoPage() {
    const navigate = useNavigate();
    const { id: alunoId } = useParams();

    const [aluno, setAluno] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        mode: null,
        keyword: '',
    });
    const [servicoModal, setServicoModal] = useState({
        open: false,
        loading: false,
        submitting: false,
        error: '',
        servicos: [],
        selectedId: '',
    });
    const [removingServicoId, setRemovingServicoId] = useState(null);
    const [novaDisciplinaPretendida, setNovaDisciplinaPretendida] =
        useState('');
    const [disciplinasPretendidasSaving, setDisciplinasPretendidasSaving] =
        useState(false);
    const [disciplinasCatalogo, setDisciplinasCatalogo] = useState([]);

    useEffect(() => {
        let isMounted = true;

        async function carregarDisciplinasCatalogo() {
            try {
                const response = await apiGet('/api/gestor/disciplinas');
                const data = await response.json();

                if (!response.ok || !isMounted) {
                    return;
                }

                const disciplinas = Array.isArray(data?.disciplinas)
                    ? data.disciplinas
                    : [];

                setDisciplinasCatalogo(
                    disciplinas
                        .filter((item) => item?.ativa !== false)
                        .map((item) => ({
                            id: item.id_disciplina ?? item.id,
                            nome: item.nome,
                        }))
                        .filter((item) => item.nome)
                );
            } catch (err) {
                console.error('Erro ao carregar catálogo de disciplinas:', err);
            }
        }

        carregarDisciplinasCatalogo();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function carregarAluno() {
            if (!alunoId) {
                if (isMounted) {
                    setError('ID do aluno não especificado');
                    setLoading(false);
                }
                return;
            }

            try {
                const detailsResponse = await apiGet(
                    `/api/gestor/alunos/${alunoId}`
                );
                const detailsData = await detailsResponse.json();

                if (detailsResponse.ok) {
                    if (isMounted) {
                        setAluno(detailsData.aluno);
                    }
                    return;
                }

                const endpointMissing =
                    detailsResponse.status === 404 &&
                    String(detailsData?.message || '').includes(
                        'não existe neste servidor'
                    );

                if (endpointMissing) {
                    const listResponse = await apiGet('/api/gestor/alunos');
                    const listData = await listResponse.json();

                    if (!listResponse.ok) {
                        throw new Error(
                            listData.message ||
                                'Erro ao carregar lista de alunos.'
                        );
                    }

                    const alunoResumo = Array.isArray(listData?.alunos)
                        ? listData.alunos.find(
                              (item) =>
                                  Number(item.id_aluno) === Number(alunoId)
                          )
                        : null;

                    if (!alunoResumo) {
                        throw new Error('Aluno não encontrado.');
                    }

                    if (isMounted) {
                        setAluno({
                            id_aluno: alunoResumo.id_aluno,
                            escola: alunoResumo.escola,
                            ano: alunoResumo.ano,
                            turma: alunoResumo.turma,
                            pessoa: {
                                nome: alunoResumo.nome,
                                nif: alunoResumo.nif,
                                telemovel: alunoResumo.contacto,
                                user: {
                                    email: alunoResumo.email,
                                },
                            },
                            encarregado: {
                                pessoa: {
                                    nome: alunoResumo.encarregado,
                                },
                            },
                        });
                    }
                    return;
                }

                throw new Error(
                    detailsData.message || 'Erro ao carregar dados do aluno'
                );
            } catch (err) {
                if (isMounted) {
                    setError(err.message || 'Erro ao carregar ficha do aluno');
                    console.error('Erro ao carregar aluno:', err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregarAluno();

        return () => {
            isMounted = false;
        };
    }, [alunoId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-500">
                    Carregando ficha do aluno...
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

    if (!aluno) {
        return (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                Nenhum aluno encontrado
            </div>
        );
    }

    function abrirModalConfirmacao(mode) {
        setActionMessage('');
        setError('');
        setConfirmModal({
            open: true,
            mode,
            keyword: '',
        });
    }

    function fecharModalConfirmacao() {
        if (actionLoading) {
            return;
        }

        setConfirmModal({
            open: false,
            mode: null,
            keyword: '',
        });
    }

    async function handleStandByAluno() {
        if (!alunoId) {
            return;
        }

        setActionLoading(true);
        setActionMessage('');
        setError('');

        try {
            const response = await apiPatch(
                `/api/gestor/alunos/${alunoId}/status`,
                {
                    status: false,
                }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        'Não foi possível colocar o aluno em stand by.'
                );
            }

            setAluno((prev) =>
                prev
                    ? {
                          ...prev,
                          user: {
                              ...(prev.user || {}),
                              status: false,
                          },
                      }
                    : prev
            );
            setActionMessage(
                data?.message || 'Aluno colocado em stand by com sucesso.'
            );
            fecharModalConfirmacao();
        } catch (err) {
            setError(
                err?.message || 'Não foi possível colocar o aluno em stand by.'
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleEliminarAluno() {
        if (!alunoId) {
            return;
        }

        if (confirmModal.keyword !== 'ELIMINAR') {
            setError('Confirmação inválida. Escreve ELIMINAR para continuar.');
            return;
        }

        setActionLoading(true);
        setActionMessage('');
        setError('');

        try {
            const response = await apiDelete(`/api/gestor/alunos/${alunoId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Não foi possível eliminar o aluno.'
                );
            }

            navigate('/gestor/alunos', {
                replace: true,
                state: {
                    successMessage:
                        data?.message || 'Aluno eliminado definitivamente.',
                },
            });
        } catch (err) {
            setError(err?.message || 'Não foi possível eliminar o aluno.');
            setActionLoading(false);
        }
    }

    async function confirmarAcaoModal() {
        if (confirmModal.mode === 'standby') {
            await handleStandByAluno();
            return;
        }

        if (confirmModal.mode === 'delete') {
            await handleEliminarAluno();
        }
    }

    async function handleResetPassword() {
        if (!alunoId) return;
        setResetLoading(true);
        setActionMessage('');
        setError('');
        try {
            const response = await apiPost(
                `/api/gestor/alunos/${alunoId}/reset-password`,
                {}
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao reenviar credenciais.');
            }
            setActionMessage(
                data?.message || 'Credenciais reenviadas por email com sucesso.'
            );
        } catch (err) {
            setError(err?.message || 'Erro ao reenviar credenciais.');
        } finally {
            setResetLoading(false);
        }
    }

    const alunoImage = getAlunoProfileImage(aluno);
    const servicosSubscritos = Array.isArray(aluno.servicosSubscritos)
        ? aluno.servicosSubscritos
        : [];
    const disciplinasPretendidas = Array.isArray(aluno.disciplinasPretendidas)
        ? aluno.disciplinasPretendidas
        : [];
    const disciplinasComServico = new Set(
        servicosSubscritos
            .map((servico) => String(servico.disciplina || '').toLowerCase())
            .filter(Boolean)
    );
    const disciplinasPretendidasLower = new Set(
        disciplinasPretendidas.map((item) =>
            String(typeof item === 'string' ? item : item?.disciplina || '').toLowerCase()
        )
    );
    const disciplinasDisponiveisParaAdicionar = disciplinasCatalogo.filter(
        (disciplina) =>
            !disciplinasPretendidasLower.has(disciplina.nome.toLowerCase())
    );

    function handleDownloadFicha() {
        gerarFichaAlunoPdf(aluno);
    }

    async function refetchAluno() {
        const response = await apiGet(`/api/gestor/alunos/${alunoId}`);
        const data = await response.json();
        if (response.ok) {
            setAluno(data.aluno);
        }
    }

    async function abrirModalServico() {
        setServicoModal({
            open: true,
            loading: true,
            submitting: false,
            error: '',
            servicos: [],
            selectedId: '',
        });

        try {
            const response = await apiGet('/api/gestor/servicos/curriculares');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Erro ao carregar serviços curriculares.'
                );
            }

            const todosServicos = Array.isArray(data?.servicos)
                ? data.servicos
                : [];
            const disponiveis = todosServicos.filter(
                (servico) =>
                    !servico.alunosIds?.includes(Number(alunoId))
            );

            setServicoModal((prev) => ({
                ...prev,
                loading: false,
                servicos: disponiveis,
                selectedId: disponiveis[0]?.id ? String(disponiveis[0].id) : '',
            }));
        } catch (err) {
            setServicoModal((prev) => ({
                ...prev,
                loading: false,
                error:
                    err?.message || 'Erro ao carregar serviços curriculares.',
            }));
        }
    }

    function fecharModalServico() {
        if (servicoModal.submitting) return;
        setServicoModal({
            open: false,
            loading: false,
            submitting: false,
            error: '',
            servicos: [],
            selectedId: '',
        });
    }

    async function confirmarNovoServico() {
        if (!servicoModal.selectedId) return;

        setServicoModal((prev) => ({ ...prev, submitting: true, error: '' }));

        try {
            const response = await apiPost(
                `/api/gestor/alunos/${alunoId}/servicos-curriculares`,
                { id_servico: Number(servicoModal.selectedId) }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Não foi possível adicionar o serviço.'
                );
            }

            await refetchAluno();
            fecharModalServico();
            setActionMessage(
                data?.message || 'Serviço adicionado com sucesso.'
            );
        } catch (err) {
            setServicoModal((prev) => ({
                ...prev,
                submitting: false,
                error: err?.message || 'Não foi possível adicionar o serviço.',
            }));
        }
    }

    async function handleRemoverServico(servico) {
        if (!servico?.id_servico) return;
        if (
            !window.confirm(
                `Remover o serviço "${servico.tipoServico || servico.modalidade || 'Serviço'}" deste aluno?`
            )
        ) {
            return;
        }

        setRemovingServicoId(servico.id_servico);
        setActionMessage('');
        setError('');

        try {
            const response = await apiDelete(
                `/api/gestor/alunos/${alunoId}/servicos/${servico.id_servico}`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Não foi possível remover o serviço.'
                );
            }

            await refetchAluno();
            setActionMessage(data?.message || 'Serviço removido com sucesso.');
        } catch (err) {
            setError(err?.message || 'Não foi possível remover o serviço.');
        } finally {
            setRemovingServicoId(null);
        }
    }

    async function salvarDisciplinasPretendidas(novaLista) {
        setDisciplinasPretendidasSaving(true);
        setError('');

        try {
            const response = await apiPatch(
                `/api/gestor/alunos/${alunoId}/disciplinas-pretendidas`,
                { disciplinas: novaLista }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        'Não foi possível atualizar as disciplinas pretendidas.'
                );
            }

            setAluno((prev) =>
                prev
                    ? {
                          ...prev,
                          disciplinasPretendidas: data.disciplinasPretendidas,
                      }
                    : prev
            );
        } catch (err) {
            setError(
                err?.message ||
                    'Não foi possível atualizar as disciplinas pretendidas.'
            );
        } finally {
            setDisciplinasPretendidasSaving(false);
        }
    }

    async function handleAdicionarDisciplinaPretendida(event) {
        event.preventDefault();
        const nome = novaDisciplinaPretendida.trim();
        if (!nome) return;

        await salvarDisciplinasPretendidas([
            ...disciplinasPretendidas,
            nome,
        ]);
        setNovaDisciplinaPretendida('');
    }

    async function handleRemoverDisciplinaPretendida(nome) {
        await salvarDisciplinasPretendidas(
            disciplinasPretendidas.filter((item) => {
                const itemNome = typeof item === 'string' ? item : item?.disciplina;
                return itemNome !== nome;
            })
        );
    }

    return (
        <section className="space-y-6">
            {actionMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {actionMessage}
                </div>
            ) : null}

            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center">
                        <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400 shadow-inner sm:h-40 sm:w-40">
                            {alunoImage ? (
                                <img
                                    src={alunoImage}
                                    alt="Foto de perfil do aluno"
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
                                className={alunoImage ? 'hidden' : ''}
                            >
                                <UserRound size={72} strokeWidth={1.7} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <p className="text-2xl font-semibold text-slate-800">
                            Ficha de Aluno
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        title="Download ficha"
                        onClick={handleDownloadFicha}
                    >
                        <Download size={14} />
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        title="Editar"
                        onClick={() =>
                            navigate(`/gestor/alunos/update/${alunoId}`)
                        }
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        type="button"
                        disabled={resetLoading}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Reenviar credenciais por email"
                        onClick={handleResetPassword}
                    >
                        <RefreshCw size={14} />
                        {resetLoading ? 'A enviar...' : 'Reenviar credenciais'}
                    </button>
                    <button
                        type="button"
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        title="Desativar"
                        onClick={() => abrirModalConfirmacao('standby')}
                    >
                        <EyeOff size={14} />
                    </button>
                    <button
                        type="button"
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        title="Eliminar"
                        onClick={() => abrirModalConfirmacao('delete')}
                    >
                        <Trash size={14} />
                    </button>
                </div>
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
                            {aluno.pessoa?.nome || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Data de Nascimento
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.data_nasc
                                ? new Date(
                                      aluno.pessoa.data_nasc
                                  ).toLocaleDateString('pt-PT')
                                : '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Cartão de Cidadão
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.cc || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            NIF
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.nif || '-'}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Email
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.user?.email || '-'}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Morada
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.morada || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Localidade
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.localidade || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Código Postal
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.cod_postal || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Telemóvel
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.telemovel || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Telefone
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.pessoa?.telefone || '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Informações Escolares */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Informações Escolares
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Escola
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.escola || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Ano
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.ano || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Turma
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.turma || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nível de Ensino
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {formatNivelEnsino(aluno.nivel_ensino)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Data de Início
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {formatDate(aluno.data_inicio)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Serviços Pretendidos */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Serviços Pretendidos
                    </h2>
                </div>

                {disciplinasPretendidas.length === 0 ? (
                    <p className="mb-4 text-sm text-slate-500">
                        Não existem serviços pretendidos registados para
                        este aluno.
                    </p>
                ) : (
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {disciplinasPretendidas.map((item) => {
                            const isObjeto = item && typeof item === 'object';
                            const nome = isObjeto ? item.disciplina : item;
                            const tipoServico = isObjeto ? item.tipoServico : null;
                            const modalidade = isObjeto ? item.modalidade : null;
                            const horas = isObjeto ? item.horas : null;
                            const temServico = disciplinasComServico.has(
                                String(nome || '').toLowerCase()
                            );
                            return (
                                <div
                                    key={nome}
                                    className={`rounded-lg border p-4 ${
                                        temServico
                                            ? 'border-emerald-200 bg-emerald-50'
                                            : 'border-amber-200 bg-amber-50'
                                    }`}
                                >
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <BookOpen
                                                size={15}
                                                className={
                                                    temServico
                                                        ? 'text-emerald-600 shrink-0'
                                                        : 'text-amber-600 shrink-0'
                                                }
                                            />
                                            <p className="truncate text-sm font-semibold text-slate-800">
                                                {nome}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoverDisciplinaPretendida(
                                                    nome
                                                )
                                            }
                                            disabled={disciplinasPretendidasSaving}
                                            title="Remover"
                                            className="shrink-0 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                                        <span
                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                                temServico
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}
                                        >
                                            {temServico ? 'Com serviço' : 'Sem serviço'}
                                        </span>
                                        <span>
                                            {tipoServico || modalidade
                                                ? [tipoServico, modalidade].filter(Boolean).join(' · ')
                                                : 'Modalidade não indicada'}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Clock3 size={12} />
                                            {horas ? `${horas}h/mês pretendidas` : 'Horas não indicadas'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <form
                    onSubmit={handleAdicionarDisciplinaPretendida}
                    className="flex gap-2"
                >
                    <select
                        value={novaDisciplinaPretendida}
                        onChange={(event) =>
                            setNovaDisciplinaPretendida(event.target.value)
                        }
                        className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        disabled={
                            disciplinasPretendidasSaving ||
                            disciplinasDisponiveisParaAdicionar.length === 0
                        }
                    >
                        <option value="">
                            {disciplinasDisponiveisParaAdicionar.length === 0
                                ? 'Sem disciplinas disponíveis'
                                : 'Selecionar disciplina...'}
                        </option>
                        {disciplinasDisponiveisParaAdicionar.map(
                            (disciplina) => (
                                <option
                                    key={disciplina.id ?? disciplina.nome}
                                    value={disciplina.nome}
                                >
                                    {disciplina.nome}
                                </option>
                            )
                        )}
                    </select>
                    <button
                        type="submit"
                        disabled={
                            disciplinasPretendidasSaving ||
                            !novaDisciplinaPretendida
                        }
                        className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Plus size={14} />
                        Adicionar
                    </button>
                </form>
            </div>

            {/* Serviços Subscritos */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-1 rounded bg-blue-500" />
                        <h2 className="text-base font-semibold text-slate-800">
                            Serviços Subscritos
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={abrirModalServico}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-100"
                    >
                        <Plus size={14} />
                        Novo Serviço
                    </button>
                </div>

                {servicosSubscritos.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        Não existem serviços subscritos para este aluno.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {servicosSubscritos.map((servico, idx) => (
                            <div
                                key={servico.id_servico ?? idx}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                            >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-700">
                                        {servico.tipoServico ||
                                            servico.modalidade ||
                                            'Serviço'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleRemoverServico(servico)
                                        }
                                        disabled={
                                            removingServicoId ===
                                            servico.id_servico
                                        }
                                        className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Trash size={12} />
                                        {removingServicoId ===
                                        servico.id_servico
                                            ? 'A remover...'
                                            : 'Remover'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Modalidade
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {servico.modalidade || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Nº Horas/Mês
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {formatDurationLabel(
                                                servico.horaInicio,
                                                servico.horaFim
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Disciplina
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {servico.disciplina ||
                                                servico.area ||
                                                '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Preço
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {formatCurrency(servico.valor)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Data Inscrição
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {formatDate(servico.dataInscricao)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Data Início
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {formatDate(servico.dataInicio)}
                                        </p>
                                    </div>
                                    {servico.pacoteDescricao ? (
                                        <div className="md:col-span-2">
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Pacote
                                            </p>
                                            <p className="mt-1 text-sm text-slate-700">
                                                {servico.pacoteDescricao}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Encarregado de Educação */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Encarregado de Educação
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nome Completo
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.nome || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Parentesco
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.parentesco || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Email
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.user?.email || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Telemóvel
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.telemovel || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Telefone
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.telefone || '-'}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Morada
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.morada || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Localidade
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.localidade || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Código Postal
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.encarregado?.pessoa?.cod_postal || '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Autorização de Saída */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Autorização de Saída
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nome (1)
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.aut_saida_nome_1 || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Parentesco (1)
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.aut_saida_parentesco_1 || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Nome (2)
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.aut_saida_nome_2 || '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                            Parentesco (2)
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                            {aluno.aut_saida_parentesco_2 || '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Observações */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">
                        Observações
                    </h2>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {aluno.observacoes || '-'}
                </p>
            </div>

            {confirmModal.open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45"
                        onClick={fecharModalConfirmacao}
                        aria-label="Fechar confirmação"
                    />

                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Confirmação
                            </p>
                            <h3
                                className={`mt-1 text-lg font-semibold ${
                                    confirmModal.mode === 'delete'
                                        ? 'text-red-700'
                                        : 'text-slate-800'
                                }`}
                            >
                                {confirmModal.mode === 'delete'
                                    ? 'Eliminar aluno definitivamente?'
                                    : 'Colocar aluno em stand by?'}
                            </h3>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            <p className="text-sm text-slate-600">
                                {confirmModal.mode === 'delete'
                                    ? 'Esta ação é irreversível e remove os dados do aluno. Para continuar, confirma explicitamente abaixo.'
                                    : 'O aluno ficará inativo e deixará de aceder à plataforma até ser reativado.'}
                            </p>

                            {confirmModal.mode === 'delete' ? (
                                <div className="space-y-2">
                                    <label
                                        htmlFor="confirmar-eliminar-aluno"
                                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                    >
                                        Escreve ELIMINAR para confirmar
                                    </label>
                                    <input
                                        id="confirmar-eliminar-aluno"
                                        type="text"
                                        value={confirmModal.keyword}
                                        onChange={(event) =>
                                            setConfirmModal((prev) => ({
                                                ...prev,
                                                keyword:
                                                    event.target.value || '',
                                            }))
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                        placeholder="ELIMINAR"
                                        autoComplete="off"
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={fecharModalConfirmacao}
                                disabled={actionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                                    confirmModal.mode === 'delete'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-amber-600 hover:bg-amber-700'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                onClick={confirmarAcaoModal}
                                disabled={
                                    actionLoading ||
                                    (confirmModal.mode === 'delete' &&
                                        confirmModal.keyword !== 'ELIMINAR')
                                }
                            >
                                {actionLoading
                                    ? 'A processar...'
                                    : confirmModal.mode === 'delete'
                                      ? 'Eliminar definitivamente'
                                      : 'Confirmar stand by'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {servicoModal.open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45"
                        onClick={fecharModalServico}
                        aria-label="Fechar"
                    />

                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Serviços Subscritos
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-800">
                                Adicionar Novo Serviço
                            </h3>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            {servicoModal.error ? (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {servicoModal.error}
                                </p>
                            ) : null}

                            {servicoModal.loading ? (
                                <p className="text-sm text-slate-500">
                                    A carregar serviços disponíveis...
                                </p>
                            ) : servicoModal.servicos.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    Não existem serviços curriculares
                                    disponíveis para adicionar (o aluno já
                                    está inscrito em todos, ou não há
                                    serviços ativos).
                                </p>
                            ) : (
                                <label className="block">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Serviço
                                    </span>
                                    <select
                                        value={servicoModal.selectedId}
                                        onChange={(event) =>
                                            setServicoModal((prev) => ({
                                                ...prev,
                                                selectedId: event.target.value,
                                            }))
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    >
                                        {servicoModal.servicos.map((servico) => (
                                            <option key={servico.id} value={servico.id}>
                                                {servico.area} — {servico.modalidade}
                                                {servico.tipoServico
                                                    ? ` (${servico.tipoServico})`
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={fecharModalServico}
                                disabled={servicoModal.submitting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={confirmarNovoServico}
                                disabled={
                                    servicoModal.submitting ||
                                    servicoModal.loading ||
                                    !servicoModal.selectedId
                                }
                            >
                                {servicoModal.submitting
                                    ? 'A adicionar...'
                                    : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
