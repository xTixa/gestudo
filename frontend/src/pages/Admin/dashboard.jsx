import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    GraduationCap,
    BookOpenCheck,
    ClipboardList,
    UserPlus,
    Calendar,
    CalendarCheck,
    Maximize2,
    X,
    Inbox,
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    MapPin,
    Receipt,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import KpiCard from '../../components/dashboard/KpiCard';
import BarSeriesChart from '../../components/dashboard/BarSeriesChart';
import { apiGet } from '../../utils/api';
import { formatMoney } from '../../components/finance/financeFormat';

const WEEKLY_SERIES = [
    { key: 'alunos', label: 'Inscrições ativas' },
    { key: 'sessoes', label: 'Serviços ativos' },
];

const MONTHLY_SERIES = [
    { key: 'curriculares', label: 'Curriculares' },
    { key: 'extra', label: 'Extra-curriculares' },
];

const CHARTS = {
    weekly: {
        title: 'Atividade da semana',
        description: 'Inscrições e serviços ativos em cada dia dos últimos 7 dias.',
        series: WEEKLY_SERIES,
        xKey: 'dia',
        emptyText: 'Ainda não há inscrições nem serviços ativos nos últimos 7 dias.',
    },
    monthly: {
        title: 'Serviços ativos por mês',
        description: 'Serviços curriculares e extra-curriculares nos últimos 6 meses.',
        series: MONTHLY_SERIES,
        xKey: 'mes',
        emptyText: 'Ainda não há serviços ativos nos últimos 6 meses.',
    },
};

function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getGreeting(date) {
    const hour = date.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 20) return 'Boa tarde';
    return 'Boa noite';
}

function getStoredUserName() {
    try {
        const stored = JSON.parse(localStorage.getItem('mc_user') || '{}');
        return stored?.nome?.trim() || stored?.email?.split('@')[0] || '';
    } catch {
        return '';
    }
}

function toCount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function Panel({ title, description, action, children, className = '' }) {
    return (
        <section
            className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] ${className}`}
        >
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                    {description ? (
                        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                    ) : null}
                </div>
                {action}
            </header>
            <div className="flex-1">{children}</div>
        </section>
    );
}

function AttentionRow({ icon, label, description, count, tone, onClick }) {
    const Icon = icon;
    const pending = count > 0;
    const tones = {
        warning: 'bg-amber-50 text-amber-600',
        critical: 'bg-rose-50 text-rose-600',
    };

    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"
            >
                <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        pending ? tones[tone] : 'bg-slate-100 text-slate-400'
                    }`}
                >
                    <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="block truncate text-xs text-slate-500">{description}</span>
                </span>
                {count === null ? (
                    <span className="text-sm text-slate-400">—</span>
                ) : pending ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                        {count}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <CheckCircle2 size={14} aria-hidden="true" />
                        Em dia
                    </span>
                )}
                <ChevronRight
                    size={16}
                    className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                    aria-hidden="true"
                />
            </button>
        </li>
    );
}

function TodaySessions({ sessions, loading, error, onOpenAgenda }) {
    if (loading) {
        return (
            <ul className="divide-y divide-slate-100" aria-busy="true">
                {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-center gap-4 px-5 py-3.5">
                        <span className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                        <span className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                    </li>
                ))}
            </ul>
        );
    }

    if (error) {
        return <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p>;
    }

    if (!sessions.length) {
        return (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <CalendarCheck size={18} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-700">
                    Sem sessões agendadas para hoje
                </p>
                <button
                    type="button"
                    onClick={onOpenAgenda}
                    className="mt-1 text-xs font-medium text-cyan-700 hover:text-cyan-900"
                >
                    Ver agenda da semana
                </button>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-slate-100">
            {sessions.map((session, index) => {
                const alunos = Array.isArray(session.alunos) ? session.alunos.length : 0;
                return (
                    <li
                        key={`${session.id}-${session.hora}-${index}`}
                        className="flex items-center gap-4 px-5 py-3"
                    >
                        <span className="w-24 shrink-0 text-sm tabular-nums text-slate-500">
                            {session.hora}
                            {session.horaFim ? `–${session.horaFim}` : ''}
                        </span>
                        <span
                            className="h-8 w-1 shrink-0 rounded-full bg-slate-200"
                            style={session.professorCor ? { background: session.professorCor } : undefined}
                            aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">
                                {session.titulo || 'Sessão'}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                                {[
                                    session.professor || 'Sem professor',
                                    alunos ? `${alunos} aluno${alunos > 1 ? 's' : ''}` : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 sm:inline-flex">
                            <MapPin size={13} aria-hidden="true" />
                            {session.local || 'Sem sala'}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export default function DashboardGestor() {
    const navigate = useNavigate();
    const [now] = useState(() => new Date());
    const [resumo, setResumo] = useState(null);
    const [resumoLoading, setResumoLoading] = useState(true);
    const [chartData, setChartData] = useState({ weekly: [], monthly: [] });
    const [chartsLoading, setChartsLoading] = useState(true);
    const [chartsError, setChartsError] = useState('');
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [sessionsError, setSessionsError] = useState('');
    const [financeiro, setFinanceiro] = useState(null);
    const [expandedChart, setExpandedChart] = useState(null);
    const dialogRef = useRef(null);
    const userName = getStoredUserName();

    useEffect(() => {
        if (!expandedChart) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setExpandedChart(null);
                return;
            }
            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusable = [
                ...dialogRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                ),
            ].filter((el) => !el.disabled);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [expandedChart]);

    useEffect(() => {
        let isMounted = true;
        const today = toDateKey(now);

        async function carregarResumo() {
            try {
                const response = await apiGet('/api/gestor/dashboard-resumo');
                if (!response.ok) throw new Error();
                const data = await response.json();
                if (isMounted) setResumo(data || {});
            } catch {
                if (isMounted) setResumo({});
            } finally {
                if (isMounted) setResumoLoading(false);
            }
        }

        async function carregarGraficos() {
            try {
                const response = await apiGet('/api/gestor/dashboard-graficos');
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Não foi possível carregar os gráficos.');
                }
                if (!isMounted) return;
                setChartData({
                    weekly: Array.isArray(data?.semanal) ? data.semanal : [],
                    monthly: Array.isArray(data?.mensal) ? data.mensal : [],
                });
            } catch (error) {
                if (isMounted) {
                    setChartsError(error?.message || 'Não foi possível carregar os gráficos.');
                }
            } finally {
                if (isMounted) setChartsLoading(false);
            }
        }

        async function carregarSessoesHoje() {
            try {
                const response = await apiGet(`/api/public/agenda?from=${today}&to=${today}`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Não foi possível carregar a agenda.');
                }
                const atividades = data?.atividadesPorDia || {};
                const lista = atividades[today] || [];
                if (isMounted) {
                    setSessions(
                        [...lista].sort((a, b) =>
                            String(a.hora || '').localeCompare(String(b.hora || ''))
                        )
                    );
                }
            } catch (error) {
                if (isMounted) {
                    setSessionsError(error?.message || 'Não foi possível carregar a agenda.');
                }
            } finally {
                if (isMounted) setSessionsLoading(false);
            }
        }

        async function carregarFinanceiro() {
            try {
                const response = await apiGet('/api/gestor/financeiro/resumo');
                if (!response.ok) throw new Error();
                const data = await response.json();
                if (isMounted) setFinanceiro(data);
            } catch {
                if (isMounted) setFinanceiro({});
            }
        }

        carregarResumo();
        carregarFinanceiro();
        carregarGraficos();
        carregarSessoesHoje();

        return () => {
            isMounted = false;
        };
    }, [now]);

    const r = resumo || {};
    const curriculares = toCount(r.servicosCurriculares);
    const extra = toCount(r.servicosExtra);
    const servicosTotal =
        curriculares === null && extra === null ? null : (curriculares || 0) + (extra || 0);
    const display = (value) => (value === null || value === undefined ? '—' : value);

    const attention = [
        {
            key: 'inscricoes',
            icon: Inbox,
            label: 'Inscrições públicas',
            description: 'Pedidos de inscrição por validar',
            count: toCount(r.inscricoesPublicasPendentes),
            tone: 'warning',
            path: '/gestor/inscricoes-publicas',
        },
        {
            key: 'renovacoes',
            icon: RefreshCcw,
            label: 'Matrículas por renovar',
            description: 'Alunos sem matrícula no ano letivo atual',
            count: toCount(r.matriculasExpiradas),
            tone: 'warning',
            path: '/gestor/renovacoes',
        },
        {
            key: 'faltas',
            icon: AlertTriangle,
            label: 'Faltas por resolver',
            description: 'Faltas registadas sem reposição',
            count: toCount(r.faltasPorResolver),
            tone: 'critical',
            path: '/gestor/presencas',
        },
        {
            key: 'mensalidades',
            icon: Receipt,
            label: 'Mensalidades em atraso',
            description:
                financeiro?.vencido > 0
                    ? `${formatMoney(financeiro.vencido)} por receber`
                    : 'Mensalidades vencidas e não pagas',
            count: financeiro ? toCount(financeiro.vencidas) : null,
            tone: 'critical',
            path: '/gestor/financeiro/mensalidades?mes=&estado=vencida',
        },
    ];
    const pendingTotal = attention.reduce((sum, item) => sum + (item.count || 0), 0);

    const dateLabel = now.toLocaleDateString('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <section className="space-y-6">
            <AdminPageHeader
                title={userName ? `${getGreeting(now)}, ${userName}` : 'Dashboard'}
                subtitle={`${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · Resumo do centro`}
                actions={
                    <>
                        <button
                            type="button"
                            onClick={() => navigate('/gestor/agenda')}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <Calendar size={16} aria-hidden="true" />
                            Agenda
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/gestor/alunos/addAluno')}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <UserPlus size={16} aria-hidden="true" />
                            Novo aluno
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <KpiCard
                    label="Alunos ativos"
                    value={display(r.alunosAtivos)}
                    icon={Users}
                    loading={resumoLoading}
                    onClick={() => navigate('/gestor/alunos')}
                />
                <KpiCard
                    label="Professores"
                    value={display(r.professores)}
                    icon={GraduationCap}
                    loading={resumoLoading}
                    onClick={() => navigate('/gestor/professores')}
                />
                <KpiCard
                    label="Serviços ativos"
                    value={display(servicosTotal)}
                    hint={
                        servicosTotal === null
                            ? undefined
                            : `${curriculares ?? 0} curriculares · ${extra ?? 0} extra-curriculares`
                    }
                    icon={BookOpenCheck}
                    loading={resumoLoading}
                    onClick={() => navigate('/gestor/servicos/curriculares')}
                />
                <KpiCard
                    label="Inscrições ativas"
                    value={display(r.inscricoesAtivas)}
                    icon={ClipboardList}
                    loading={resumoLoading}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <Panel
                    className="lg:col-span-2"
                    title="Requer atenção"
                    description={
                        resumoLoading
                            ? 'A carregar...'
                            : pendingTotal > 0
                              ? `${pendingTotal} ${pendingTotal === 1 ? 'item pendente' : 'itens pendentes'}`
                              : 'Está tudo em dia'
                    }
                >
                    <ul className="divide-y divide-slate-100">
                        {attention.map((item) => (
                            <AttentionRow
                                key={item.key}
                                icon={item.icon}
                                label={item.label}
                                description={item.description}
                                count={resumoLoading ? null : item.count}
                                tone={item.tone}
                                onClick={() => navigate(item.path)}
                            />
                        ))}
                    </ul>
                </Panel>

                <Panel
                    className="lg:col-span-3"
                    title="Sessões de hoje"
                    description={
                        sessionsLoading
                            ? 'A carregar...'
                            : `${sessions.length} ${sessions.length === 1 ? 'sessão agendada' : 'sessões agendadas'}`
                    }
                    action={
                        <button
                            type="button"
                            onClick={() => navigate('/gestor/agenda')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                        >
                            Ver agenda
                            <ChevronRight size={14} aria-hidden="true" />
                        </button>
                    }
                >
                    <div className="max-h-80 overflow-y-auto">
                        <TodaySessions
                            sessions={sessions}
                            loading={sessionsLoading}
                            error={sessionsError}
                            onOpenAgenda={() => navigate('/gestor/agenda')}
                        />
                    </div>
                </Panel>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {Object.entries(CHARTS).map(([key, chart]) => (
                    <Panel
                        key={key}
                        title={chart.title}
                        description={chart.description}
                        action={
                            <button
                                type="button"
                                onClick={() => setExpandedChart(key)}
                                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label={`Ampliar gráfico: ${chart.title}`}
                            >
                                <Maximize2 size={15} />
                            </button>
                        }
                    >
                        <div className="px-5 pb-5 pt-4">
                            <BarSeriesChart
                                data={chartData[key]}
                                xKey={chart.xKey}
                                series={chart.series}
                                loading={chartsLoading}
                                error={chartsError}
                                emptyText={chart.emptyText}
                                caption={chart.title}
                            />
                        </div>
                    </Panel>
                ))}
            </div>

            {expandedChart ? (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-8"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setExpandedChart(null);
                        }
                    }}
                    role="presentation"
                >
                    <section
                        ref={dialogRef}
                        className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="expanded-chart-title"
                    >
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h2
                                    id="expanded-chart-title"
                                    className="text-lg font-semibold text-slate-900"
                                >
                                    {CHARTS[expandedChart].title}
                                </h2>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    {CHARTS[expandedChart].description}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setExpandedChart(null)}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                aria-label="Fechar gráfico ampliado"
                                autoFocus
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <BarSeriesChart
                            data={chartData[expandedChart]}
                            xKey={CHARTS[expandedChart].xKey}
                            series={CHARTS[expandedChart].series}
                            loading={chartsLoading}
                            error={chartsError}
                            emptyText={CHARTS[expandedChart].emptyText}
                            caption={CHARTS[expandedChart].title}
                            expanded
                        />
                    </section>
                </div>
            ) : null}
        </section>
    );
}
