import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    Download,
    FileSearch,
    Upload,
    Plus,
    MoreVertical,
    GraduationCap,
    Funnel,
} from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import SortableTableHead from '../../../components/people/SortableTableHead';
import RowActionsMenu from '../../../components/people/RowActionsMenu';
import ConfirmRowActionModal from '../../../components/people/ConfirmRowActionModal';
import { useRowActionsMenu } from '../../../components/people/useRowActionsMenu';
import { apiGet, apiPatch, apiDelete } from '../../../utils/api';
import ExportModal from '../../../components/people/ExportModal';
import ProfessorPreviewModal from './ProfessorPreviewModal';
import ImportModal from '../../../components/people/ImportModal';
import {
    descarregarModeloProfessores,
    downloadProfFichaPdf,
    exportarProfessores,
    FORMAT_OPTIONS,
    IMPORT_FORMAT_OPTIONS,
    importarProfessores,
    juntarProfessoresImportados,
    lerProfessoresParaImportar,
    preverImportacaoProfessores,
} from './professoresImportExport';
import { usePlan } from '../../../utils/plan';

// função para extrair valores únicos de um campo de um array de objetos, retornando um array ordenado com o valor 'Todos' no início
function uniqueValues(array, field) {
    const values = Array.from(
        new Set(
            array
                .map((item) => item[field])
                .filter((value) => value != null && String(value).trim() !== '')
        )
    ).sort((a, b) => String(a).localeCompare(String(b), 'pt-PT'));
    return ['Todos', ...values];
}

const COLUNAS = [
    { label: 'Nome Completo', field: 'nome' },
    { label: 'NIF', field: 'nif' },
    { label: 'Área Ensino', field: 'area_ensino' },
    { label: 'Contacto', field: null },
    { label: 'Email', field: 'email' },
    { label: 'Nível', field: 'nivel' },
    { label: 'Data Entrada', field: 'data_entrada' },
];

export default function GestaoProfessores() {
    const canExport = usePlan().hasModule('exportacoes');
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [professorSelecionado, setProfessorSelecionado] = useState(null);
    const [professores, setProfessores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [actionError, setActionError] = useState('');
    const [rowConfirmModal, setRowConfirmModal] = useState({
        open: false,
        mode: null,
        prof: null,
        keyword: '',
    });
    const [rowActionLoading, setRowActionLoading] = useState(false);
    const linhaMenu = useRowActionsMenu();
    const [filters, setFilters] = useState(() => ({
        search: searchParams.get('q') || '',
        area_ensino: 'Todos',
        nivel: 'Todos',
    }));
    const [sort, setSort] = useState({ field: null, dir: 'asc' });

    function handleSort(field) {
        setSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'asc' }
        );
    }

    const filterOptions = useMemo(
        () => ({
            area_ensino: uniqueValues(professores, 'area_ensino'),
            nivel: uniqueValues(professores, 'nivel'),
        }),
        [professores]
    );

    function updateFilter(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }

    // A pesquisa global abre esta página com ?q=; o filtro acompanha o URL
    // (ajuste durante o render em vez de num efeito).
    const pesquisaUrl = searchParams.get('q') || '';
    const [pesquisaUrlAnterior, setPesquisaUrlAnterior] = useState(pesquisaUrl);
    if (pesquisaUrl !== pesquisaUrlAnterior) {
        setPesquisaUrlAnterior(pesquisaUrl);
        setFilters((prev) => ({ ...prev, search: pesquisaUrl }));
    }

    useEffect(() => {
        let isMounted = true;

        function carregarProfessores() {
            apiGet('/api/gestor/professores')
                .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.message || 'Não foi possível obter professores.');
                    }
                    if (!isMounted) return;
                    setProfessores(Array.isArray(data.professores) ? data.professores : []);
                })
                .catch((fetchError) => {
                    if (isMounted) {
                        setError(fetchError.message || 'Erro ao carregar professores.');
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        }

        carregarProfessores();

        return () => {
            isMounted = false;
        };
    }, []);

    const professoresFiltrados = useMemo(() => {
        const term = filters.search.trim().toLowerCase();

        const filtered = professores.filter((prof) => {
            const matchesSearch =
                !term ||
                [prof.nome, prof.nif, prof.area_ensino, prof.nivel].some(
                    (value) => String(value).toLowerCase().includes(term)
                );

            const matchesArea =
                filters.area_ensino === 'Todos' ||
                prof.area_ensino === filters.area_ensino;
            const matchesNivel =
                filters.nivel === 'Todos' || prof.nivel === filters.nivel;

            return matchesSearch && matchesArea && matchesNivel;
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
    }, [professores, filters, sort]);


    function abrirConfirmacaoLinha(mode, prof) {
        setRowConfirmModal({ open: true, mode, prof, keyword: '' });
    }

    function fecharConfirmacaoLinha() {
        if (rowActionLoading) return;
        setRowConfirmModal({ open: false, mode: null, prof: null, keyword: '' });
    }

    async function confirmarAcaoLinha() {
        const { mode, prof } = rowConfirmModal;
        if (!prof) return;

        if (mode === 'delete' && rowConfirmModal.keyword !== 'ELIMINAR') {
            setActionError('Confirmação inválida. Escreve ELIMINAR para continuar.');
            return;
        }

        setRowActionLoading(true);
        setActionError('');
        setActionMessage('');

        try {
            if (mode === 'delete') {
                const response = await apiDelete(
                    `/api/gestor/professores/${prof.id_professor}`
                );
                const data = await response.json();

                if (response.ok && data.deleted === true) {
                    setProfessores((prev) =>
                        prev.filter((p) => p.id_professor !== prof.id_professor)
                    );
                    setActionMessage(
                        data?.message || 'Professor eliminado definitivamente.'
                    );
                } else if (response.status === 409) {
                    setProfessores((prev) =>
                        prev.map((p) =>
                            p.id_professor === prof.id_professor
                                ? { ...p, status: false }
                                : p
                        )
                    );
                    setActionMessage(
                        data?.message ||
                            'Professor inativado e serviços suspensos. Eliminação definitiva bloqueada.'
                    );
                } else {
                    throw new Error(
                        data?.message || 'Não foi possível eliminar o professor.'
                    );
                }
            } else {
                const novoStatus = !prof.status;
                const response = await apiPatch(
                    `/api/gestor/professores/${prof.id_professor}/status`,
                    { status: novoStatus }
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message ||
                            'Não foi possível alterar o estado do professor.'
                    );
                }

                setProfessores((prev) =>
                    prev.map((p) =>
                        p.id_professor === prof.id_professor
                            ? { ...p, status: novoStatus }
                            : p
                    )
                );
                setActionMessage(
                    data?.message ||
                        (novoStatus
                            ? 'Professor reativado com sucesso.'
                            : 'Professor colocado em stand by com sucesso.')
                );
            }

            setRowConfirmModal({ open: false, mode: null, prof: null, keyword: '' });
        } catch (err) {
            setActionError(err?.message || 'Não foi possível concluir a ação.');
        } finally {
            setRowActionLoading(false);
        }
    }


    async function handleExport(opcoes) {
        setActionMessage('');
        setActionError('');
        const resultado = await exportarProfessores(professoresFiltrados, opcoes);
        if (resultado.erro) {
            setActionError(resultado.erro);
            return;
        }
        setActionMessage(resultado.mensagem);
        setShowExportModal(false);
    }

    // Devolve { preview } para o modal mostrar a pré-validação quando falha.
    async function handleImport(ficheiro, formato) {
        setActionMessage('');
        setActionError('');
        try {
            const lidos = await lerProfessoresParaImportar(ficheiro, formato);
            if (lidos.erro) {
                setActionError(lidos.erro);
                return { preview: lidos.preview };
            }

            const resultado = await importarProfessores(
                lidos.validRows,
                lidos.invalidCount
            );
            setProfessores((atuais) =>
                juntarProfessoresImportados(atuais, resultado.insertedRows)
            );

            if (resultado.erro) {
                setActionError(resultado.erro);
                return { preview: lidos.preview };
            }

            setActionMessage(resultado.mensagem);
            setShowImportModal(false);
        } catch (error) {
            setActionError(
                error?.message ||
                    'Falha inesperada na importação. Verifique o ficheiro e tente novamente.'
            );
        }
        return null;
    }


    async function handleDownloadImportTemplate(formato) {
        setActionMessage('');
        setActionError('');
        const resultado = await descarregarModeloProfessores(formato);
        if (resultado.erro) setActionError(resultado.erro);
        else setActionMessage(resultado.mensagem);
    }

    return (
        <div className="space-y-5">
            <AdminPageHeader
                eyebrow="Professores"
                title="Gestão de Professores"
                subtitle="Gerir informações e especialidades dos professores"
                icon={GraduationCap}
                actions={
                    <div className="flex flex-wrap gap-3">
                        {canExport && (
                            <button
                                type="button"
                                onClick={() => setShowExportModal(true)}
                                className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                            >
                                <Download size={16} />
                                Exportar
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                        >
                            <Upload size={16} />
                            Importar
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                navigate('/gestor/professores/addProf')
                            }
                            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm text-white hover:bg-emerald-600"
                        >
                            <Plus size={16} />
                            Novo Professor
                        </button>
                    </div>
                }
            />

            {actionMessage ? (
                <p className="mb-4 text-sm text-emerald-700">{actionMessage}</p>
            ) : null}
            {actionError ? (
                <p className="mb-4 text-sm text-red-600">{actionError}</p>
            ) : null}

            {/* Card */}
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
                                onChange={(event) => {
                                    const value = event.target.value;
                                    updateFilter('search', value);

                                    const nextParams = new URLSearchParams(
                                        searchParams
                                    );

                                    if (value.trim()) {
                                        nextParams.set('q', value);
                                    } else {
                                        nextParams.delete('q');
                                    }

                                    setSearchParams(nextParams, {
                                        replace: true,
                                    });
                                }}
                                placeholder="Pesquisar em nome, NIF, área..."
                                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-spindle"
                            />
                        </div>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Área Ensino
                        </span>
                        <select
                            value={filters.area_ensino}
                            onChange={(event) =>
                                updateFilter('area_ensino', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.area_ensino.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Nível
                        </span>
                        <select
                            value={filters.nivel}
                            onChange={(event) =>
                                updateFilter('nivel', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.nivel.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {/* Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                {/* Search */}
                {error ? (
                    <p className="mb-4 text-sm text-red-600">{error}</p>
                ) : null}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <SortableTableHead
                            colunas={COLUNAS}
                            sort={sort}
                            onSort={handleSort}
                        />

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        A carregar professores...
                                    </td>
                                </tr>
                            ) : null}

                            {professoresFiltrados.map((prof) => (
                                <tr
                                    key={prof.id_professor}
                                    className={`border-b transition ${
                                        prof.status === false
                                            ? 'bg-slate-100 text-slate-500 shadow-inner opacity-75 hover:bg-slate-100'
                                            : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <td
                                        className={`py-3 font-medium ${
                                            prof.status === false
                                                ? 'text-slate-500'
                                                : 'text-gray-800'
                                        }`}
                                    >
                                        {prof.nome}
                                    </td>
                                    <td>{prof.nif}</td>
                                    <td>{prof.area_ensino}</td>
                                    <td>{prof.contacto}</td>
                                    <td>{prof.email}</td>
                                    <td>{prof.nivel}</td>
                                    <td>
                                        {new Date(
                                            prof.data_entrada
                                        ).toLocaleDateString('pt-PT')}
                                    </td>
                                    <td className="flex justify-center gap-3 py-3">
                                        <button
                                            className="text-gray-500 hover:text-sky-600"
                                            title="Ver ficha do professor"
                                            onClick={() =>
                                                setProfessorSelecionado(prof)
                                            }
                                        >
                                            <FileSearch size={16} />
                                        </button>
                                        <button
                                            className="text-gray-500 hover:text-indigo-600"
                                            title="Ações"
                                            onClick={(e) =>
                                                linhaMenu.abrir(e, prof.id_professor, prof)
                                            }
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {!loading && professoresFiltrados.length === 0 && (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        Nenhum professor encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {professorSelecionado ? (
                <ProfessorPreviewModal
                    professor={professorSelecionado}
                    onFechar={() => setProfessorSelecionado(null)}
                />
            ) : null}

            {showExportModal ? (
                <ExportModal
                    entidade="professores"
                    formatos={FORMAT_OPTIONS}
                    onExportar={handleExport}
                    onFechar={() => setShowExportModal(false)}
                />
            ) : null}

            {showImportModal ? (
                <ImportModal
                    entidade="professores"
                    formatos={IMPORT_FORMAT_OPTIONS}
                    onImportar={handleImport}
                    preverImportacao={preverImportacaoProfessores}
                    onDescarregarModelo={handleDownloadImportTemplate}
                    onFechar={() => setShowImportModal(false)}
                />
            ) : null}

            <RowActionsMenu
                menu={linhaMenu.menu}
                pos={linhaMenu.pos}
                menuRef={linhaMenu.menuRef}
                onFechar={linhaMenu.fechar}
                onVerFicha={(prof) =>
                    navigate(`/gestor/professores/ficha/${prof.id_professor}`)
                }
                onEditar={(prof) =>
                    navigate(`/gestor/professores/update/${prof.id_professor}`)
                }
                onDownload={(prof) => downloadProfFichaPdf(prof)}
                onAlterarEstado={(prof) => abrirConfirmacaoLinha('status', prof)}
                onEliminar={(prof) => abrirConfirmacaoLinha('delete', prof)}
            />

            {rowConfirmModal.open ? (
                <ConfirmRowActionModal
                    modo={rowConfirmModal.mode}
                    ativo={rowConfirmModal.prof?.status}
                    entidade="professor"
                    keyword={rowConfirmModal.keyword}
                    onKeywordChange={(keyword) =>
                        setRowConfirmModal((prev) => ({ ...prev, keyword }))
                    }
                    onCancelar={fecharConfirmacaoLinha}
                    onConfirmar={confirmarAcaoLinha}
                    aProcessar={rowActionLoading}
                />
            ) : null}
        </div>
    );
}
