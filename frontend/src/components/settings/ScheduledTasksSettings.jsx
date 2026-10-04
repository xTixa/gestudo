import { useEffect, useState } from 'react';
import {
    AlertCircle,
    Check,
    CheckCircle2,
    Clock,
    Loader2,
    Lock,
    PauseCircle,
    Play,
    XCircle,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';

const ESTADO_UI = {
    concluida: { label: 'Concluída', icon: CheckCircle2, className: 'text-green-700 bg-green-50' },
    falhou: { label: 'Falhou', icon: XCircle, className: 'text-red-700 bg-red-50' },
    a_correr: { label: 'A correr', icon: Loader2, className: 'text-amber-700 bg-amber-50' },
};

// Nomes legíveis para as chaves do resultado de cada tarefa.
const RESULTADO_LABELS = {
    removidos: 'registos removidos',
    mensalidades: 'mensalidades',
    novasVencidas: 'venceram ontem',
    destinatarios: 'destinatários',
    enviados: 'avisos enviados',
    alunosComAulas: 'alunos com aulas',
    professoresComAulas: 'professores com aulas',
    criadas: 'criadas',
    jaExistentes: 'já existiam',
    semPreco: 'sem preço',
};

function formatarDataHora(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function resumoResultado(resultado) {
    if (!resultado || typeof resultado !== 'object') return '';
    return Object.entries(resultado)
        .filter(([key]) => RESULTADO_LABELS[key])
        .map(([key, value]) => `${value} ${RESULTADO_LABELS[key]}`)
        .join(' · ');
}

async function pedirTarefas() {
    const response = await apiGet('/api/gestor/tarefas-agendadas');
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Erro ao carregar tarefas automáticas.');
    }
    return Array.isArray(data?.tarefas) ? data.tarefas : [];
}

function EstadoBadge({ estado }) {
    const ui = ESTADO_UI[estado];
    if (!ui) return null;
    const Icon = ui.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ui.className}`}>
            <Icon size={12} className={estado === 'a_correr' ? 'animate-spin' : ''} />
            {ui.label}
        </span>
    );
}

export default function ScheduledTasksSettings() {
    const [tarefas, setTarefas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [runningName, setRunningName] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [notification, setNotification] = useState(null);

    function notify(type, message) {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    }

    useEffect(() => {
        let isMounted = true;
        pedirTarefas()
            .then((lista) => {
                if (isMounted) setTarefas(lista);
            })
            .catch((error) => {
                if (isMounted) notify('error', error.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    async function handleRun(tarefa) {
        const confirmado = window.confirm(
            `Executar agora "${tarefa.titulo}"? Os avisos são enviados de imediato.`
        );
        if (!confirmado) return;

        setRunningName(tarefa.nome);
        try {
            const response = await apiPost(`/api/gestor/tarefas-agendadas/${tarefa.nome}/executar`, {});
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'A tarefa não foi executada.');
            }
            const resumo = resumoResultado(data.resultado);
            notify('success', resumo ? `Tarefa executada: ${resumo}.` : 'Tarefa executada.');
            setTarefas(await pedirTarefas());
        } catch (error) {
            notify('error', error.message);
            setTarefas(await pedirTarefas().catch(() => tarefas));
        } finally {
            setRunningName(null);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                    Tarefas automáticas
                </h2>
                <p className="text-base text-slate-600">
                    Lembretes e rotinas que a plataforma corre sozinha. Os destinatários
                    podem escolher os canais de cada aviso em Alertas e notificações.
                </p>
            </div>

            {notification && (
                <div
                    className={`flex items-center gap-3 px-6 py-4 rounded-lg border-l-4 ${
                        notification.type === 'success'
                            ? 'bg-green-50 border-green-500 text-green-800'
                            : 'bg-red-50 border-red-500 text-red-800'
                    }`}
                >
                    {notification.type === 'success' ? (
                        <Check size={20} className="flex-shrink-0" />
                    ) : (
                        <AlertCircle size={20} className="flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium">{notification.message}</p>
                </div>
            )}

            {loading ? (
                <p className="text-base text-slate-500 py-8 text-center">
                    A carregar tarefas...
                </p>
            ) : (
                <div className="space-y-4">
                    {tarefas.map((tarefa) => {
                        const ultima = tarefa.execucoes[0];
                        const isRunning = runningName === tarefa.nome;
                        const isExpanded = expanded === tarefa.nome;

                        return (
                            <div
                                key={tarefa.nome}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-6"
                            >
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-lg text-slate-800">
                                                {tarefa.titulo}
                                            </h3>
                                            {!tarefa.moduloDisponivel ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                    <Lock size={12} /> Fora do pacote
                                                </span>
                                            ) : !tarefa.ativa ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                    <PauseCircle size={12} /> Desligada
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1">{tarefa.descricao}</p>
                                        {tarefa.notaAtivacao && !tarefa.ativa && tarefa.moduloDisponivel ? (
                                            <p className="text-sm text-amber-700 mt-2">{tarefa.notaAtivacao}</p>
                                        ) : null}
                                        <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                                            <Clock size={14} /> {tarefa.agenda}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                            {ultima ? (
                                                <>
                                                    <span>Última execução: {formatarDataHora(ultima.iniciadoEm)}</span>
                                                    <EstadoBadge estado={ultima.estado} />
                                                    {ultima.manual ? (
                                                        <span className="text-xs text-slate-500">(manual)</span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <span>Ainda não correu.</span>
                                            )}
                                        </div>
                                        {ultima?.estado === 'concluida' && resumoResultado(ultima.resultado) ? (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {resumoResultado(ultima.resultado)}
                                            </p>
                                        ) : null}
                                        {ultima?.estado === 'falhou' && ultima.erro ? (
                                            <p className="mt-1 text-sm text-red-700">{ultima.erro}</p>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleRun(tarefa)}
                                        disabled={!tarefa.moduloDisponivel || Boolean(runningName)}
                                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isRunning ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Play size={16} />
                                        )}
                                        {isRunning ? 'A executar...' : 'Executar agora'}
                                    </button>
                                </div>

                                {tarefa.execucoes.length > 1 ? (
                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(isExpanded ? null : tarefa.nome)}
                                            className="text-sm font-medium text-emerald-600 hover:underline"
                                        >
                                            {isExpanded ? 'Esconder histórico' : 'Ver histórico'}
                                        </button>
                                        {isExpanded ? (
                                            <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
                                                {tarefa.execucoes.map((execucao) => (
                                                    <li
                                                        key={execucao.id}
                                                        className="flex flex-wrap items-center gap-2 px-4 py-2"
                                                    >
                                                        <span className="text-slate-700">
                                                            {formatarDataHora(execucao.iniciadoEm)}
                                                        </span>
                                                        <EstadoBadge estado={execucao.estado} />
                                                        {execucao.manual ? (
                                                            <span className="text-xs text-slate-500">(manual)</span>
                                                        ) : null}
                                                        <span className="text-slate-500">
                                                            {execucao.estado === 'falhou'
                                                                ? execucao.erro
                                                                : resumoResultado(execucao.resultado)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
