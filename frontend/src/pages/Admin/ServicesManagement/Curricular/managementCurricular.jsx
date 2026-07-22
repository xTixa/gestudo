import { useEffect, useMemo, useState } from 'react';
import {
    BookOpenCheck,
    Funnel,
    Plus,
    Search,
    Pencil,
    Trash2,
    Eye,
    X,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
} from 'lucide-react';
import AdminPageHeader from '../../../../components/layout/AdminPageHeader';
import ServicePreviewDrawer from '../../../../components/services/ServicePreviewDrawer';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../../utils/api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// mensagens de erro de rede do browser (ex: "Load failed", "Failed to fetch")
// não são compreensíveis para o utilizador; traduzimos para algo claro
const NETWORK_ERROR_PATTERNS = ['load failed', 'failed to fetch', 'networkerror'];

function friendlyErrorMessage(error, fallback) {
    const raw = String(error?.message || '').toLowerCase();
    if (NETWORK_ERROR_PATTERNS.some((pattern) => raw.includes(pattern))) {
        return 'Não foi possível ligar ao servidor. Verifique a sua ligação e tente novamente.';
    }
    return error?.message || fallback;
}

// opções fixas para os dias da semana, com chaves que correspondem ao formato esperado pela API e rótulos legíveis para exibição no formulário
const weekDayOptions = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
];

// classes CSS reutilizáveis para os rótulos dos campos e os inputs do formulário, garantindo consistência visual e facilitando a manutenção do código
const fieldLabelClass =
    'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const inputClass =
    'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100';

// função para obter os dados iniciais do formulário, garantindo que todos os campos estejam definidos com valores padrão, o que facilita a criação de um novo serviço ou a edição de um serviço existente sem erros de campos indefinidos
function getInitialFormData() {
    return {
        serviceType: 'unico',
        tipoServico: '',
        modalidadeId: '',
        nivelEnsino: '',
        disciplinaId: '',
        professorId: '',
        salaId: '',
        dataInicio: '',
        horaInicio: '',
        duracao: '60',
        diasSemana: [],
        alunosIds: [],
        aplicarDesde: '',
    };
}

function getTomorrowDateKey() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// função para extrair os valores únicos de um array de objetos com base em uma chave específica, adicionando a opção "Todos" no início da lista para permitir a seleção de todos os valores em um filtro
function uniqueValues(rows, key) {
    return ['Todos', ...new Set(rows.map((row) => row[key]))];
}

// função para normalizar um texto, removendo acentos, convertendo para minúsculas e limpando espaços extras, o que facilita a comparação de strings de forma mais flexível e tolerante a variações de formatação
function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// função para extrair o ano escolar de um aluno a partir de uma string, tentando encontrar o primeiro número presente, o que permite associar alunos a níveis de ensino mesmo que a informação do ano esteja em um formato não estruturado
function getSchoolYearFromAluno(aluno) {
    const match = String(aluno?.ano || '').match(/\d+/);
    return match ? Number(match[0]) : null;
}

// função para verificar se um aluno corresponde a um nível de ensino específico, usando o nome do nível para identificar padrões comuns como "1º ciclo", "2º ciclo", "secundário" e "superior", e associando esses padrões a faixas de anos escolares, o que permite filtrar os alunos de acordo com o nível de ensino selecionado no formulário
function alunoMatchesNivel(aluno, nivelNome) {
    const nivel = normalizeText(nivelNome);
    const ano = getSchoolYearFromAluno(aluno);

    if (!nivel) {
        return true;
    }

    if (nivel.includes('1') && nivel.includes('ciclo')) {
        return ano != null && ano >= 1 && ano <= 3;
    }

    if (nivel.includes('2') && nivel.includes('ciclo')) {
        return ano === 5 || ano === 6;
    }

    if (nivel.includes('3') && nivel.includes('ciclo')) {
        return ano != null && ano >= 7 && ano <= 9;
    }

    if (nivel.includes('secund')) {
        return ano != null && ano >= 10 && ano <= 12;
    }

    if (nivel.includes('superior')) {
        if (ano != null) {
            return ano > 12;
        }
        return normalizeText(aluno?.ano).includes('superior');
    }

    return true;
}

// função para obter a chave do dia da semana a partir de uma data, convertendo a data para um objeto Date e usando o método getDay para obter o índice do dia da semana, e mapeando esse índice para as chaves correspondentes, com um fallback para "segunda" caso a data seja inválida ou o índice não corresponda a nenhum dia
function getWeekDayKeyFromDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return 'segunda';
    }

    const keys = [
        'domingo',
        'segunda',
        'terca',
        'quarta',
        'quinta',
        'sexta',
        'sabado',
    ];
    return keys[date.getDay()] || 'segunda';
}

function addMinutesToTime(timeValue, minutesToAdd) {
    const [hours, minutes] = String(timeValue || '')
        .split(':')
        .map(Number);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        !Number.isFinite(Number(minutesToAdd))
    ) {
        return '';
    }

    const totalMinutes = hours * 60 + minutes + Number(minutesToAdd);
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const nextHours = String(Math.floor(normalized / 60)).padStart(2, '0');
    const nextMinutes = String(normalized % 60).padStart(2, '0');
    return `${nextHours}:${nextMinutes}`;
}

export default function GestaoCurricularPage() {
    const [services, setServices] = useState([]);
    const [filters, setFilters] = useState({
        search: '',
        tipoServico: 'Todos',
        modalidade: 'Todos',
        nivelEnsino: 'Todos',
        area: 'Todos',
    });
    const [sort, setSort] = useState({ field: null, dir: 'asc' });
    const [isModalOpen, setIsModalOpen] = useState(false);

    function handleSort(field) {
        setSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'asc' }
        );
    }
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [formData, setFormData] = useState(getInitialFormData);
    const [formError, setFormError] = useState('');
    const [pageError, setPageError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [previewService, setPreviewService] = useState(null);
    const [loadingSalas, setLoadingSalas] = useState(false);
    const [salasDisponiveis, setSalasDisponiveis] = useState([]);
    const [salasDisponiveisReady, setSalasDisponiveisReady] = useState(false);
    const [salasError, setSalasError] = useState('');
    const [deletingServiceId, setDeletingServiceId] = useState(null);
    const [pendingDeleteServiceId, setPendingDeleteServiceId] = useState(null);
    const [opcoes, setOpcoes] = useState({
        tiposServico: [],
        modalidades: [],
        disciplinas: [],
        niveisEnsino: [],
        professores: [],
        salas: [],
        alunos: [],
    });
    const isEditing = Boolean(editingServiceId);

    const filterOptions = useMemo(
        () => ({
            tipoServico: uniqueValues(services, 'tipoServico'),
            modalidade: uniqueValues(services, 'modalidade'),
            nivelEnsino: uniqueValues(services, 'nivelEnsino'),
            area: uniqueValues(services, 'area'),
        }),
        [services]
    );

    const rows = useMemo(() => {
        const term = filters.search.trim().toLowerCase();

        const filtered = services.filter((row) => {
            const matchesSearch =
                !term ||
                [
                    row.tipoServico,
                    row.modalidade,
                    row.nivelEnsino,
                    row.area,
                    row.periodicidade,
                ].some((value) => value.toLowerCase().includes(term));

            const matchesTipo =
                filters.tipoServico === 'Todos' ||
                row.tipoServico === filters.tipoServico;
            const matchesModalidade =
                filters.modalidade === 'Todos' ||
                row.modalidade === filters.modalidade;
            const matchesNivel =
                filters.nivelEnsino === 'Todos' ||
                row.nivelEnsino === filters.nivelEnsino;
            const matchesArea =
                filters.area === 'Todos' || row.area === filters.area;

            return (
                matchesSearch &&
                matchesTipo &&
                matchesModalidade &&
                matchesNivel &&
                matchesArea
            );
        });

        if (!sort.field) return filtered;
        const mod = sort.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            let av = a[sort.field];
            let bv = b[sort.field];
            if (av == null && bv == null) return 0;
            if (av == null) return mod;
            if (bv == null) return -mod;
            if (!isNaN(Number(av)) && !isNaN(Number(bv)))
                return (Number(av) - Number(bv)) * mod;
            return String(av).localeCompare(String(bv), 'pt') * mod;
        });
    }, [filters, services, sort]);

    const disciplinasFiltradas = useMemo(() => {
        if (!formData.nivelEnsino) {
            return opcoes.disciplinas;
        }

        return opcoes.disciplinas.filter(
            (disciplina) =>
                String(disciplina.nivelId) === String(formData.nivelEnsino)
        );
    }, [formData.nivelEnsino, opcoes.disciplinas]);

    const alunosFiltrados = useMemo(() => {
        if (!formData.nivelEnsino) {
            return [];
        }

        const nivelSelecionado = opcoes.niveisEnsino.find(
            (nivel) => String(nivel.id) === String(formData.nivelEnsino)
        );

        return opcoes.alunos.filter((aluno) =>
            alunoMatchesNivel(aluno, nivelSelecionado?.nome)
        );
    }, [formData.nivelEnsino, opcoes.alunos, opcoes.niveisEnsino]);

    const salasParaSelecionar = useMemo(() => {
        if (!salasDisponiveisReady) {
            return opcoes.salas;
        }

        const selectedSala = opcoes.salas.find(
            (sala) => String(sala.id) === String(formData.salaId)
        );
        const availableIds = new Set(
            salasDisponiveis.map((sala) => String(sala.id))
        );

        if (selectedSala && !availableIds.has(String(selectedSala.id))) {
            return [selectedSala, ...salasDisponiveis];
        }

        return salasDisponiveis;
    }, [
        formData.salaId,
        opcoes.salas,
        salasDisponiveis,
        salasDisponiveisReady,
    ]);

    const selectedSalaIndisponivel = useMemo(() => {
        if (!salasDisponiveisReady || !formData.salaId) {
            return false;
        }

        return !salasDisponiveis.some(
            (sala) => String(sala.id) === String(formData.salaId)
        );
    }, [formData.salaId, salasDisponiveis, salasDisponiveisReady]);

    function updateFilter(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }

    useEffect(() => {
        let isMounted = true;

        async function carregarDados() {
            setLoading(true);
            setPageError('');

            try {
                const [servicosResponse, opcoesResponse] = await Promise.all([
                    apiGet(`${API_URL}/api/gestor/servicos/curriculares`),
                    apiGet(
                        `${API_URL}/api/gestor/servicos/curriculares/opcoes`
                    ),
                ]);

                const servicosData = await servicosResponse.json();
                const opcoesData = await opcoesResponse.json();

                if (!servicosResponse.ok) {
                    throw new Error(
                        servicosData.message ||
                            'Erro ao carregar serviços curriculares.'
                    );
                }

                if (!opcoesResponse.ok) {
                    throw new Error(
                        opcoesData.message ||
                            'Erro ao carregar opções de serviço.'
                    );
                }

                if (isMounted) {
                    const tiposServico = Array.isArray(opcoesData?.tiposServico)
                        ? opcoesData.tiposServico
                              .filter(
                                  (item) =>
                                      item &&
                                      typeof item === 'object' &&
                                      item.id != null
                              )
                              .map((item) => ({
                                  id: String(item.id),
                                  nome: String(item.nome || ''),
                              }))
                              .filter((item) => item.nome.trim().length > 0)
                        : [];

                    setServices(
                        Array.isArray(servicosData?.servicos)
                            ? servicosData.servicos
                            : []
                    );
                    setOpcoes({
                        tiposServico,
                        modalidades: Array.isArray(opcoesData?.modalidades)
                            ? opcoesData.modalidades
                            : [],
                        disciplinas: Array.isArray(opcoesData?.disciplinas)
                            ? opcoesData.disciplinas
                            : [],
                        niveisEnsino: Array.isArray(opcoesData?.niveisEnsino)
                            ? opcoesData.niveisEnsino
                            : [],
                        professores: Array.isArray(opcoesData?.professores)
                            ? opcoesData.professores
                            : [],
                        salas: Array.isArray(opcoesData?.salas)
                            ? opcoesData.salas
                            : [],
                        alunos: Array.isArray(opcoesData?.alunos)
                            ? opcoesData.alunos
                            : [],
                    });
                }
            } catch (fetchError) {
                if (isMounted) {
                    setPageError(
                        friendlyErrorMessage(
                            fetchError,
                            'Erro ao carregar dados.'
                        )
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregarDados();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!formData.alunosIds.length) {
            return;
        }

        const allowedIds = new Set(alunosFiltrados.map((aluno) => aluno.id));
        setFormData((prev) => ({
            ...prev,
            alunosIds: prev.alunosIds.filter((id) => allowedIds.has(id)),
        }));
    }, [alunosFiltrados, formData.alunosIds.length]);

    useEffect(() => {
        let isMounted = true;
        const dataReferencia = isEditing
            ? formData.aplicarDesde || formData.dataInicio
            : formData.dataInicio;
        const horaFim = addMinutesToTime(formData.horaInicio, formData.duracao);

        const diasParaConsulta =
            formData.serviceType === 'unico'
                ? dataReferencia
                    ? [getWeekDayKeyFromDate(dataReferencia)]
                    : []
                : formData.diasSemana;

        if (
            !isModalOpen ||
            !dataReferencia ||
            !formData.horaInicio ||
            !horaFim ||
            !diasParaConsulta.length
        ) {
            setSalasDisponiveis([]);
            setSalasDisponiveisReady(false);
            setSalasError('');
            setLoadingSalas(false);
            return () => {
                isMounted = false;
            };
        }

        async function carregarSalasDisponiveis() {
            setLoadingSalas(true);
            setSalasError('');

            try {
                const params = new URLSearchParams({
                    data: dataReferencia,
                    horaInicio: formData.horaInicio,
                    horaFim,
                    diasSemana: JSON.stringify(diasParaConsulta),
                });

                if (editingServiceId) {
                    params.set('excluirIdServico', String(editingServiceId));
                }

                const response = await apiGet(
                    `${API_URL}/api/gestor/servicos/salas-disponiveis?${params.toString()}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar salas disponiveis.'
                    );
                }

                if (isMounted) {
                    const salas = Array.isArray(data?.salas) ? data.salas : [];
                    setSalasDisponiveis(
                        salas.map((sala) => ({
                            id: String(sala.id_sala ?? sala.id),
                            nome: String(sala.nome || sala.sala || 'Sala'),
                            capacidade: sala.capacidade,
                        }))
                    );
                    setSalasDisponiveisReady(true);
                }
            } catch (error) {
                if (isMounted) {
                    setSalasDisponiveis([]);
                    setSalasDisponiveisReady(false);
                    setSalasError(
                        friendlyErrorMessage(
                            error,
                            'Erro ao carregar salas disponiveis.'
                        )
                    );
                }
            } finally {
                if (isMounted) {
                    setLoadingSalas(false);
                }
            }
        }

        carregarSalasDisponiveis();

        return () => {
            isMounted = false;
        };
    }, [
        editingServiceId,
        formData.aplicarDesde,
        formData.dataInicio,
        formData.diasSemana,
        formData.duracao,
        formData.horaInicio,
        formData.serviceType,
        isEditing,
        isModalOpen,
    ]);

    function updateFormField(key, value) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    function toggleWeekDay(dayKey) {
        setFormData((prev) => {
            const exists = prev.diasSemana.includes(dayKey);
            const diasSemana = exists
                ? prev.diasSemana.filter((item) => item !== dayKey)
                : [...prev.diasSemana, dayKey];

            return { ...prev, diasSemana };
        });
    }

    function toggleAluno(alunoId) {
        setFormData((prev) => {
            const exists = prev.alunosIds.includes(alunoId);
            const alunosIds = exists
                ? prev.alunosIds.filter((item) => item !== alunoId)
                : [...prev.alunosIds, alunoId];

            return { ...prev, alunosIds };
        });
    }

    function openModal() {
        setPreviewService(null);
        setFormError('');
        setEditingServiceId(null);
        setFormData(getInitialFormData());
        setIsModalOpen(true);
    }

    function openEditModal(row) {
        setPreviewService(null);
        setFormError('');
        setEditingServiceId(row.id);
        setFormData({
            serviceType:
                row.periodicidade === 'Periódico' ? 'periodico' : 'unico',
            tipoServico: row.tipoServico || '',
            modalidadeId: String(row.modalidadeId || ''),
            nivelEnsino: String(row.nivelEnsinoId || ''),
            disciplinaId: String(row.disciplinaId || ''),
            professorId: String(row.professorId || ''),
            salaId: String(row.salaId || ''),
            dataInicio: row.dataInicio || '',
            horaInicio: row.horaInicio || '',
            duracao: row.duracao || '60',
            diasSemana:
                Array.isArray(row.diasSemana) && row.diasSemana.length
                    ? row.diasSemana
                    : [getWeekDayKeyFromDate(row.dataInicio)],
            alunosIds: Array.isArray(row.alunosIds) ? row.alunosIds : [],
            aplicarDesde: getTomorrowDateKey(),
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingServiceId(null);
        setFormError('');
        setSalasDisponiveis([]);
        setSalasDisponiveisReady(false);
        setSalasError('');
    }

    function handleDeleteService(id) {
        setPendingDeleteServiceId(id);
    }

    function closeDeleteModal() {
        setPendingDeleteServiceId(null);
    }

    async function confirmDeleteService() {
        if (!pendingDeleteServiceId) {
            return;
        }

        setDeletingServiceId(pendingDeleteServiceId);
        setPageError('');

        try {
            const response = await apiDelete(
                `${API_URL}/api/gestor/servicos/curriculares/${pendingDeleteServiceId}`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Não foi possível eliminar o serviço.'
                );
            }

            setServices((prev) =>
                prev.filter((item) => item.id !== pendingDeleteServiceId)
            );
            setPreviewService((current) =>
                current?.id === pendingDeleteServiceId ? null : current
            );
            setPendingDeleteServiceId(null);
        } catch (deleteError) {
            setPageError(
                friendlyErrorMessage(deleteError, 'Erro ao eliminar serviço.')
            );
        } finally {
            setDeletingServiceId(null);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (
            !formData.tipoServico ||
            !formData.modalidadeId ||
            !formData.disciplinaId ||
            !formData.dataInicio ||
            !formData.horaInicio ||
            !formData.duracao ||
            (editingServiceId && !formData.aplicarDesde) ||
            (formData.serviceType === 'periodico' &&
                !formData.diasSemana.length)
        ) {
            setFormError(
                'Preencha todos os campos obrigatórios para criar o serviço.'
            );
            return;
        }

        if (selectedSalaIndisponivel) {
            setFormError(
                'Escolha uma sala livre para o horario selecionado antes de guardar.'
            );
            return;
        }

        setSubmitting(true);
        try {
            const diasParaEnviar =
                formData.serviceType === 'unico'
                    ? [getWeekDayKeyFromDate(formData.dataInicio)]
                    : formData.diasSemana;

            const endpoint = editingServiceId
                ? `${API_URL}/api/gestor/servicos/curriculares/${editingServiceId}`
                : `${API_URL}/api/gestor/servicos/curriculares`;

            const request = editingServiceId ? apiPatch : apiPost;
            const response = await request(endpoint, {
                serviceType: formData.serviceType,
                periodicidade: formData.serviceType,
                tipoServico: formData.tipoServico,
                modalidadeId: formData.modalidadeId,
                nivelEnsino: formData.nivelEnsino,
                disciplinaId: formData.disciplinaId,
                professorId: formData.professorId,
                salaId: formData.salaId,
                dataInicio: formData.dataInicio,
                horaInicio: formData.horaInicio,
                duracao: formData.duracao,
                diasSemana: diasParaEnviar,
                alunosIds: formData.alunosIds,
                aplicarDesde: editingServiceId
                    ? formData.aplicarDesde || getTomorrowDateKey()
                    : undefined,
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.message || 'Não foi possível guardar o serviço.'
                );
            }

            if (editingServiceId) {
                setServices((prev) =>
                    prev.map((item) =>
                        item.id === editingServiceId ? data.servico : item
                    )
                );
            } else {
                setServices((prev) => [data.servico, ...prev]);
            }
            closeModal();
        } catch (submitError) {
            setFormError(
                friendlyErrorMessage(submitError, 'Erro ao guardar serviço.')
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Serviços"
                title="Serviços Curriculares"
                subtitle="Gerir serviços curriculares"
                icon={BookOpenCheck}
                actions={
                    <button
                        type="button"
                        onClick={openModal}
                        className="inline-flex items-center gap-2 rounded-md bg-[#14ad81] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
                    >
                        <Plus size={14} />
                        Novo Serviço
                    </button>
                }
            />

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2 text-slate-700">
                    <Funnel size={15} className="text-slate-500" />
                    <h2 className="text-sm font-medium">Filtros</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <label className="md:col-span-2">
                        <span className="mb-1 block text-xs text-slate-500">
                            Pesquisar
                        </span>
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(event) =>
                                    updateFilter('search', event.target.value)
                                }
                                placeholder="Pesquisar em detalhes, utilizador..."
                                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-spindle"
                            />
                        </div>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Tipo Serviço
                        </span>
                        <select
                            value={filters.tipoServico}
                            onChange={(event) =>
                                updateFilter('tipoServico', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.tipoServico.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Modalidade
                        </span>
                        <select
                            value={filters.modalidade}
                            onChange={(event) =>
                                updateFilter('modalidade', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.modalidade.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Nível de Ensino
                        </span>
                        <select
                            value={filters.nivelEnsino}
                            onChange={(event) =>
                                updateFilter('nivelEnsino', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.nivelEnsino.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Área
                        </span>
                        <select
                            value={filters.area}
                            onChange={(event) =>
                                updateFilter('area', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.area.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {pageError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {pageError}
                </div>
            ) : null}

            {isModalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <button
                        type="button"
                        onClick={closeModal}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
                        aria-label="Fechar modal"
                    />

                    <form
                        onSubmit={handleSubmit}
                        className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                    >
                        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white sm:px-8">
                            <div className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
                            <div className="pointer-events-none absolute -left-10 -bottom-14 h-40 w-40 rounded-full bg-[#14ad81]/20 blur-2xl" />
                            <div className="relative flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="mt-1 text-2xl font-semibold">
                                        {editingServiceId
                                            ? 'Editar Serviço Curricular'
                                            : 'Novo Serviço Curricular'}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-200">
                                        {editingServiceId
                                            ? 'Atualize os campos do serviço selecionado'
                                            : 'Preencha os campos para criar um novo serviço'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg border border-white/20 bg-white/10 p-2 text-slate-100 hover:bg-white/20"
                                    aria-label="Fechar formulário"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[68vh] overflow-y-auto px-6 py-6 sm:px-8">
                            <div className="grid gap-6 md:grid-cols-2">
                                <label>
                                    <span className={fieldLabelClass}>
                                        Tipo de Serviço *
                                    </span>
                                    <select
                                        value={formData.tipoServico}
                                        disabled={isEditing}
                                        onChange={(event) =>
                                            updateFormField(
                                                'tipoServico',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">Selecione.</option>
                                        {opcoes.tiposServico.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.nome}
                                            >
                                                {option.nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Modalidade *
                                    </span>
                                    <select
                                        value={formData.modalidadeId}
                                        disabled={isEditing}
                                        onChange={(event) =>
                                            updateFormField(
                                                'modalidadeId',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">Selecione.</option>
                                        {opcoes.modalidades.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Nível Ensino *
                                    </span>
                                    <select
                                        value={formData.nivelEnsino}
                                        disabled={isEditing}
                                        onChange={(event) =>
                                            updateFormField(
                                                'nivelEnsino',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">Selecione.</option>
                                        {opcoes.niveisEnsino.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Disciplina *
                                    </span>
                                    <select
                                        value={formData.disciplinaId}
                                        disabled={isEditing}
                                        onChange={(event) =>
                                            updateFormField(
                                                'disciplinaId',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">Selecione.</option>
                                        {disciplinasFiltradas.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Professor
                                    </span>
                                    <select
                                        value={formData.professorId}
                                        disabled={isEditing}
                                        onChange={(event) =>
                                            updateFormField(
                                                'professorId',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">Selecione.</option>
                                        {opcoes.professores.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Sala
                                    </span>
                                    <select
                                        value={formData.salaId}
                                        onChange={(event) =>
                                            updateFormField(
                                                'salaId',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">
                                            {loadingSalas
                                                ? 'A verificar salas...'
                                                : salasDisponiveisReady
                                                  ? 'Selecione uma sala livre.'
                                                  : 'Selecione.'}
                                        </option>
                                        {salasParaSelecionar.map((option) => (
                                            <option
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.nome}
                                                {salasDisponiveisReady &&
                                                String(option.id) ===
                                                    String(formData.salaId) &&
                                                selectedSalaIndisponivel
                                                    ? ' (indisponivel)'
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {salasError ? (
                                        <span className="mt-1 block text-xs text-red-600">
                                            {salasError}
                                        </span>
                                    ) : null}
                                    {salasDisponiveisReady &&
                                    !loadingSalas &&
                                    !salasDisponiveis.length ? (
                                        <span className="mt-1 block text-xs text-red-600">
                                            Nao existem salas livres para este
                                            horario.
                                        </span>
                                    ) : null}
                                    {selectedSalaIndisponivel ? (
                                        <span className="mt-1 block text-xs text-amber-600">
                                            A sala selecionada nao esta livre
                                            neste horario.
                                        </span>
                                    ) : null}
                                </label>

                                <div>
                                    <span className={fieldLabelClass}>
                                        Periodicidade *
                                    </span>
                                    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="serviceType"
                                                value="unico"
                                                disabled={isEditing}
                                                checked={
                                                    formData.serviceType ===
                                                    'unico'
                                                }
                                                onChange={() =>
                                                    updateFormField(
                                                        'serviceType',
                                                        'unico'
                                                    )
                                                }
                                                className="h-4 w-4"
                                            />
                                            <span>Único</span>
                                        </label>
                                        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="serviceType"
                                                value="periodico"
                                                disabled={isEditing}
                                                checked={
                                                    formData.serviceType ===
                                                    'periodico'
                                                }
                                                onChange={() =>
                                                    updateFormField(
                                                        'serviceType',
                                                        'periodico'
                                                    )
                                                }
                                                className="h-4 w-4"
                                            />
                                            <span>Periódico</span>
                                        </label>
                                    </div>
                                </div>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Data de Início *
                                    </span>
                                    <input
                                        type="date"
                                        value={formData.dataInicio}
                                        disabled={isEditing}
                                        onChange={(event) =>
                                            updateFormField(
                                                'dataInicio',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    />
                                </label>

                                {isEditing ? (
                                    <label>
                                        <span className={fieldLabelClass}>
                                            Aplicar alterações a partir de *
                                        </span>
                                        <input
                                            type="date"
                                            min={getTomorrowDateKey()}
                                            value={formData.aplicarDesde}
                                            onChange={(event) =>
                                                updateFormField(
                                                    'aplicarDesde',
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                        />
                                        <span className="mt-1 block text-xs text-slate-500">
                                            O histórico anterior a esta data
                                            mantém a sala, hora e alunos atuais.
                                        </span>
                                    </label>
                                ) : null}

                                <label>
                                    <span className={fieldLabelClass}>
                                        Hora de Início *
                                    </span>
                                    <input
                                        type="time"
                                        value={formData.horaInicio}
                                        onChange={(event) =>
                                            updateFormField(
                                                'horaInicio',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    />
                                </label>

                                {formData.serviceType === 'periodico' ? (
                                    <>
                                        <div>
                                            <span className={fieldLabelClass}>
                                                Dias da Semana *
                                            </span>
                                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                {weekDayOptions.map((day) => (
                                                    <label
                                                        key={day.key}
                                                        className="flex items-center gap-2 rounded-lg border border-transparent bg-white px-2 py-1.5 text-sm text-slate-700 hover:border-slate-200"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.diasSemana.includes(
                                                                day.key
                                                            )}
                                                            onChange={() =>
                                                                toggleWeekDay(
                                                                    day.key
                                                                )
                                                            }
                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                                        />
                                                        <span>{day.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <label>
                                            <span className={fieldLabelClass}>
                                                Duração (minutos) *
                                            </span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.duracao}
                                                onChange={(event) =>
                                                    updateFormField(
                                                        'duracao',
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            />
                                        </label>
                                    </>
                                ) : (
                                    <label>
                                        <span className={fieldLabelClass}>
                                            Duração (minutos) *
                                        </span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.duracao}
                                            onChange={(event) =>
                                                updateFormField(
                                                    'duracao',
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                        />
                                    </label>
                                )}
                                <div className="md:col-span-2">
                                    <span className={fieldLabelClass}>
                                        Alunos a Associar
                                    </span>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        {!formData.nivelEnsino ? (
                                            <p className="text-sm text-slate-500">
                                                Selecione primeiro o nível de
                                                ensino para listar os alunos
                                                correspondentes.
                                            </p>
                                        ) : alunosFiltrados.length ? (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {alunosFiltrados.map(
                                                    (aluno) => (
                                                        <label
                                                            key={aluno.id}
                                                            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.alunosIds.includes(
                                                                    aluno.id
                                                                )}
                                                                onChange={() =>
                                                                    toggleAluno(
                                                                        aluno.id
                                                                    )
                                                                }
                                                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                                            />
                                                            <span>
                                                                {aluno.nome} -{' '}
                                                                {aluno.ano}
                                                            </span>
                                                        </label>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500">
                                                Não existem alunos para o nível
                                                de ensino selecionado.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {formError ? (
                                    <p className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {formError}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:px-8">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl bg-[#14ad81] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#14ad81]"
                            >
                                {submitting
                                    ? editingServiceId
                                        ? 'A guardar...'
                                        : 'A criar...'
                                    : editingServiceId
                                      ? 'Guardar Alterações'
                                      : 'Criar Serviço'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            {pendingDeleteServiceId ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <button
                        type="button"
                        onClick={closeDeleteModal}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
                        aria-label="Fechar confirmação"
                    />

                    <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-800">
                            Eliminar serviço curricular
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Esta ação vai remover o serviço da lista. Tens a
                            certeza que pretendes continuar?
                        </p>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteService}
                                disabled={
                                    deletingServiceId === pendingDeleteServiceId
                                }
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {deletingServiceId === pendingDeleteServiceId
                                    ? 'A eliminar...'
                                    : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {previewService ? (
                <ServicePreviewDrawer
                    service={previewService}
                    kind="curricular"
                    onClose={() => setPreviewService(null)}
                />
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <tr>
                            {[
                                { label: 'Periodicidade', field: 'periodicidade' },
                                { label: 'Tipo de Serviço', field: 'tipoServico' },
                                { label: 'Modalidade', field: 'modalidade' },
                                { label: 'Nível de Ensino', field: 'nivelEnsino' },
                                { label: 'Área', field: 'area' },
                                { label: 'Nº Alunos', field: 'nAlunos' },
                            ].map(({ label, field }) => (
                                <th
                                    key={label}
                                    className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
                                    onClick={() => handleSort(field)}
                                >
                                    <span className="flex items-center gap-1">
                                        {label}
                                        {sort.field === field ? (
                                            sort.dir === 'asc' ? <ChevronUp size={12} className="text-indigo-500 shrink-0" /> : <ChevronDown size={12} className="text-indigo-500 shrink-0" />
                                        ) : (
                                            <ChevronsUpDown size={12} className="opacity-30 shrink-0" />
                                        )}
                                    </span>
                                </th>
                            ))}
                            <th className="px-4 py-3 text-right font-medium">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-6 text-center text-sm text-slate-500"
                                >
                                    A carregar serviços...
                                </td>
                            </tr>
                        ) : rows.length ? (
                            rows.map((row) => {
                                const periodicidadeClass =
                                    row.periodicidade === 'Periódico'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-violet-100 text-violet-700';

                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => setPreviewService(row)}
                                        className={`cursor-pointer text-slate-700 transition-colors hover:bg-slate-50 ${
                                            previewService?.id === row.id
                                                ? 'bg-blue-50'
                                                : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${periodicidadeClass}`}
                                            >
                                                {row.periodicidade}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.tipoServico}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.modalidade}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.nivelEnsino}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.area}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                                                {row.nAlunos}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setPreviewService(row);
                                                    }}
                                                    className="text-slate-400 hover:text-blue-600"
                                                    aria-label="Ver detalhes do servico"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openEditModal(row);
                                                    }}
                                                    className="text-slate-400 hover:text-slate-600"
                                                    aria-label="Editar serviço"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteService(
                                                            row.id
                                                        );
                                                    }}
                                                    disabled={
                                                        deletingServiceId ===
                                                        row.id
                                                    }
                                                    className="text-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    aria-label="Eliminar serviço"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-6 text-center text-sm text-slate-500"
                                >
                                    Sem resultados para os filtros aplicados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
