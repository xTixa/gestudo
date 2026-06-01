import { useEffect, useState } from 'react';
import {
    Bell,
    CheckCircle2,
    Clock,
    Trash2,
    X,
    ChevronDown,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { listarEventos, marcarAlertalido } from '../../utils/api';

const NIVEL_COLORS = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
};

const NIVEL_BADGE = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
};

export default function AlertsEventosPage() {
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtroLido, setFiltroLido] = useState(null); // null = todos, true = lidos, false = nao lidos
    const [paginacao, setPaginacao] = useState({ offset: 0, limite: 20 });
    const [total, setTotal] = useState(0);
    const [expanded, setExpanded] = useState(new Set());

    // Load events on mount and when filters change
    useEffect(() => {
        async function loadEventos() {
            try {
                setLoading(true);
                setError(null);

                const filters = {
                    limite: paginacao.limite,
                    offset: paginacao.offset,
                };

                if (filtroLido !== null) {
                    filters.lido = filtroLido;
                }

                const result = await listarEventos(filters);

                if (!result.success) {
                    throw new Error(
                        result.message || 'Erro ao carregar eventos'
                    );
                }

                setEventos(result.data || []);
                setTotal(result.total || 0);
            } catch (err) {
                console.error('Erro ao carregar eventos:', err);
                setError(err.message || 'Erro ao carregar notificações');
                setEventos([]);
            } finally {
                setLoading(false);
            }
        }

        loadEventos();
    }, [paginacao, filtroLido]);

    async function handleMarkAsRead(id) {
        try {
            const result = await marcarAlertalido(id);

            if (result.success) {
                setEventos((prev) =>
                    prev.map((evento) =>
                        evento.id_alerta_evento === id
                            ? {
                                  ...evento,
                                  lido: true,
                                  lido_em: new Date().toISOString(),
                              }
                            : evento
                    )
                );
            } else {
                setError(result.message || 'Erro ao marcar como lido');
            }
        } catch (err) {
            console.error('Erro ao marcar como lido:', err);
            setError('Erro ao marcar como lido');
        }
    }

    function toggleExpanded(id) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    const naoLidos = eventos.filter((e) => !e.lido).length;
    const numeroPaginas = Math.ceil(total / paginacao.limite);
    const paginaAtual = Math.floor(paginacao.offset / paginacao.limite) + 1;

    if (loading && eventos.length === 0) {
        return (
            <section className="mx-auto w-full max-w-6xl space-y-4">
                <div className="flex items-center justify-center py-12">
                    <p className="text-slate-600">A carregar notificações...</p>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-6xl space-y-4">
            <AdminPageHeader
                eyebrow="Notificações"
                title="Notificações"
                subtitle="Veja todas as notificações e alertas emitidos para sua conta"
                icon={Bell}
                actions={
                    naoLidos > 0 ? (
                        <span className="inline-flex items-center justify-center self-start rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-medium text-white">
                            {naoLidos}
                        </span>
                    ) : null
                }
            />

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error}
                </div>
            )}

            {/* Filtros */}
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                <div className="flex gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setFiltroLido(null)}
                        className={`rounded px-3 py-1.5 font-medium transition ${
                            filtroLido === null
                                ? 'bg-slate-800 text-white'
                                : 'border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        Todos
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroLido(false)}
                        className={`rounded px-3 py-1.5 font-medium transition ${
                            filtroLido === false
                                ? 'bg-amber-100 text-amber-800'
                                : 'border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        Não Lidos
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroLido(true)}
                        className={`rounded px-3 py-1.5 font-medium transition ${
                            filtroLido === true
                                ? 'bg-green-100 text-green-800'
                                : 'border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        Lidos
                    </button>
                </div>

                <div className="ml-auto text-xs text-slate-500">
                    Mostrando {eventos.length} de {total} notificações
                </div>
            </div>

            {/* Lista de eventos */}
            {eventos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-12">
                    <Bell size={32} className="mb-2 text-slate-400" />
                    <p className="text-slate-600">
                        Nenhuma notificação encontrada
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {eventos.map((evento) => {
                        const isExpanded = expanded.has(
                            evento.id_alerta_evento
                        );
                        const icon = evento.icone || 'Bell';

                        return (
                            <div
                                key={evento.id_alerta_evento}
                                className={`rounded-lg border transition ${
                                    evento.lido
                                        ? 'border-slate-100 bg-slate-50'
                                        : 'border-blue-200 bg-blue-50'
                                } ${!evento.lido ? 'ring-1 ring-blue-200' : ''}`}
                            >
                                {/* Header line */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        toggleExpanded(evento.id_alerta_evento)
                                    }
                                    className="w-full px-4 py-3 text-left transition hover:bg-white/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`rounded-lg p-2 ${
                                                evento.lido
                                                    ? 'bg-slate-200 text-slate-600'
                                                    : 'bg-blue-100 text-blue-600'
                                            }`}
                                        >
                                            {icon === 'Bell' ? (
                                                <Bell size={14} />
                                            ) : (
                                                <span className="text-xs">
                                                    {icon}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p
                                                className={`truncate font-semibold ${
                                                    evento.lido
                                                        ? 'text-slate-600'
                                                        : 'text-slate-800'
                                                }`}
                                            >
                                                {evento.titulo}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                                {evento.grupo || 'Geral'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {evento.nivel && (
                                                <span
                                                    className={`rounded px-2 py-1 text-xs font-medium ${NIVEL_BADGE[evento.nivel] || NIVEL_BADGE.info}`}
                                                >
                                                    {evento.nivel}
                                                </span>
                                            )}

                                            {!evento.lido && (
                                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                            )}

                                            <ChevronDown
                                                size={14}
                                                className={`text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <>
                                        <div className="border-t border-inherit px-4 py-3">
                                            <p className="text-sm text-slate-700">
                                                {evento.descricao}
                                            </p>

                                            {evento.payload &&
                                                typeof evento.payload ===
                                                    'object' &&
                                                Object.keys(evento.payload)
                                                    .length > 0 && (
                                                    <div className="mt-3 rounded bg-slate-100 p-2">
                                                        <p className="text-xs font-medium text-slate-600 mb-1">
                                                            Detalhes:
                                                        </p>
                                                        <pre className="text-xs text-slate-600 whitespace-pre-wrap overflow-hidden break-words max-h-40">
                                                            {JSON.stringify(
                                                                evento.payload,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    </div>
                                                )}

                                            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(
                                                        evento.criado_em
                                                    ).toLocaleString('pt-PT')}
                                                </div>
                                                {evento.lido &&
                                                    evento.lido_em && (
                                                        <div className="flex items-center gap-1 text-green-600">
                                                            <CheckCircle2
                                                                size={12}
                                                            />
                                                            Lido em{' '}
                                                            {new Date(
                                                                evento.lido_em
                                                            ).toLocaleString(
                                                                'pt-PT'
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="border-t border-inherit flex gap-2 bg-slate-100/50 px-4 py-2">
                                            {!evento.lido && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleMarkAsRead(
                                                            evento.id_alerta_evento
                                                        )
                                                    }
                                                    className="flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition"
                                                >
                                                    <CheckCircle2 size={13} />
                                                    Marcar como lido
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Paginação */}
            {numeroPaginas > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        type="button"
                        onClick={() =>
                            setPaginacao((p) => ({
                                ...p,
                                offset: Math.max(0, p.offset - p.limite),
                            }))
                        }
                        disabled={paginaAtual === 1}
                        className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Anterior
                    </button>

                    <div className="text-xs text-slate-600">
                        Página {paginaAtual} de {numeroPaginas}
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setPaginacao((p) => ({
                                ...p,
                                offset: p.offset + p.limite,
                            }))
                        }
                        disabled={paginaAtual === numeroPaginas}
                        className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Próxima →
                    </button>
                </div>
            )}
        </section>
    );
}
