import { useEffect, useMemo, useState } from 'react';
import {
    Check,
    Search,
    Trash2,
    UserPlus,
    CalendarDays,
    FileText,
    AlertTriangle,
} from 'lucide-react';
import { listarEventos, marcarAlertalido } from '../../utils/api';

function getRelativeTime(isoDate) {
    if (!isoDate) {
        return 'agora';
    }

    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMin < 60) {
        return `há ${diffMin} minutos`;
    }

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
}

function getDateLabel(isoDate) {
    if (!isoDate) {
        return 'Hoje';
    }

    return new Date(isoDate).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function getNotificationStyle(tipo, nivel) {
    if (nivel === 'danger') {
        return {
            iconBg: 'bg-red-100 text-red-600',
            Icon: AlertTriangle,
        };
    }

    if (nivel === 'warning') {
        return {
            iconBg: 'bg-amber-100 text-amber-600',
            Icon: AlertTriangle,
        };
    }

    if (tipo === 'manutencao') {
        return {
            iconBg: 'bg-rose-100 text-rose-500',
            Icon: CalendarDays,
        };
    }

    if (tipo === 'academico') {
        return {
            iconBg: 'bg-emerald-100 text-emerald-500',
            Icon: UserPlus,
        };
    }

    return {
        iconBg: 'bg-sky-100 text-sky-500',
        Icon: FileText,
    };
}

function formatPayloadValue(value) {
    if (value === null || value === undefined || value === '') {
        return 'Sem informação';
    }

    if (typeof value === 'boolean') {
        return value ? 'Sim' : 'Não';
    }

    if (value instanceof Date) {
        return value.toLocaleString('pt-PT');
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => formatPayloadValue(item))
            .filter(Boolean)
            .join(', ');
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return 'Sem informação';
        }

        return entries
            .map(
                ([key, itemValue]) => `${key}: ${formatPayloadValue(itemValue)}`
            )
            .join(' | ');
    }

    return String(value);
}

function pickDisplayName(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        return formatPayloadValue(value);
    }

    if (Array.isArray(value)) {
        const labels = value
            .map((item) => pickDisplayName(item))
            .filter(Boolean);

        return labels.length > 0 ? labels.join(', ') : null;
    }

    if (typeof value === 'object') {
        const nameCandidates = [
            value.nome,
            value.nome_completo,
            value.name,
            value.titulo,
            value.assunto,
            value.label,
            value.descricao,
            value.mensagem,
            value.texto,
        ];

        for (const candidate of nameCandidates) {
            if (
                candidate !== undefined &&
                candidate !== null &&
                candidate !== ''
            ) {
                return formatPayloadValue(candidate);
            }
        }
    }

    return null;
}

function getPayloadFields(payload) {
    if (!payload) {
        return [];
    }

    if (typeof payload !== 'object' || Array.isArray(payload)) {
        return [
            {
                label: 'Detalhes',
                value: formatPayloadValue(payload),
            },
        ];
    }

    const safeFieldDefinitions = [
        {
            label: 'Mensagem',
            values: [
                payload.mensagem,
                payload.message,
                payload.texto,
                payload.description,
            ],
        },
        {
            label: 'Assunto',
            values: [payload.assunto, payload.subject, payload.titulo],
        },
        {
            label: 'Origem',
            values: [payload.origem, payload.source, payload.modulo],
        },
        {
            label: 'Aluno',
            values: [payload.aluno, payload.student, payload.nome_aluno],
        },
        {
            label: 'Professor',
            values: [
                payload.professor,
                payload.teacher,
                payload.nome_professor,
            ],
        },
        {
            label: 'Serviço',
            values: [payload.servico, payload.service, payload.nome_servico],
        },
        {
            label: 'Data',
            values: [payload.data, payload.date, payload.createdAt],
        },
        {
            label: 'Estado',
            values: [payload.estado, payload.status],
        },
    ];

    const fields = [];

    safeFieldDefinitions.forEach(({ label, values }) => {
        for (const value of values) {
            const displayValue = pickDisplayName(value);
            if (displayValue) {
                fields.push({ label, value: displayValue });
                break;
            }
        }
    });

    return fields;
}

function FeedbackNotice({ feedback }) {
    if (!feedback?.message) {
        return null;
    }

    const baseClass = 'rounded-xl border px-4 py-3 text-sm';
    const toneClass =
        feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700';

    return (
        <div className={`${baseClass} ${toneClass}`}>{feedback.message}</div>
    );
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [selectedNotification, setSelectedNotification] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchNotifications() {
            try {
                setLoading(true);
                setError('');
                const result = await listarEventos({ limite: 15, offset: 0 });

                if (!result?.success) {
                    throw new Error(
                        result?.message || 'Erro ao carregar notificações.'
                    );
                }

                if (isMounted) {
                    const mapped = Array.isArray(result.data)
                        ? result.data.map((row) => ({
                              id: row.id_alerta_evento,
                              tipo: row.grupo || 'geral',
                              titulo: row.titulo,
                              descricao: row.descricao || '',
                              createdAt: row.criado_em,
                              lido: Boolean(row.lido),
                              nivel: row.nivel || '',
                              codigo: row.codigo || '',
                              payload: row.payload || null,
                              icone: row.icone || '',
                          }))
                        : [];
                    setNotifications(mapped);
                }
            } catch (err) {
                if (isMounted) {
                    const msg =
                        err?.message || 'Erro ao carregar notificações.';
                    setError(msg);
                    setFeedback({ type: 'error', message: msg });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchNotifications();
        const handleForegroundPush = () => {
            fetchNotifications();
        };

        window.addEventListener('mc:push-foreground', handleForegroundPush);
        const intervalId = setInterval(fetchNotifications, 20000);

        return () => {
            isMounted = false;
            window.removeEventListener(
                'mc:push-foreground',
                handleForegroundPush
            );
            clearInterval(intervalId);
        };
    }, []);

    async function handleMarkAsRead(id) {
        const target = notifications.find((item) => item.id === id);
        if (!target || target.lido) {
            return;
        }

        const result = await marcarAlertalido(id);
        if (!result?.success) {
            const msg = result?.message || 'Erro ao marcar como lida.';
            setError(msg);
            setFeedback({ type: 'error', message: msg });
            return;
        }

        setNotifications((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, lido: true } : item
            )
        );
        setSelectedNotification((prev) =>
            prev && prev.id === id ? { ...prev, lido: true } : prev
        );
        setFeedback({
            type: 'success',
            message: 'Notificação marcada como lida com sucesso.',
        });
    }

    async function handleMarkAllAsRead() {
        const pending = notifications.filter((item) => !item.lido);
        if (pending.length === 0) {
            setFeedback({
                type: 'success',
                message: 'Não existem notificações pendentes por marcar.',
            });
            return;
        }

        const results = await Promise.all(
            pending.map((item) => marcarAlertalido(item.id))
        );

        const updatedIds = [];
        const failed = [];

        results.forEach((result, index) => {
            if (result?.success) {
                updatedIds.push(pending[index].id);
            } else {
                failed.push(
                    result?.message || 'Falha ao atualizar notificação.'
                );
            }
        });

        if (updatedIds.length > 0) {
            setNotifications((prev) =>
                prev.map((item) =>
                    updatedIds.includes(item.id)
                        ? { ...item, lido: true }
                        : item
                )
            );
        }

        if (failed.length > 0) {
            const msg = failed[0];
            setError(msg);
            setFeedback({ type: 'error', message: msg });
            return;
        }

        setFeedback({
            type: 'success',
            message: 'Todas as notificações foram marcadas como lidas.',
        });
    }

    function handleDelete(id) {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
        setSelectedNotification((prev) =>
            prev && prev.id === id ? null : prev
        );
        setFeedback({
            type: 'success',
            message: 'Notificação removida da lista com sucesso.',
        });
    }

    function handleOpenNotification(notification) {
        setSelectedNotification(notification);
    }

    function handleCloseNotification() {
        setSelectedNotification(null);
    }

    const visibleNotifications = useMemo(() => {
        const base = notifications;

        const textFiltered = base.filter((item) => {
            const fullText =
                `${item.titulo || ''} ${item.descricao || ''}`.toLowerCase();
            return fullText.includes(search.toLowerCase().trim());
        });

        if (activeFilter === 'unread') {
            return textFiltered.filter((item) => !item.lido);
        }

        if (activeFilter === 'read') {
            return textFiltered.filter((item) => item.lido);
        }

        return textFiltered;
    }, [activeFilter, notifications, search]);

    const unreadCount = notifications.filter((item) => !item.lido).length;
    const readCount = notifications.filter((item) => item.lido).length;

    return (
        <section className="mx-auto w-full max-w-7xl space-y-5">
            <FeedbackNotice feedback={feedback} />
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-xl">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Pesquisar notificações..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveFilter('all')}
                            className={`rounded-lg px-3 py-2 text-xs font-medium ${
                                activeFilter === 'all'
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todas ({visibleNotifications.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveFilter('unread')}
                            className={`rounded-lg px-3 py-2 text-xs font-medium ${
                                activeFilter === 'unread'
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Não Lidas ({unreadCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveFilter('read')}
                            className={`rounded-lg px-3 py-2 text-xs font-medium ${
                                activeFilter === 'read'
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Lidas ({readCount})
                        </button>
                        <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                        >
                            <Check size={14} />
                            Marcar todas como lidas
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {visibleNotifications.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                        {loading
                            ? 'A carregar notificações...'
                            : error
                              ? error
                              : 'Sem notificações para mostrar.'}
                    </div>
                ) : (
                    visibleNotifications.map((notification) => {
                        const isRead = notification.lido;
                        const { Icon, iconBg } = getNotificationStyle(
                            notification.tipo,
                            notification.nivel
                        );

                        return (
                            <article
                                key={notification.id}
                                className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 transition hover:border-slate-300 hover:bg-slate-50"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    handleOpenNotification(notification)
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                    ) {
                                        event.preventDefault();
                                        handleOpenNotification(notification);
                                    }
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <div
                                            className={`rounded-xl p-3 ${iconBg}`}
                                        >
                                            <Icon size={18} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-lg font-semibold text-slate-800">
                                                    {notification.titulo}
                                                </p>
                                                {!isRead ? (
                                                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                                ) : null}
                                            </div>
                                            {notification.descricao ? (
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {notification.descricao}
                                                </p>
                                            ) : null}
                                            <p className="mt-2 text-xs text-slate-400">
                                                {getDateLabel(
                                                    notification.createdAt
                                                )}
                                                <span className="mx-2">•</span>
                                                {getRelativeTime(
                                                    notification.createdAt
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleOpenNotification(
                                                    notification
                                                );
                                            }}
                                            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                                            title="Ver detalhes"
                                        >
                                            Ver
                                        </button>
                                        {!isRead ? (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleMarkAsRead(
                                                        notification.id
                                                    );
                                                }}
                                                className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                                                title="Marcar como lida"
                                            >
                                                <Check size={16} />
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleDelete(notification.id);
                                            }}
                                            className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                                            title="Apagar notificação"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>

            {selectedNotification ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
                    <button
                        type="button"
                        className="absolute inset-0 cursor-default"
                        aria-label="Fechar popup"
                        onClick={handleCloseNotification}
                    />
                    <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Detalhe da notificação
                                </p>
                                <h2 className="mt-1 text-xl font-semibold text-slate-800">
                                    {selectedNotification.titulo}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseNotification}
                                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Fechar popup"
                            >
                                <span className="text-xl leading-none">×</span>
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-5 sm:px-6">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                    {selectedNotification.tipo}
                                </span>
                                {selectedNotification.nivel ? (
                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                        {selectedNotification.nivel}
                                    </span>
                                ) : null}
                                <span
                                    className={`rounded-full px-2.5 py-1 ${selectedNotification.lido ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                                >
                                    {selectedNotification.lido
                                        ? 'Lida'
                                        : 'Não lida'}
                                </span>
                            </div>

                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                <p className="font-medium text-slate-700">
                                    Data
                                </p>
                                <p className="mt-1">
                                    {getDateLabel(
                                        selectedNotification.createdAt
                                    )}
                                    <span className="mx-2">•</span>
                                    {getRelativeTime(
                                        selectedNotification.createdAt
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-slate-700">
                                    Conteúdo
                                </p>
                                <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                                    {selectedNotification.descricao ||
                                        'Sem descrição adicional.'}
                                </div>
                            </div>

                            {selectedNotification.payload ? (
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">
                                        Dados completos
                                    </p>
                                    {getPayloadFields(
                                        selectedNotification.payload
                                    ).length > 0 ? (
                                        <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                                            {getPayloadFields(
                                                selectedNotification.payload
                                            ).map((field) => (
                                                <div
                                                    key={field.label}
                                                    className="flex flex-col gap-1 rounded-xl bg-white px-3 py-2 shadow-sm"
                                                >
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                        {field.label}
                                                    </span>
                                                    <span className="text-sm text-slate-700">
                                                        {field.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                            Sem detalhes adicionais para
                                            mostrar.
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                                {!selectedNotification.lido ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleMarkAsRead(
                                                selectedNotification.id
                                            );
                                        }}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                    >
                                        Marcar como lida
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={handleCloseNotification}
                                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
