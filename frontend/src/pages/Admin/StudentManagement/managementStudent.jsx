import { useEffect, useMemo, useState } from 'react';
import {
    Search,
    Download,
    FileSearch,
    Upload,
    Plus,
    MoreVertical,
    Users,
    Funnel,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiGet, apiPatch, apiDelete } from '../../../utils/api';
import ExportModal from '../../../components/people/ExportModal';
import ImportModal from '../../../components/people/ImportModal';
import AlunoPreviewModal from './AlunoPreviewModal';
import { getEncarregadoLabel } from './alunosFormat';
import {
    descarregarModeloAlunos,
    downloadAlunoFichaPdf,
    EXPORT_FORMAT_OPTIONS,
    EXPORTABLE_FIELDS,
    exportarAlunos,
    IMPORT_FORMAT_OPTIONS,
    importarAlunos,
    lerAlunosParaImportar,
} from './alunosImportExport';
import SortableTableHead from '../../../components/people/SortableTableHead';
import RowActionsMenu from '../../../components/people/RowActionsMenu';
import ConfirmRowActionModal from '../../../components/people/ConfirmRowActionModal';
import { useRowActionsMenu } from '../../../components/people/useRowActionsMenu';
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

// Siglas conhecidas de escolas -> nome completo, para agrupar variações que
// os encarregados escrevem de formas diferentes no formulário público de
// inscrição (ex: "ESAM", "Esam", "Alves Martins", "Secundária Alves Martins").
const ESCOLA_SIGLAS = {
    esam: 'Escola Secundária Alves Martins',
    esem: 'Escola Secundária Emídio Navarro',
};

// Normaliza o nome de uma escola para uma chave de agrupamento: remove
// acentos, pontuação e palavras genéricas ("escola", "secundária", "eb",
// "básica"), para que grafias diferentes do mesmo estabelecimento colidam
// na mesma chave (ex: "ESAM", "Alves Martins" e "Secundária Alves Martins"
// resolvem todas para "alves martins").
function removeAcentos(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function normalizeEscolaKey(value) {
    const semAcentos = removeAcentos(value).trim().toLowerCase();

    const sigla = ESCOLA_SIGLAS[semAcentos.replace(/[^a-z0-9]/g, '')];
    const base = sigla ? removeAcentos(sigla).toLowerCase() : semAcentos;

    return base
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(escola|secundaria|basica|eb|e\.?b\.?|de|do|da|dos|das)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Agrupa os nomes de escola (tal como escritos pelos encarregados) por
// chave normalizada e escolhe, para cada grupo, a grafia mais frequente
// (e mais longa como desempate) como rótulo a apresentar no filtro.
function uniqueEscolas(array) {
    const grupos = new Map();

    array.forEach((item) => {
        const original = String(item?.escola || '').trim();
        if (!original) return;

        const key = normalizeEscolaKey(original);
        if (!key) return;

        if (!grupos.has(key)) {
            grupos.set(key, new Map());
        }
        const contagens = grupos.get(key);
        contagens.set(original, (contagens.get(original) || 0) + 1);
    });

    const labels = Array.from(grupos.entries()).map(([key, contagens]) => {
        const [label] = Array.from(contagens.entries()).sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return b[0].length - a[0].length;
        })[0];
        return { key, label };
    });

    labels.sort((a, b) => a.label.localeCompare(b.label, 'pt-PT'));

    return ['Todos', ...labels];
}

const COLUNAS = [
    { label: 'Nome Completo', field: 'nome' },
    { label: 'NIF', field: 'nif' },
    { label: 'Ano Escolar', field: 'ano' },
    { label: 'Escola', field: 'escola' },
    { label: 'Encarregado Educação', field: null },
    { label: 'Contacto', field: null },
    { label: 'Data Início', field: 'data_inicio' },
];

export default function GestaoAlunos() {
    const canExport = usePlan().hasModule('exportacoes');
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [alunoSelecionado, setAlunoSelecionado] = useState(null);
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [actionError, setActionError] = useState('');
    const [rowConfirmModal, setRowConfirmModal] = useState({
        open: false,
        mode: null,
        aluno: null,
        keyword: '',
    });
    const [rowActionLoading, setRowActionLoading] = useState(false);
    const linhaMenu = useRowActionsMenu();
    const [filters, setFilters] = useState(() => ({
        search: searchParams.get('q') || '',
        ano: 'Todos',
        escola: 'Todos',
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
            ano: uniqueValues(alunos, 'ano'),
            escola: uniqueEscolas(alunos),
        }),
        [alunos]
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

        apiGet('/api/gestor/alunos')
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Não foi possível obter alunos.');
                }
                if (isMounted) setAlunos(data.alunos || []);
            })
            .catch((fetchError) => {
                if (isMounted) setError(fetchError.message || 'Erro ao carregar alunos.');
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const alunosFiltrados = useMemo(() => {
        const term = filters.search.trim().toLowerCase();

        const filtered = alunos.filter((aluno) => {
            const matchesSearch =
                !term ||
                [aluno.nome, aluno.nif, aluno.ano, aluno.escola].some((value) =>
                    String(value).toLowerCase().includes(term)
                );

            const matchesAno =
                filters.ano === 'Todos' ||
                String(aluno.ano) === String(filters.ano);
            const matchesEscola =
                filters.escola === 'Todos' ||
                normalizeEscolaKey(aluno.escola) === filters.escola;

            return matchesSearch && matchesAno && matchesEscola;
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
    }, [alunos, filters, sort]);

    async function handleExport(opcoes) {
        setActionMessage('');
        setActionError('');
        const resultado = await exportarAlunos(alunosFiltrados, opcoes);
        if (resultado.erro) {
            setActionError(resultado.erro);
            return;
        }
        setActionMessage(resultado.mensagem);
        setShowExportModal(false);
    }

    async function refreshAlunos() {
        const response = await apiGet('/api/gestor/alunos');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Erro ao atualizar lista de alunos.'
            );
        }

        setAlunos(data.alunos || []);
    }

    function abrirConfirmacaoLinha(mode, aluno) {
        setRowConfirmModal({ open: true, mode, aluno, keyword: '' });
    }

    function fecharConfirmacaoLinha() {
        if (rowActionLoading) return;
        setRowConfirmModal({ open: false, mode: null, aluno: null, keyword: '' });
    }

    async function confirmarAcaoLinha() {
        const { mode, aluno } = rowConfirmModal;
        if (!aluno) return;

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
                    `/api/gestor/alunos/${aluno.id_aluno}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Não foi possível eliminar o aluno.'
                    );
                }

                setActionMessage(
                    data?.message || 'Aluno eliminado definitivamente.'
                );
            } else {
                const novoStatus = !aluno.status;
                const response = await apiPatch(
                    `/api/gestor/alunos/${aluno.id_aluno}/status`,
                    { status: novoStatus }
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Não foi possível alterar o estado do aluno.'
                    );
                }

                setActionMessage(
                    data?.message ||
                        (novoStatus
                            ? 'Aluno reativado com sucesso.'
                            : 'Aluno colocado em stand by com sucesso.')
                );
            }

            await refreshAlunos();
            setRowConfirmModal({ open: false, mode: null, aluno: null, keyword: '' });
        } catch (err) {
            setActionError(err?.message || 'Não foi possível concluir a ação.');
        } finally {
            setRowActionLoading(false);
        }
    }

    async function handleDownloadImportTemplate(formato) {
        setActionMessage('');
        setActionError('');
        const resultado = await descarregarModeloAlunos(formato);
        if (resultado.erro) setActionError(resultado.erro);
        else setActionMessage(resultado.mensagem);
    }

    async function handleImport(ficheiro, formato) {
        setActionMessage('');
        setActionError('');

        const lidos = await lerAlunosParaImportar(ficheiro, formato);
        if (lidos.erro) {
            setActionError(lidos.erro);
            return;
        }

        try {
            const { successCount, failed } = await importarAlunos(lidos.payloads);
            await refreshAlunos();

            if (failed.length) {
                const firstErrors = failed
                    .slice(0, 3)
                    .map((item) => `linha ${item.linha}: ${item.erro}`)
                    .join(' | ');

                setActionError(
                    `${failed.length} registo(s) falharam (${firstErrors}).`
                );
            }

            setActionMessage(
                `${successCount} aluno(s) importado(s) com sucesso.`
            );
            setShowImportModal(false);
        } catch (importError) {
            setActionError(importError.message || 'Erro ao importar alunos.');
        }
    }

    return (
        <div className="space-y-5">
            <AdminPageHeader
                eyebrow="Alunos"
                title="Gestão de Alunos"
                subtitle="Gerir informações dos alunos e encarregados de educação"
                icon={Users}
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
                            onClick={() => navigate('/gestor/alunos/addAluno')}
                            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm text-white hover:bg-emerald-600"
                        >
                            <Plus size={16} />
                            Novo Aluno
                        </button>
                    </div>
                }
            />

            {actionMessage ? (
                <p className="mt-4 text-sm text-emerald-700">{actionMessage}</p>
            ) : null}
            {actionError ? (
                <p className="mt-4 text-sm text-red-600">{actionError}</p>
            ) : null}

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
                                placeholder="Pesquisar em nome, NIF, ano..."
                                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-spindle"
                            />
                        </div>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Ano Escolar
                        </span>
                        <select
                            value={filters.ano}
                            onChange={(event) =>
                                updateFilter('ano', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.ano.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Escola
                        </span>
                        <select
                            value={filters.escola}
                            onChange={(event) =>
                                updateFilter('escola', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.escola.map((option) =>
                                option === 'Todos' ? (
                                    <option key="Todos" value="Todos">
                                        Todos
                                    </option>
                                ) : (
                                    <option key={option.key} value={option.key}>
                                        {option.label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                {error ? (
                    <p className="mb-4 text-sm text-red-600">{error}</p>
                ) : null}

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
                                        A carregar alunos...
                                    </td>
                                </tr>
                            ) : null}

                            {!loading
                                ? alunosFiltrados.map((aluno) => (
                                      <tr
                                          key={aluno.id_aluno}
                                          className={`border-b transition ${
                                              aluno.status === false
                                                  ? 'bg-slate-100 text-slate-500 shadow-inner opacity-75 hover:bg-slate-100'
                                                  : 'hover:bg-gray-50'
                                          }`}
                                      >
                                          <td
                                              className={`py-3 font-medium ${
                                                  aluno.status === false
                                                      ? 'text-slate-500'
                                                      : 'text-gray-800'
                                              }`}
                                          >
                                              {aluno.nome}
                                          </td>
                                          <td>{aluno.nif}</td>
                                          <td>{aluno.ano}º</td>
                                          <td>{aluno.escola}</td>
                                          <td>
                                              {getEncarregadoLabel(
                                                  aluno.encarregado
                                              )}
                                          </td>
                                          <td>{aluno.contacto}</td>
                                          <td>
                                              {new Date(
                                                  aluno.data_inicio
                                              ).toLocaleDateString('pt-PT')}
                                          </td>
                                          <td className="flex justify-center gap-3 py-3">
                                              <button
                                                  className="text-gray-500 hover:text-sky-600"
                                                  title="Preview aluno"
                                                  onClick={() =>
                                                      setAlunoSelecionado(aluno)
                                                  }
                                              >
                                                  <FileSearch size={16} />
                                              </button>
                                              <button
                                                  className="text-gray-500 hover:text-indigo-600"
                                                  title="Ações"
                                                  onClick={(e) =>
                                                      linhaMenu.abrir(e, aluno.id_aluno, aluno)
                                                  }
                                              >
                                                  <MoreVertical size={16} />
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                                : null}

                            {!loading && alunosFiltrados.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        Nenhum aluno encontrado.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>

            {alunoSelecionado ? (
                <AlunoPreviewModal
                    key={alunoSelecionado.id_aluno}
                    aluno={alunoSelecionado}
                    onFechar={() => setAlunoSelecionado(null)}
                />
            ) : null}

            {showExportModal ? (
                <ExportModal
                    entidade="alunos"
                    formatos={EXPORT_FORMAT_OPTIONS}
                    campos={EXPORTABLE_FIELDS}
                    onExportar={handleExport}
                    onFechar={() => setShowExportModal(false)}
                />
            ) : null}

            {showImportModal ? (
                <ImportModal
                    entidade="alunos"
                    formatos={IMPORT_FORMAT_OPTIONS}
                    onImportar={handleImport}
                    onDescarregarModelo={handleDownloadImportTemplate}
                    onFechar={() => setShowImportModal(false)}
                />
            ) : null}

            <RowActionsMenu
                menu={linhaMenu.menu}
                pos={linhaMenu.pos}
                menuRef={linhaMenu.menuRef}
                onFechar={linhaMenu.fechar}
                onVerFicha={(aluno) =>
                    navigate(`/gestor/alunos/ficha/${aluno.id_aluno}`)
                }
                onEditar={(aluno) =>
                    navigate(`/gestor/alunos/update/${aluno.id_aluno}`)
                }
                onDownload={async (aluno) => {
                    try {
                        await downloadAlunoFichaPdf(aluno);
                    } catch (err) {
                        setActionError(
                            err?.message ||
                                'Não foi possível gerar o PDF da ficha.'
                        );
                    }
                }}
                onAlterarEstado={(aluno) => abrirConfirmacaoLinha('status', aluno)}
                onEliminar={(aluno) => abrirConfirmacaoLinha('delete', aluno)}
            />

            {rowConfirmModal.open ? (
                <ConfirmRowActionModal
                    modo={rowConfirmModal.mode}
                    ativo={rowConfirmModal.aluno?.status}
                    entidade="aluno"
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
