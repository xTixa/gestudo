import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPatch } from '../../utils/api';
import {
    AlertCircle,
    CheckCircle2,
    Funnel,
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
    const [cleaningOld, setCleaningOld] = useState(false);
    const [retentionDays, setRetentionDays] = useState('90');
    const [selectedId, setSelectedId] = useState(null);

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

    async function handleDeleteOldRequests() {
        const days = Number.parseInt(retentionDays, 10) || 90;

        if (
            !window.confirm(
                `Eliminar pedidos com mais de ${days} dias (aprovados/rejeitados)?`
            )
        )
            return;

        try {
            setCleaningOld(true);
            resetMessages();

            const response = await apiDelete(
                `/api/gestor/inscricoes-publicas/antigas?dias=${days}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao eliminar.');
            }

            await loadData(statusFilter);

            const removidas = data?.removidas || 0;

            setSuccess(
                removidas > 0
                    ? `${removidas} pedido(s) removido(s).`
                    : 'Nada para remover.'
            );
        } catch (err) {
            setError(err?.message || 'Erro ao eliminar pedidos.');
        } finally {
            setCleaningOld(false);
        }
    }

    const filteredItems = useMemo(() => {
        if (!search) return items;

        return items.filter((item) => {
            const text = `${item.nome || ''} ${item.nome_completo || ''} ${
                item.email || ''
            } ${item.telemovel || ''} ${item.ee_nome || ''} ${
                item.escola || ''
            }`.toLowerCase();

            return text.includes(search.toLowerCase());
        });
    }, [items, search]);

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
                    <div className="lg:col-span-5">
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

                    <div className="lg:col-span-3">
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

                    <div className="lg:col-span-4">
                        <label className="text-xs text-slate-500">
                            Limpeza automática
                        </label>
                        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                            <select
                                value={retentionDays}
                                onChange={(e) =>
                                    setRetentionDays(e.target.value)
                                }
                                disabled={loading}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-32"
                            >
                                <option value="30">30 dias</option>
                                <option value="60">60 dias</option>
                                <option value="90">90 dias</option>
                            </select>
                            <button
                                type="button"
                                onClick={handleDeleteOldRequests}
                                disabled={cleaningOld || loading}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Trash2 size={16} />
                                {cleaningOld ? 'A eliminar...' : 'Limpar'}
                            </button>
                        </div>
                    </div>
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

            {loading && !items.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                    A carregar...
                </div>
            ) : (
                <EnrollmentTable
                    items={filteredItems}
                    loading={loading}
                    selectedId={selectedId}
                    onRowClick={setSelectedId}
                />
            )}

            {selectedItem && (
                <EnrollmentDrawer
                    key={selectedItem.id_inscricao_publica}
                    item={selectedItem}
                    onClose={() => setSelectedId(null)}
                    onStatusChange={handleStatusChange}
                    saving={savingId === selectedId}
                />
            )}
        </section>
    );
}
