import { useEffect, useMemo, useState } from 'react';
import ActionBadge from './ActionBadge';
import LogDetailsCell from './LogDetailsCell';
import { apiGet } from '../../utils/api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const LOGS_PAGE_SIZE = 15;

function getPeriodDates(period) {
    const now = new Date();
    const today = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    if (period === 'today') {
        const date = today.toISOString().slice(0, 10);
        return { from: date, to: date };
    }

    if (period === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const date = yesterday.toISOString().slice(0, 10);
        return { from: date, to: date };
    }

    if (period === 'last7') {
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() - 6);
        return {
            from: from.toISOString().slice(0, 10),
            to: today.toISOString().slice(0, 10),
        };
    }

    if (period === 'last30') {
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() - 29);
        return {
            from: from.toISOString().slice(0, 10),
            to: today.toISOString().slice(0, 10),
        };
    }

    return { from: '', to: '' };
}

function buildQueryParams(pageValue, currentFilters) {
    const periodRange = getPeriodDates(currentFilters?.period || 'all');
    const params = new URLSearchParams();

    params.set('page', String(pageValue));
    params.set('limit', String(LOGS_PAGE_SIZE));

    if (currentFilters?.search) params.set('search', currentFilters.search);
    if (currentFilters?.action) params.set('action', currentFilters.action);
    if (currentFilters?.entity) params.set('entity', currentFilters.entity);
    if (currentFilters?.user) params.set('user', currentFilters.user);
    if (periodRange.from) params.set('from', periodRange.from);
    if (periodRange.to) params.set('to', periodRange.to);

    return params;
}

function normalizeEntityKey(value) {
    return String(value || 'sistema')
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');
}

function getEntityLabel(value) {
    const entity = normalizeEntityKey(value);
    const map = {
        users: 'Utilizadores',
        alunos: 'Alunos',
        professores: 'Professores',
        inscricoes_publicas: 'Inscricoes publicas',
        inscricao_publica: 'Inscricoes publicas',
        inscricoes: 'Inscricoes',
        notificacao_broadcast: 'Notificacao',
        servicos_curriculares: 'Servicos curriculares',
        servico_curricular: 'Servicos curriculares',
        servicos_extracurriculares: 'Servicos extra-curriculares',
        servico_extra_curricular: 'Servicos extra-curriculares',
        sistema: 'Sistema',
    };

    return map[entity] || value || 'Sistema';
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    const datePart = date.toLocaleDateString('pt-PT');
    const timePart = date.toLocaleTimeString('pt-PT');
    return `${datePart} ${timePart}`;
}

export default function LogsTable({ filters, onOptionsChange }) {
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: LOGS_PAGE_SIZE,
        total: 0,
        totalPages: 1,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const queryKey = JSON.stringify({
        search: filters?.search || '',
        action: filters?.action || '',
        entity: filters?.entity || '',
        user: filters?.user || '',
        period: filters?.period || 'all',
    });

    useEffect(() => {
        setPagination((prev) => ({ ...prev, page: 1 }));
    }, [queryKey]);

    useEffect(() => {
        let isMounted = true;

        async function carregarLogs() {
            setLoading(true);
            setError('');

            try {
                const params = buildQueryParams(pagination.page, filters);
                const response = await apiGet(
                    `${API_URL}/api/gestor/logs?${params.toString()}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao carregar logs.');
                }

                if (isMounted) {
                    setLogs(Array.isArray(data?.logs) ? data.logs : []);
                    setPagination((prev) => ({
                        ...prev,
                        ...(data?.pagination || {}),
                        limit: LOGS_PAGE_SIZE,
                    }));
                }
            } catch (fetchError) {
                if (isMounted) {
                    setError(fetchError.message || 'Erro ao carregar logs.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregarLogs();

        return () => {
            isMounted = false;
        };
    }, [filters, pagination.page]);

    useEffect(() => {
        if (!onOptionsChange) {
            return;
        }

        const actions = Array.from(
            new Set(
                logs
                    .map((log) => String(log?.acao ?? '').trim())
                    .filter(Boolean)
            )
        ).sort();
        const entities = Array.from(
            new Set(
                logs
                    .map((log) => String(log?.entidade ?? 'Sistema').trim())
                    .filter(Boolean)
            )
        ).sort();
        const users = Array.from(
            new Set(
                logs
                    .map((log) => String(log?.utilizador ?? 'Sistema').trim())
                    .filter(Boolean)
            )
        ).sort();

        onOptionsChange({ actions, entities, users });
    }, [logs, onOptionsChange]);

    const visibleLogs = useMemo(() => logs.slice(0, LOGS_PAGE_SIZE), [logs]);

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                        Auditoria
                    </h2>
                    <p className="text-xs text-slate-500">
                        {pagination.total} registos · maximo 15 por pagina
                    </p>
                </div>

                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Pagina {pagination.page} de {pagination.totalPages}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-2.5 text-left">Data</th>
                            <th className="px-4 py-2.5 text-left">Acao</th>
                            <th className="px-4 py-2.5 text-left">Entidade</th>
                            <th className="px-4 py-2.5 text-left">
                                Utilizador
                            </th>
                            <th className="px-4 py-2.5 text-left">Detalhes</th>
                            <th className="px-4 py-2.5 text-right">ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-10 text-center text-slate-500"
                                >
                                    A carregar logs...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-10 text-center text-red-600"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : visibleLogs.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-10 text-center text-slate-500"
                                >
                                    Sem registos de auditoria.
                                </td>
                            </tr>
                        ) : (
                            visibleLogs.map((log) => (
                                <tr
                                    key={log.id_log}
                                    className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                                >
                                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                                        {formatDateTime(log.created_at)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <ActionBadge
                                            action={String(
                                                log.acao || ''
                                            ).toUpperCase()}
                                        />
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-700">
                                        {getEntityLabel(
                                            log.entidade || 'Sistema'
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-700">
                                        {log.utilizador || 'Sistema'}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500">
                                        <LogDetailsCell details={log.detalhes} />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs text-slate-400">
                                        {log.id_log ?? '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                    Mostrando {visibleLogs.length} de {pagination.total}{' '}
                    registos
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={loading || pagination.page <= 1}
                        onClick={() =>
                            setPagination((prev) => ({
                                ...prev,
                                page: Math.max(1, prev.page - 1),
                            }))
                        }
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white disabled:opacity-50"
                    >
                        Anterior
                    </button>
                    <button
                        type="button"
                        disabled={
                            loading || pagination.page >= pagination.totalPages
                        }
                        onClick={() =>
                            setPagination((prev) => ({
                                ...prev,
                                page: Math.min(prev.totalPages, prev.page + 1),
                            }))
                        }
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white disabled:opacity-50"
                    >
                        Seguinte
                    </button>
                </div>
            </div>
        </div>
    );
}
