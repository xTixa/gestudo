import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import GestaoInternaTabs from './internalManagementTabs.jsx';
import GestaoInternaFilters from './internalManagementFilters.jsx';
import { SortableTh } from './sortableTableHeader.jsx';
import { useSortedRows } from './useSortedRows.js';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../../utils/api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// mapear possíveis valores de nível de ensino para rótulos legíveis, usando chaves comuns e também um fallback genérico
const nivelFallbackMap = {
    1: '1º Ciclo',
    2: '2º Ciclo',
    3: '3º Ciclo',
    4: 'Secundário',
    5: 'Ensino Superior',
};

// função para construir um mapa de níveis de ensino a partir dos dados carregados, considerando várias chaves possíveis para identificação
function buildNiveisMap(niveis = []) {
    const map = {};

    niveis.forEach((nivel) => {
        const label = String(
            nivel?.label || nivel?.value || nivel?.nome || ''
        ).trim();
        if (!label) {
            return;
        }

        const keys = [
            nivel?.id,
            nivel?.value,
            nivel?.key,
            nivel?.nivelRef,
            nivel?.nivelRefKey,
        ]
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value).trim().toLowerCase())
            .filter(Boolean);

        keys.forEach((key) => {
            map[key] = label;
        });
    });

    return map;
}

// função para formatar o valor do nível de ensino usando o mapa de fallback, tentando identificar padrões comuns e também limpando o texto para uma apresentação mais amigável
function formatNivelFallback(value) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        return '-';
    }

    if (nivelFallbackMap[raw]) {
        return nivelFallbackMap[raw];
    }

    if (!Number.isNaN(Number(raw))) {
        return `Nível ${raw}`;
    }

    return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

// função para extrair o rótulo do nível de ensino de uma linha de dados, tentando várias chaves comuns e também procurando dinamicamente por qualquer chave que contenha "nivel", usando o mapa de níveis para obter um rótulo legível ou caindo para um formato genérico
function getNivelEnsinoLabel(row, niveisMap) {
    const directCandidates = [
        row?.nivel_ensino,
        row?.nivel,
        row?.id_nivel_ensino,
        row?.nivel_ensino_id,
        row?.nivelEnsino,
        row?.id_nivel,
        row?.nivel_id,
    ];

    const dynamicCandidates = Object.entries(row || {})
        .filter(
            ([key, value]) =>
                /nivel/i.test(String(key)) &&
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ''
        )
        .map(([, value]) => value);

    const candidates = [...directCandidates, ...dynamicCandidates];

    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) {
            continue;
        }

        const key = String(candidate).trim().toLowerCase();
        if (!key) {
            continue;
        }

        if (niveisMap[key]) {
            return niveisMap[key];
        }

        return formatNivelFallback(candidate);
    }

    return '-';
}

// função para extrair o valor bruto do nível de ensino de uma linha de dados, tentando várias chaves comuns e também procurando dinamicamente por qualquer chave que contenha "nivel", retornando o primeiro valor encontrado ou uma string vazia se nenhum for encontrado
function getNivelEnsinoRaw(row) {
    const candidates = [
        row?.nivel_ensino,
        row?.nivel,
        row?.id_nivel_ensino,
        row?.nivel_ensino_id,
        row?.nivelEnsino,
        row?.id_nivel,
        row?.nivel_id,
    ];

    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) {
            continue;
        }

        const value = String(candidate).trim();
        if (value) {
            return value;
        }
    }

    return '';
}

// função para atribuir uma classificação de ordenação a um rótulo de nível de ensino, tentando identificar padrões comuns como "1º ciclo", "2º ciclo", "secundário" e "superior", para que possam ser ordenados de forma mais natural, e atribuindo uma classificação alta para qualquer rótulo que não se encaixe nesses padrões
function getNivelSortRank(label) {
    const normalized = String(label || '').toLowerCase();

    if (normalized.includes('1') && normalized.includes('ciclo')) return 1;
    if (normalized.includes('2') && normalized.includes('ciclo')) return 2;
    if (normalized.includes('3') && normalized.includes('ciclo')) return 3;
    if (normalized.includes('secund')) return 4;
    if (normalized.includes('superior')) return 5;

    return 99;
}

export default function DisciplinasPage() {
    const [rows, setRows] = useState([]);
    const [niveisMap, setNiveisMap] = useState({});
    const [niveisOptions, setNiveisOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNivel, setSelectedNivel] = useState('all');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ nome: '', niveisEnsino: [] });
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const carregar = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await apiGet(`${API_URL}/api/gestor/disciplinas`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Erro ao carregar disciplinas.'
                );
            }

            setRows(Array.isArray(data?.disciplinas) ? data.disciplinas : []);

            try {
                const niveisResponse = await apiGet(
                    `${API_URL}/api/public/inscricao-opcoes`
                );

                if (!niveisResponse.ok) {
                    throw new Error(
                        'Nao foi possivel carregar niveis de ensino.'
                    );
                }

                const niveisData = await niveisResponse.json();
                const niveisEnsino = Array.isArray(niveisData?.niveisEnsino)
                    ? niveisData.niveisEnsino
                    : [];

                setNiveisMap(buildNiveisMap(niveisEnsino));
                setNiveisOptions(
                    niveisEnsino
                        .map((nivel) => ({
                            value: String(
                                nivel?.id ?? nivel?.value ?? ''
                            ).trim(),
                            label: String(
                                nivel?.label ||
                                    nivel?.nome ||
                                    nivel?.value ||
                                    ''
                            ).trim(),
                        }))
                        .filter((item) => item.value && item.label)
                );
            } catch {
                setNiveisMap({});
                setNiveisOptions([]);
            }
        } catch (fetchError) {
            setError(fetchError.message || 'Erro ao carregar disciplinas.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const visibleRows = useMemo(
        () =>
            rows.map((row) => ({
                id: row?.id ?? null,
                nome: row?.nome || row?.disciplina || '-',
                nivelEnsino: getNivelEnsinoLabel(row, niveisMap),
                nivelEnsinoRaw: getNivelEnsinoRaw(row),
            })),
        [rows, niveisMap]
    );

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return visibleRows.filter((row) => {
            const matchesText = !term
                ? true
                : [row.nome, row.nivelEnsino].some((value) =>
                      String(value || '')
                          .toLowerCase()
                          .includes(term)
                  );

            const matchesNivel =
                selectedNivel === 'all'
                    ? true
                    : selectedNivel === 'sem-nivel'
                      ? row.nivelEnsino === '-'
                      : row.nivelEnsino === selectedNivel;

            return matchesText && matchesNivel;
        });
    }, [searchTerm, selectedNivel, visibleRows]);

    const nivelEnsinoComparators = useMemo(
        () => ({
            nivelEnsino: (a, b) => {
                const rankA = getNivelSortRank(a);
                const rankB = getNivelSortRank(b);
                if (rankA !== rankB) {
                    return rankA - rankB;
                }
                return String(a ?? '').localeCompare(String(b ?? ''), 'pt-PT');
            },
        }),
        []
    );

    const { sortedRows, sortColumn, sortDirection, toggleSort } =
        useSortedRows(filteredRows, null, 'asc', nivelEnsinoComparators);

    const nivelOptions = useMemo(() => {
        const unique = Array.from(
            new Set(
                visibleRows
                    .map((row) => row.nivelEnsino)
                    .filter((value) => value && value !== '-')
            )
        ).sort((a, b) => {
            const rankA = getNivelSortRank(a);
            const rankB = getNivelSortRank(b);

            if (rankA !== rankB) {
                return rankA - rankB;
            }

            return a.localeCompare(b, 'pt-PT');
        });

        return unique;
    }, [visibleRows]);

    function abrirCriacao() {
        setEditingId(null);
        setFormData({ nome: '', niveisEnsino: [] });
        setFormError('');
        setIsFormOpen(true);
    }

    function abrirEdicao(row) {
        if (row.id == null) {
            setError('Não foi possível identificar o ID desta disciplina.');
            return;
        }

        setEditingId(row.id);
        setFormData({
            nome: String(row.nome || ''),
            niveisEnsino: row.nivelEnsinoRaw
                ? [String(row.nivelEnsinoRaw)]
                : [],
        });
        setFormError('');
        setIsFormOpen(true);
    }

    function fecharFormulario() {
        setEditingId(null);
        setIsFormOpen(false);
        setFormData({ nome: '', niveisEnsino: [] });
        setFormError('');
    }

    function toggleNivelEnsino(nivelValue) {
        setFormData((prev) => {
            const selected = prev.niveisEnsino.includes(nivelValue);

            return {
                ...prev,
                niveisEnsino: selected
                    ? prev.niveisEnsino.filter((value) => value !== nivelValue)
                    : [...prev.niveisEnsino, nivelValue],
            };
        });
    }

    async function submeterFormulario(event) {
        event.preventDefault();

        const nome = formData.nome.trim();
        if (!nome) {
            setFormError('O nome da disciplina é obrigatório.');
            return;
        }

        if (formData.niveisEnsino.length === 0) {
            setFormError('Selecione pelo menos um nível de ensino.');
            return;
        }

        setSubmitting(true);
        setFormError('');

        const niveisGuardados = [];
        let nivelEmProcessamento = null;

        try {
            const isEditing = editingId != null;
            const url = `${API_URL}/api/gestor/disciplinas${isEditing ? `/${editingId}` : ''}`;

            if (isEditing) {
                const [primaryNivel, ...extraNiveis] = formData.niveisEnsino;
                nivelEmProcessamento = primaryNivel;
                const response = await apiPatch(url, {
                    nome,
                    nivelEnsino: primaryNivel,
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(
                        payload.message ||
                            'Não foi possível guardar disciplina.'
                    );
                }
                niveisGuardados.push(primaryNivel);

                for (const nivelEnsino of extraNiveis) {
                    nivelEmProcessamento = nivelEnsino;
                    const extraResponse = await apiPost(`${API_URL}/api/gestor/disciplinas`, {
                        nome,
                        nivelEnsino,
                    });
                    if (!extraResponse.ok) {
                        const payload = await extraResponse.json();
                        throw new Error(
                            payload.message ||
                                'Não foi possível guardar todos os níveis.'
                        );
                    }
                    niveisGuardados.push(nivelEnsino);
                }
            } else {
                for (const nivelEnsino of formData.niveisEnsino) {
                    nivelEmProcessamento = nivelEnsino;
                    const response = await apiPost(url, {
                        nome,
                        nivelEnsino,
                    });
                    if (!response.ok) {
                        const payload = await response.json();
                        throw new Error(
                            payload.message ||
                                'Não foi possível guardar disciplina.'
                        );
                    }
                    niveisGuardados.push(nivelEnsino);
                }
            }

            await carregar();
            fecharFormulario();
        } catch (submitError) {
            const isPartialFailure = niveisGuardados.length > 0;
            setFormError(
                isPartialFailure
                    ? `${submitError.message || 'Erro ao guardar disciplina.'} (níveis já guardados: ${niveisGuardados.join(', ')})`
                    : submitError.message || 'Erro ao guardar disciplina.'
            );
            if (isPartialFailure) {
                apiPost(`${API_URL}/api/gestor/notificar-falha-parcial`, {
                    entidade: 'disciplinas',
                    detalhes: {
                        nome,
                        niveisGuardados,
                        nivelFalhou: nivelEmProcessamento,
                    },
                }).catch(() => {});
            }
            // Recarrega mesmo em falha parcial, para refletir os níveis que
            // já foram persistidos antes do erro (evita a UI mostrar uma
            // lista desatualizada em relação ao que já está na BD).
            await carregar();
        } finally {
            setSubmitting(false);
        }
    }

    async function eliminarDisciplina(row) {
        if (row.id == null) {
            setError('Não foi possível identificar o ID desta disciplina.');
            return;
        }

        const confirmed = window.confirm(
            'Tem a certeza que pretende eliminar esta disciplina?'
        );
        if (!confirmed) {
            return;
        }

        try {
            const response = await apiDelete(
                `${API_URL}/api/gestor/disciplinas/${row.id}`
            );

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(
                    payload.message || 'Não foi possível eliminar disciplina.'
                );
            }

            await carregar();
        } catch (deleteError) {
            setError(deleteError.message || 'Erro ao eliminar disciplina.');
        }
    }

    return (
        <section className="space-y-7">
            <GestaoInternaTabs />
            <GestaoInternaFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                totalCount={visibleRows.length}
                filteredCount={filteredRows.length}
                placeholder="Pesquisar por nome ou nível de ensino"
            >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,280px)_auto] md:items-end">
                    <label>
                        <span className="mb-2 block text-sm font-medium text-slate-600">
                            Nível de Ensino
                        </span>
                        <select
                            value={selectedNivel}
                            onChange={(event) =>
                                setSelectedNivel(event.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="all">Todos os níveis</option>
                            <option value="sem-nivel">
                                Sem nível definido
                            </option>
                            {nivelOptions.map((nivel) => (
                                <option key={nivel} value={nivel}>
                                    {nivel}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="flex items-center md:justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedNivel('all');
                            }}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                            Limpar filtros
                        </button>
                    </div>
                </div>
            </GestaoInternaFilters>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={abrirCriacao}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#06b6d4] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0891b2]"
                >
                    <Plus size={16} />
                    Inserir Disciplina
                </button>
            </div>

            {isFormOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        onClick={fecharFormulario}
                        className="absolute inset-0 bg-slate-900/45"
                        aria-label="Fechar modal"
                    />

                    <form
                        onSubmit={submeterFormulario}
                        className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
                    >
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
                                    {editingId != null
                                        ? 'Editar Disciplina'
                                        : 'Nova Disciplina'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {editingId != null
                                        ? 'Atualize os campos da disciplina'
                                        : 'Preencha os campos para criar uma nova disciplina'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={fecharFormulario}
                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
                                aria-label="Fechar formulário"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Disciplina *
                                </span>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            nome: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                    placeholder="Ex: Matemática"
                                />
                            </label>

                            <fieldset className="block space-y-1.5">
                                <legend className="text-sm font-medium text-slate-700">
                                    Nível de Ensino *
                                </legend>
                                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-slate-300 bg-white p-3">
                                    {niveisOptions.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                            Não foi possível carregar os níveis
                                            de ensino.
                                        </p>
                                    ) : (
                                        niveisOptions
                                            .slice()
                                            .sort((a, b) => {
                                                const rankA = getNivelSortRank(
                                                    a.label
                                                );
                                                const rankB = getNivelSortRank(
                                                    b.label
                                                );

                                                if (rankA !== rankB) {
                                                    return rankA - rankB;
                                                }

                                                return a.label.localeCompare(
                                                    b.label,
                                                    'pt-PT'
                                                );
                                            })
                                            .map((nivel) => (
                                                <label
                                                    key={nivel.value}
                                                    className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.niveisEnsino.includes(
                                                            nivel.value
                                                        )}
                                                        onChange={() =>
                                                            toggleNivelEnsino(
                                                                nivel.value
                                                            )
                                                        }
                                                        className="h-4 w-4 rounded border-slate-300 text-[#06b6d4] focus:ring-[#06b6d4]"
                                                    />
                                                    <span>{nivel.label}</span>
                                                </label>
                                            ))
                                    )}
                                </div>
                            </fieldset>
                        </div>

                        {formError ? (
                            <p className="mt-3 text-sm text-red-600">
                                {formError}
                            </p>
                        ) : null}

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={fecharFormulario}
                                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl bg-[#06b6d4] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0891b2] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting
                                    ? 'A guardar...'
                                    : editingId != null
                                      ? 'Guardar'
                                      : 'Adicionar'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                    <ListChecks size={17} className="text-slate-600" />
                    <h2 className="text-base font-semibold text-slate-700">
                        Lista de Disciplinas
                    </h2>
                </div>
                {loading ? (
                    <p className="p-5 text-base text-slate-500">
                        A carregar disciplinas...
                    </p>
                ) : error ? (
                    <p className="p-5 text-base text-red-600">{error}</p>
                ) : rows.length === 0 ? (
                    <p className="p-5 text-base text-slate-500">
                        Sem disciplinas registadas.
                    </p>
                ) : filteredRows.length === 0 ? (
                    <p className="p-5 text-base text-slate-500">
                        Sem resultados para o filtro aplicado.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-base">
                            <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                    <SortableTh
                                        column="nome"
                                        label="Nome"
                                        sortColumn={sortColumn}
                                        sortDirection={sortDirection}
                                        onSort={toggleSort}
                                    />
                                    <SortableTh
                                        column="nivelEnsino"
                                        label="Nível de Ensino"
                                        sortColumn={sortColumn}
                                        sortDirection={sortDirection}
                                        onSort={toggleSort}
                                    />
                                    <th className="px-5 py-3.5 text-right font-semibold">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedRows.map((row, index) => (
                                    <tr
                                        key={`disciplina-${row.id ?? index}`}
                                        className="hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 text-slate-700">
                                            {row.nome}
                                        </td>
                                        <td className="px-5 py-4 text-slate-700">
                                            {row.nivelEnsino}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirEdicao(row)
                                                    }
                                                    disabled={row.id == null}
                                                    className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    title="Editar disciplina"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        eliminarDisciplina(row)
                                                    }
                                                    disabled={row.id == null}
                                                    className="rounded-md p-1.5 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    title="Eliminar disciplina"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
