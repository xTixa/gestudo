import { useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
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

//  função para obter os dados iniciais do formulário, garantindo que todos os campos estejam definidos com valores padrão, o que facilita a criação de um novo serviço ou a edição de um serviço existente sem erros de campos indefinidos
function getInitialFormData() {
    return {
        tipoServico: '',
        modalidadeId: '',
        nivelEnsino: '',
        areaId: '',
        professorId: '',
        salaId: '',
        dataInicio: '',
        horaInicio: '',
        duracao: '60',
        diasSemana: [],
        sessoes: [{ dia: 'segunda', horaInicio: '', duracao: '60' }],
        dataFim: '',
    };
}

// função para extrair os valores únicos de um array de objetos com base em uma chave específica, adicionando a opção "Todos" no início da lista para permitir a seleção de todos os valores em um filtro
function uniqueValues(rows, key) {
    return [
        'Todos',
        ...new Set(
            rows
                .map((row) => row[key])
                .filter((value) => String(value || '').trim() !== '')
        ),
    ];
}

export default function GestaoExtraPage() {
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [previewService, setPreviewService] = useState(null);
    const [deletingServiceId, setDeletingServiceId] = useState(null);
    const [pendingDeleteServiceId, setPendingDeleteServiceId] = useState(null);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState(getInitialFormData);
    const [opcoes, setOpcoes] = useState({
        tiposServico: [],
        modalidades: [],
        areas: [],
        niveisEnsino: [],
        professores: [],
        salas: [],
    });

    const [filters, setFilters] = useState({
        search: '',
        tipoServico: 'Todos',
        modalidade: 'Todos',
        nivelEnsino: 'Todos',
        area: 'Todos',
        professor: 'Todos',
    });
    const [sort, setSort] = useState({ field: null, dir: 'asc' });

    function handleSort(field) {
        setSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'asc' }
        );
    }

    useEffect(() => {
        let isMounted = true;

        async function loadRows() {
            setLoading(true);
            setError('');

            try {
                const [servicosResponse, opcoesResponse] = await Promise.all([
                    apiGet('/api/gestor/servicos/extra-curriculares'),
                    apiGet('/api/gestor/servicos/extra-curriculares/opcoes'),
                ]);
                const servicosData = await servicosResponse.json();
                const opcoesData = await opcoesResponse.json();

                if (!servicosResponse.ok) {
                    throw new Error(
                        servicosData.message || 'Erro ao carregar serviços.'
                    );
                }

                if (!opcoesResponse.ok) {
                    throw new Error(
                        opcoesData.message || 'Erro ao carregar opções.'
                    );
                }

                if (isMounted) {
                    setAllRows(
                        Array.isArray(servicosData.servicos)
                            ? servicosData.servicos
                            : []
                    );
                    setOpcoes({
                        tiposServico: Array.isArray(opcoesData?.tiposServico)
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
                            : [],
                        modalidades: Array.isArray(opcoesData?.modalidades)
                            ? opcoesData.modalidades
                            : [],
                        areas: Array.isArray(opcoesData?.areas)
                            ? opcoesData.areas
                            : Array.isArray(opcoesData?.disciplinas)
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
                    });
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError.message || 'Erro ao carregar serviços.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadRows();

        return () => {
            isMounted = false;
        };
    }, []);

    const filterOptions = useMemo(
        () => ({
            tipoServico: uniqueValues(allRows, 'tipoServico'),
            modalidade: uniqueValues(allRows, 'modalidade'),
            nivelEnsino: uniqueValues(allRows, 'nivelEnsino'),
            area: uniqueValues(allRows, 'area'),
            professor: uniqueValues(allRows, 'professor'),
        }),
        [allRows]
    );

    const rows = useMemo(() => {
        const term = filters.search.trim().toLowerCase();

        const filtered = allRows.filter((row) => {
            const matchesSearch =
                !term ||
                [
                    row.tipoServico,
                    row.modalidade,
                    row.professor,
                    row.nivelEnsino,
                    row.area,
                    row.periodicidade,
                ].some((value) =>
                    String(value || '')
                        .toLowerCase()
                        .includes(term)
                );

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
            const matchesProfessor =
                filters.professor === 'Todos' ||
                row.professor === filters.professor;

            return (
                matchesSearch &&
                matchesTipo &&
                matchesModalidade &&
                matchesNivel &&
                matchesArea &&
                matchesProfessor
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
            if (typeof av === 'string' && /^\d{4}-\d{2}-\d{2}/.test(av))
                return (new Date(av) - new Date(bv)) * mod;
            if (!isNaN(Number(av)) && !isNaN(Number(bv)))
                return (Number(av) - Number(bv)) * mod;
            return String(av).localeCompare(String(bv), 'pt') * mod;
        });
    }, [allRows, filters, sort]);

    function updateFilter(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
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
            tipoServico: row.tipoServico || '',
            modalidadeId: String(row.modalidadeId || ''),
            nivelEnsino: String(row.nivelEnsinoId || ''),
            areaId: String(row.areaId || row.area || row.disciplinaId || ''),
            professorId: String(row.professorId || ''),
            salaId: String(row.salaId || ''),
            dataInicio: row.dataInicio || '',
            horaInicio: row.horaInicio || '',
            duracao: row.duracao || '60',
            sessoes:
                Array.isArray(row.sessoes) && row.sessoes.length
                    ? row.sessoes
                    : [
                          {
                              dia:
                                  Array.isArray(row.diasSemana) &&
                                  row.diasSemana[0]
                                      ? row.diasSemana[0]
                                      : 'segunda',
                              horaInicio: row.horaInicio || '',
                              duracao: row.duracao || '60',
                          },
                      ],
            diasSemana:
                Array.isArray(row.diasSemana) && row.diasSemana.length
                    ? row.diasSemana
                    : ['segunda'],
            dataFim: row.dataFim || '',
        });
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingServiceId(null);
        setFormError('');
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
        setError('');

        try {
            const response = await apiDelete(
                `/api/gestor/servicos/extra-curriculares/${pendingDeleteServiceId}`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        'Não foi possível eliminar o serviço extra-curricular.'
                );
            }

            setAllRows((prev) =>
                prev.filter((item) => item.id !== pendingDeleteServiceId)
            );
            setPreviewService((current) =>
                current?.id === pendingDeleteServiceId ? null : current
            );
            setPendingDeleteServiceId(null);
        } catch (deleteError) {
            setError(
                deleteError.message ||
                    'Erro ao eliminar serviço extra-curricular.'
            );
        } finally {
            setDeletingServiceId(null);
        }
    }

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

    function updateSessao(index, key, value) {
        setFormData((prev) => ({
            ...prev,
            sessoes: prev.sessoes.map((sessao, sessaoIndex) =>
                sessaoIndex === index ? { ...sessao, [key]: value } : sessao
            ),
        }));
    }

    function addSessao() {
        setFormData((prev) => ({
            ...prev,
            sessoes: [
                ...prev.sessoes,
                { dia: 'segunda', horaInicio: '', duracao: '60' },
            ],
        }));
    }

    function removeSessao(index) {
        setFormData((prev) => ({
            ...prev,
            sessoes:
                prev.sessoes.length > 1
                    ? prev.sessoes.filter(
                          (_, sessaoIndex) => sessaoIndex !== index
                      )
                    : prev.sessoes,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (
            !formData.tipoServico ||
            !formData.modalidadeId ||
            !formData.areaId ||
            !formData.professorId ||
            !formData.salaId ||
            !formData.dataInicio ||
            !formData.sessoes.length ||
            !formData.sessoes.every(
                (sessao) => sessao.dia && sessao.horaInicio && sessao.duracao
            )
        ) {
            setFormError(
                'Preencha todos os campos obrigatórios para criar o serviço extra-curricular.'
            );
            return;
        }

        setSubmitting(true);
        try {
            const endpoint = editingServiceId
                ? `/api/gestor/servicos/extra-curriculares/${editingServiceId}`
                : '/api/gestor/servicos/extra-curriculares';
            const request = editingServiceId ? apiPatch : apiPost;

            const requestData = {
                tipoServico: formData.tipoServico,
                modalidadeId: formData.modalidadeId,
                nivelEnsino: formData.nivelEnsino,
                areaId: formData.areaId,
                professorId: formData.professorId,
                salaId: formData.salaId,
                dataInicio: formData.dataInicio,
                horaInicio: formData.sessoes[0]?.horaInicio,
                duracao: formData.sessoes[0]?.duracao,
                diasSemana: formData.sessoes.map((sessao) => sessao.dia),
                sessoes: formData.sessoes,
            };
            if (formData.dataFim) {
                requestData.dataFim = formData.dataFim;
            }
            const response = await request(endpoint, requestData);

            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.message ||
                        'Não foi possível guardar o serviço extra-curricular.'
                );
            }

            if (editingServiceId) {
                setAllRows((prev) =>
                    prev.map((item) =>
                        item.id === editingServiceId ? data.servico : item
                    )
                );
            } else {
                setAllRows((prev) => [data.servico, ...prev]);
            }
            closeModal();
        } catch (submitError) {
            setFormError(
                submitError.message ||
                    'Erro ao guardar serviço extra-curricular.'
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Serviços"
                title="Serviços Extra-Curriculares"
                subtitle="Gerir serviços extra-curriculares"
                icon={BookOpen}
                actions={
                    <button
                        type="button"
                        onClick={openModal}
                        className="inline-flex items-center gap-2 rounded-md bg-[#14ad81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f8d69]"
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
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

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Professor
                        </span>
                        <select
                            value={filters.professor}
                            onChange={(event) =>
                                updateFilter('professor', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.professor.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

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
                        className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                    >
                        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white sm:px-8">
                            <div className="relative flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                                        Dados Serviço Extra
                                    </p>
                                    <h3 className="mt-1 text-2xl font-semibold">
                                        {editingServiceId
                                            ? 'Editar Serviço Extra-Curricular'
                                            : 'Novo Serviço Extra-Curricular'}
                                    </h3>
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
                                        Nível de Proficiência *
                                    </span>
                                    <select
                                        value={formData.nivelEnsino}
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
                                        Área *
                                    </span>
                                    <select
                                        value={formData.areaId}
                                        onChange={(event) =>
                                            updateFormField(
                                                'areaId',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">Selecione.</option>
                                        {opcoes.areas.map((option) => (
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
                                        Professor *
                                    </span>
                                    <select
                                        value={formData.professorId}
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
                                        Sala *
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
                                        <option value="">Selecione.</option>
                                        {opcoes.salas.map((option) => (
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
                                        Data de Início *
                                    </span>
                                    <input
                                        type="date"
                                        value={formData.dataInicio}
                                        onChange={(event) =>
                                            updateFormField(
                                                'dataInicio',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    />
                                </label>

                                <div className="md:col-span-2">
                                    <span className={fieldLabelClass}>
                                        Sessões *
                                    </span>
                                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        {formData.sessoes.map((sessao, index) => (
                                            <div
                                                key={index}
                                                className="grid gap-2 rounded-lg bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                                            >
                                                <select
                                                    value={sessao.dia}
                                                    onChange={(event) =>
                                                        updateSessao(index, 'dia', event.target.value)
                                                    }
                                                    className={inputClass}
                                                >
                                                    {weekDayOptions.map((day) => (
                                                        <option key={day.key} value={day.key}>
                                                            {day.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="time"
                                                    value={sessao.horaInicio}
                                                    onChange={(event) =>
                                                        updateSessao(index, 'horaInicio', event.target.value)
                                                    }
                                                    className={inputClass}
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={sessao.duracao}
                                                    onChange={(event) =>
                                                        updateSessao(index, 'duracao', event.target.value)
                                                    }
                                                    className={inputClass}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeSessao(index)}
                                                    disabled={formData.sessoes.length === 1}
                                                    className="rounded-xl border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={addSessao}
                                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                                        >
                                            Adicionar sessão
                                        </button>
                                    </div>
                                </div>

                                <label>
                                    <span className={fieldLabelClass}>
                                        Data de Fim (opcional - padrão: 31
                                        Agosto)
                                    </span>
                                    <input
                                        type="date"
                                        value={formData.dataFim}
                                        onChange={(event) =>
                                            updateFormField(
                                                'dataFim',
                                                event.target.value
                                            )
                                        }
                                        className={inputClass}
                                    />
                                </label>

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
                                className="rounded-xl bg-[#14ad81] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0f8d69]"
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
                            Eliminar serviço extra-curricular
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
                    kind="extra"
                    onClose={() => setPreviewService(null)}
                />
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <tr>
                            {[
                                { label: 'Professor', field: 'professor' },
                                { label: 'Disciplina', field: 'area' },
                                { label: 'Tipo Serviço', field: 'tipoServico' },
                                { label: 'Modalidade', field: 'modalidade' },
                                { label: 'Nº de alunos', field: 'nAlunos' },
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
                                    colSpan={6}
                                    className="px-4 py-6 text-center text-sm text-slate-500"
                                >
                                    A carregar serviços da base de dados...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-6 text-center text-sm text-red-600"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : rows.length ? (
                            rows.map((row) => {
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
                                            {row.professor || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.area}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.tipoServico}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.modalidade}
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
                                    colSpan={6}
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
