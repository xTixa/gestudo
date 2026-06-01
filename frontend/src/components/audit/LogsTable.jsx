import { useEffect, useMemo, useState } from 'react';
import ActionBadge from './ActionBadge';
import LogDetailsCell from './LogDetailsCell';
import { apiGet } from '../../utils/api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

function buildQueryParams(pageValue, limitValue, currentFilters) {
    const periodRange = getPeriodDates(currentFilters?.period || 'all');
    const params = new URLSearchParams();

    params.set('page', String(pageValue));
    params.set('limit', String(limitValue));

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

function getActionLabel(value) {
    const action = String(value || '').toUpperCase();
    const map = {
        INSERT: 'Creation',
        CREATE: 'Creation',
        UPDATE: 'Update',
        DELETE: 'Removal',
        LOGIN: 'Login',
        READ: 'Read',
    };

    return map[action] || action || 'Action';
}

function getEntityLabel(value) {
    const entity = normalizeEntityKey(value);
    const map = {
        users: 'Users',
        alunos: 'Students',
        professores: 'Teachers',
        inscricoes_publicas: 'Public Enrollments',
        inscricao_publica: 'Public Enrollments',
        inscricoes: 'Enrollments',
        notificacao_broadcast: 'Notification',
        servicos_curriculares: 'Curricular Services',
        servico_curricular: 'Curricular Services',
        servicos_extracurriculares: 'Extracurricular Services',
        servico_extra_curricular: 'Extracurricular Services',
        sistema: 'System',
    };

    return map[entity] || value || 'System';
}

function getEventLabel(log) {
    const action = String(log?.acao || '').toUpperCase();
    const entity = normalizeEntityKey(log?.entidade || '');

    if (entity === 'inscricoes_publicas' && action === 'INSERT') {
        return 'Public enrollment created';
    }

    if (entity === 'inscricoes_publicas' && action === 'UPDATE') {
        return 'Public enrollment status updated';
    }

    if (entity === 'inscricoes_publicas' && action === 'DELETE') {
        return 'Old public enrollments removed';
    }

    if (entity === 'users' && action === 'INSERT') {
        return 'User created';
    }

    return `${getActionLabel(action)} on ${getEntityLabel(log?.entidade || 'System')}`;
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
        limit: 50,
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
                const params = buildQueryParams(
                    pagination.page,
                    pagination.limit,
                    filters
                );

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
    }, [filters, pagination.page, pagination.limit]);

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

    const visibleLogs = useMemo(() => logs, [logs]);

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                        Registos de atividade
                    </h2>
                    <p className="text-xs text-slate-500">
                        {pagination.total} registos encontrados
                    </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    Página {pagination.page} de {pagination.totalPages}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-5 py-3 text-left">ID</th>
                            <th className="px-5 py-3 text-left">Timestamp</th>
                            <th className="px-5 py-3 text-left">Evento</th>
                            <th className="px-5 py-3 text-left">Ação</th>
                            <th className="px-5 py-3 text-left">Entidade</th>
                            <th className="px-5 py-3 text-left">Utilizador</th>
                            <th className="px-5 py-3 text-left">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-5 py-10 text-center text-slate-500"
                                >
                                    A carregar logs...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-5 py-10 text-center text-red-600"
                                >
                                    {error}
                                </td>
                            </tr>
                        ) : visibleLogs.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-5 py-10 text-center text-slate-500"
                                >
                                    Sem registos de auditoria.
                                </td>
                            </tr>
                        ) : (
                            visibleLogs.map((log) => {
                                const timestamp = formatDateTime(
                                    log.created_at
                                );
                                return (
                                    <tr
                                        key={log.id_log}
                                        className="border-t border-slate-200/80 transition hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 whitespace-nowrap text-slate-700">
                                            {log.id_log ?? '-'}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-slate-700">
                                            {timestamp}
                                        </td>
                                        <td className="px-5 py-4 font-medium text-slate-800">
                                            {getEventLabel(log)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <ActionBadge
                                                action={String(
                                                    log.acao || ''
                                                ).toUpperCase()}
                                            />
                                        </td>
                                        <td className="px-5 py-4 text-slate-700">
                                            {getEntityLabel(
                                                log.entidade || 'Sistema'
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-slate-700">
                                            {log.utilizador || 'Sistema'}
                                        </td>
                                        <td className="px-5 py-4 text-slate-500">
                                            <LogDetailsCell
                                                details={log.detalhes}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-white disabled:opacity-50"
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
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-white disabled:opacity-50"
                    >
                        Seguinte
                    </button>
                </div>
            </div>
        </div>
    );
}
