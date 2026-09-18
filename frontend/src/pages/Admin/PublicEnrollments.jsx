import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPatch } from '../../utils/api';
import {
    AlertCircle,
    CheckCircle2,
    Funnel,
    Loader,
    RefreshCw,
    Search,
    Trash2,
    UsersIcon,
    X,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import EnrollmentTable from '../../components/enrollments/EnrollmentTable';
import EnrollmentDrawer from '../../components/enrollments/EnrollmentDrawer';
import EnrollmentSummaryCards from '../../components/enrollments/EnrollmentSummaryCards';

function buildIntegrationMessage(integracao) {
    if (!integracao) return '';
    const alunoMessage = integracao.createdAluno
        ? 'Aluno criado.'
        : 'Aluno já existia.';
    const encarregadoMessage = integracao.createdEncarregado
        ? 'Encarregado criado.'
        : 'Encarregado já existente/reutilizado.';
    const userMessage = integracao.createdUser
        ? 'Conta criada e enviada por email.'
        : 'Conta já existente.';
    return `${alunoMessage} ${encarregadoMessage} ${userMessage}`;
}

export default function PublicEnrollmentsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [search, setSearch] = useState('');
    const [savingId, setSavingId] = useState(null);
    const [deletingEstado, setDeletingEstado] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [estadoParaEliminar, setEstadoParaEliminar] = useState('pendente');
    const [diasParaEliminar, setDiasParaEliminar] = useState('');
    const [checkedIds, setCheckedIds] = useState(() => new Set());
    const [deletingSelecionadas, setDeletingSelecionadas] = useState(false);
    const [sort, setSort] = useState({ field: null, dir: 'asc' });

    function handleSort(field) {
        setSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'asc' }
        );
    }

    function resetMessages() {
        setError('');
        setSuccess('');
    }

    const loadData = useCallback(
        async (filter = statusFilter) => {
            try {
                setLoading(true);
                resetMessages();

                const qs = filter !== 'todos' ? `?estado=${filter}` : '';
                const response = await apiGet(
                    `/api/gestor/inscricoes-publicas${qs}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.message || 'Erro ao carregar.');
                }

                const newItems = data?.inscricoes || [];

                setSelectedId((currentId) =>
                    currentId &&
                    !newItems.find((i) => i.id_inscricao_publica === currentId)
                        ? null
                        : currentId
                );

                const newIds = new Set(
                    newItems.map((i) => i.id_inscricao_publica)
                );
                setCheckedIds((prev) => {
                    const next = new Set(
                        Array.from(prev).filter((id) => newIds.has(id))
                    );
                    return next.size === prev.size ? prev : next;
                });

                setItems(newItems);
            } catch (err) {
                setError(err?.message || 'Erro ao carregar inscrições.');
            } finally {
                setLoading(false);
            }
        },
        [statusFilter]
    );

    useEffect(() => {
        const t = setTimeout(() => loadData(statusFilter), 300);
        return () => clearTimeout(t);
    }, [statusFilter, loadData]);

    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(''), 4000);
        return () => clearTimeout(t);
    }, [success]);

    async function handleStatusChange(id, estado) {
        try {
            setSavingId(id);
            resetMessages();

            const response = await apiPatch(
                `/api/gestor/inscricoes-publicas/${id}/estado`,
                { estado }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao atualizar.');
            }

            setItems((prev) =>
                prev.map((item) =>
                    item.id_inscricao_publica === id ? data.inscricao : item
                )
            );

            setSuccess(
                estado === 'aprovada'
                    ? buildIntegrationMessage(data?.integracao) ||
                          'Inscrição aprovada.'
                    : 'Estado atualizado.'
            );
        } catch (err) {
            setError(err?.message || 'Erro ao atualizar estado.');
        } finally {
            setSavingId(null);
        }
    }

    async function handleFieldsSave(id, fields) {
        setSavingId(id);
        resetMessages();

        try {
            const response = await apiPatch(
                `/api/gestor/inscricoes-publicas/${id}`,
                fields
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao guardar alterações.');
            }

            setItems((prev) =>
                prev.map((item) =>
                    item.id_inscricao_publica === id ? data.inscricao : item
                )
            );

            setSuccess('Inscrição atualizada.');
        } finally {
            setSavingId(null);
        }
    }

    const ESTADO_LABELS = {
        pendente: 'pendentes',
        aprovada: 'aprovadas',
        rejeitada: 'rejeitadas',
    };

    async function handleDeleteByEstado() {
        const estado = estadoParaEliminar;
        const label = ESTADO_LABELS[estado] || estado;
        const diasRaw = String(diasParaEliminar || '').trim();
        const dias = diasRaw ? Number.parseInt(diasRaw, 10) : null;

        if (diasRaw && (!Number.isInteger(dias) || dias < 1)) {
            setError('Número de dias inválido.');
            return;
        }

        const criterioAviso = dias
            ? `com mais de ${dias} dias`
            : 'até hoje (todas)';
        const aviso =
            estado === 'aprovada'
                ? `Eliminar inscrições ${label} ${criterioAviso}? Isto remove apenas o registo do pedido — os alunos já criados a partir destas inscrições não são afetados.`
                : `Eliminar inscrições ${label} ${criterioAviso}? Esta ação não pode ser desfeita.`;

        if (!window.confirm(aviso)) return;

        try {
            setDeletingEstado(estado);
            resetMessages();

            const qs = dias
                ? `?estado=${estado}&dias=${dias}`
                : `?estado=${estado}`;
            const response = await apiDelete(
                `/api/gestor/inscricoes-publicas/por-estado${qs}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao eliminar.');
            }

            await loadData(statusFilter);
            setDiasParaEliminar('');

            const removidas = data?.removidas || 0;

            setSuccess(
                removidas > 0
                    ? `${removidas} inscrição(ões) ${label} removida(s).`
                    : 'Nada para remover.'
            );
        } catch (err) {
            setError(err?.message || 'Erro ao eliminar pedidos.');
        } finally {
            setDeletingEstado(null);
        }
    }

    function handleToggleChecked(id, checked) {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    function handleToggleAllChecked(ids, checked) {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => {
                if (checked) next.add(id);
                else next.delete(id);
            });
            return next;
        });
    }

    async function handleDeleteSelecionadas() {
        const ids = Array.from(checkedIds);
        if (ids.length === 0) return;

        if (
            !window.confirm(
                `Eliminar ${ids.length} inscrição(ões) selecionada(s)? Esta ação não pode ser desfeita. Se alguma já estiver aprovada, apenas o registo do pedido é removido — os alunos já criados não são afetados.`
            )
        )
            return;

        try {
            setDeletingSelecionadas(true);
            resetMessages();

            const response = await apiDelete(
                '/api/gestor/inscricoes-publicas/lote',
                {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao eliminar.');
            }

            await loadData(statusFilter);
            setCheckedIds(new Set());

            const removidas = data?.removidas || 0;
            setSuccess(
                removidas > 0
                    ? `${removidas} inscrição(ões) removida(s).`
                    : 'Nada para remover.'
            );
        } catch (err) {
            setError(err?.message || 'Erro ao eliminar pedidos.');
        } finally {
            setDeletingSelecionadas(false);
        }
    }

    const filteredItems = useMemo(() => {
        const filtered = !search
            ? items
            : items.filter((item) => {
                  const text = `${item.nome || ''} ${
                      item.nome_completo || ''
                  } ${item.email || ''} ${item.telemovel || ''} ${
                      item.ee_nome || ''
                  } ${item.escola || ''}`.toLowerCase();

                  return text.includes(search.toLowerCase());
              });

        if (!sort.field) return filtered;

        const mod = sort.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const av = a[sort.field];
            const bv = b[sort.field];
            if (av == null && bv == null) return 0;
            if (av == null) return mod;
            if (bv == null) return -mod;
            if (sort.field === 'created_at')
                return (new Date(av) - new Date(bv)) * mod;
            return String(av).localeCompare(String(bv), 'pt') * mod;
        });
    }, [items, search, sort]);

    const summary = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                const estado = item.estado?.toLowerCase();
                if (estado === 'aprovada') acc.aprovada++;
                else if (estado === 'rejeitada') acc.rejeitada++;
                else acc.pendente++;
                return acc;
            },
            { pendente: 0, aprovada: 0, rejeitada: 0 }
        );
    }, [items]);

    const selectedItem = items.find(
        (it) => it.id_inscricao_publica === selectedId
    );
    const hasActiveFilters = Boolean(search || statusFilter !== 'todos');
    const resultLabel =
        filteredItems.length === 1
            ? '1 inscrição encontrada'
            : `${filteredItems.length} inscrições encontradas`;

    function clearFilters() {
        setSearch('');
        setStatusFilter('todos');
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Gestão de inscrições públicas"
                title="Inscrições públicas"
                subtitle="Aprova ou rejeita inscrições e gere integrações."
                icon={UsersIcon}
                actions={
                    <button
                        type="button"
                        onClick={() => loadData(statusFilter)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? 'animate-spin' : ''}
                        />
                        Atualizar
                    </button>
                }
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                            <Funnel size={17} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800">
                                Filtros
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Pesquisa por aluno, contacto, escola ou
                                encarregado.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                            {resultLabel}
                        </span>
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                            >
                                <X size={14} />
                                Limpar
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                        <label className="text-xs text-slate-500">
                            Pesquisar
                        </label>
                        <div className="relative mt-1">
                            <Search
                                size={16}
                                className="absolute left-3 top-3 text-slate-400"
                            />
                            <input
                                type="text"
                                value={search}
                                placeholder="Nome, email, telefone ou escola"
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-4">
                        <label className="text-xs text-slate-500">Estado</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="todos">Todos</option>
                            <option value="pendente">Pendente</option>
                            <option value="aprovada">Aprovada</option>
                            <option value="rejeitada">Rejeitada</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                    <label className="text-xs text-slate-500">
                        Eliminar inscrições
                    </label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <select
                            value={estadoParaEliminar}
                            onChange={(e) =>
                                setEstadoParaEliminar(e.target.value)
                            }
                            disabled={Boolean(deletingEstado) || loading}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <option value="pendente">Pendentes</option>
                            <option value="aprovada">Aprovadas</option>
                            <option value="rejeitada">Rejeitadas</option>
                        </select>
                        <span className="text-xs text-slate-400">
                            com mais de
                        </span>
                        <select
                            value={diasParaEliminar}
                            onChange={(e) =>
                                setDiasParaEliminar(e.target.value)
                            }
                            disabled={Boolean(deletingEstado) || loading}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <option value="">Todos (sem limite)</option>
                            <option value="15">15 dias</option>
                            <option value="30">30 dias</option>
                            <option value="60">60 dias</option>
                            <option value="90">90 dias</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleDeleteByEstado}
                            disabled={Boolean(deletingEstado) || loading}
                            className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Trash2 size={16} />
                            {deletingEstado ? 'A eliminar...' : 'Eliminar'}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        Eliminar aprovadas remove apenas o registo do pedido — os alunos já criados não são afetados.
                    </p>
                </div>
            </div>

            <EnrollmentSummaryCards summary={summary} />

            {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            {checkedIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <span className="text-sm font-medium text-red-800">
                        {checkedIds.size} inscrição(ões) selecionada(s)
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCheckedIds(new Set())}
                            disabled={deletingSelecionadas}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Limpar seleção
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteSelecionadas}
                            disabled={deletingSelecionadas}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Trash2 size={14} />
                            {deletingSelecionadas
                                ? 'A eliminar...'
                                : 'Eliminar selecionadas'}
                        </button>
                    </div>
                </div>
            )}

            {loading && !items.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader size={18} className="animate-spin" />
                        <span className="text-sm">A carregar inscrições...</span>
                    </div>
                </div>
            ) : (
                <EnrollmentTable
                    items={filteredItems}
                    loading={loading}
                    selectedId={selectedId}
                    onRowClick={setSelectedId}
                    selectable
                    checkedIds={checkedIds}
                    onToggleChecked={handleToggleChecked}
                    onToggleAllChecked={handleToggleAllChecked}
                    sort={sort}
                    onSort={handleSort}
                />
            )}

            {selectedItem && (
                <EnrollmentDrawer
                    key={selectedItem.id_inscricao_publica}
                    item={selectedItem}
                    onClose={() => setSelectedId(null)}
                    onStatusChange={handleStatusChange}
                    onFieldsSave={handleFieldsSave}
                    saving={savingId === selectedId}
                />
            )}
        </section>
    );
}
