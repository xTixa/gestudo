import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    GraduationCap,
    BookOpenCheck,
    BookOpen,
    UserPlus,
    Plus,
    Calendar,
    BarChart3,
    TrendingUp,
    Maximize2,
    X,
    ClipboardList,
    AlertTriangle,
    RefreshCcw,
    CalendarClock,
    UserCheck,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import StatCard from '../../components/dashboard/StatCard';
import MiniAction from '../../components/dashboard/MiniAction';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
import MonthlyChart from '../../components/dashboard/MonthlyChart';
import { apiGet } from '../../utils/api';

function AlertMetricCard({ title, value, icon: Icon, alertColor, onClick }) {
    const isAlert = Number(value) > 0;
    const colors = {
        blue: { border: 'border-l-blue-400', icon: 'text-blue-500', value: 'text-blue-700' },
        amber: { border: 'border-l-amber-400', icon: 'text-amber-500', value: 'text-amber-700' },
        red: { border: 'border-l-rose-400', icon: 'text-rose-500', value: 'text-rose-700' },
        violet: { border: 'border-l-emerald-400', icon: 'text-emerald-500', value: 'text-emerald-700' },
        slate: { border: 'border-l-slate-300', icon: 'text-slate-400', value: 'text-slate-600' },
    };
    const c = isAlert ? (colors[alertColor] || colors.slate) : colors.slate;

    return (
        <article
            className={`flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 ${c.border} bg-white px-4 py-3 shadow-sm transition ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={onClick}
        >
            <Icon size={20} className={`flex-shrink-0 ${c.icon}`} />
            <div className="min-w-0">
                <p className="text-xs text-slate-500 leading-tight">{title}</p>
                <p className={`text-xl font-bold leading-tight ${c.value}`}>{value}</p>
            </div>
        </article>
    );
}

export default function DashboardGestor() {
    const navigate = useNavigate();
    const [resumo, setResumo] = useState({
        alunosAtivos: '-',
        professores: '-',
        servicosCurriculares: '-',
        servicosExtra: '-',
        inscricoesAtivas: '-',
        faltasPorResolver: '-',
        matriculasExpiradas: '-',
        reagendamentosPendentes: '-',
        inscricoesPublicasPendentes: '-',
    });
    const [weeklyData, setWeeklyData] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [chartsLoading, setChartsLoading] = useState(true);
    const [chartsError, setChartsError] = useState('');
    const [expandedChart, setExpandedChart] = useState(null);
    const dialogRef = useRef(null);

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
            if (event.shiftKey) {
                if (document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
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

        async function carregarResumo() {
            try {
                const response = await apiGet('/api/gestor/dashboard-resumo');
                if (!response.ok) {
                    throw new Error('Falha ao carregar resumo do dashboard.');
                }

                const data = await response.json();
                if (!isMounted) {
                    return;
                }

                setResumo({
                    alunosAtivos: String(data?.alunosAtivos ?? 0),
                    professores: String(data?.professores ?? 0),
                    servicosCurriculares: String(data?.servicosCurriculares ?? 0),
                    servicosExtra: String(data?.servicosExtra ?? 0),
                    inscricoesAtivas: String(data?.inscricoesAtivas ?? '-'),
                    faltasPorResolver: String(data?.faltasPorResolver ?? '-'),
                    matriculasExpiradas: String(data?.matriculasExpiradas ?? '-'),
                    reagendamentosPendentes: String(data?.reagendamentosPendentes ?? '-'),
                    inscricoesPublicasPendentes: String(data?.inscricoesPublicasPendentes ?? '-'),
                });
            } catch {
                if (!isMounted) {
                    return;
                }

                setResumo({
                    alunosAtivos: '-',
                    professores: '-',
                    servicosCurriculares: '-',
                    servicosExtra: '-',
                });
            }
        }

        carregarResumo();

        async function carregarGraficos() {
            setChartsLoading(true);
            setChartsError('');

            try {
                const response = await apiGet('/api/gestor/dashboard-graficos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                            'Falha ao carregar gráficos do dashboard.'
                    );
                }

                if (!isMounted) {
                    return;
                }

                setWeeklyData(Array.isArray(data?.semanal) ? data.semanal : []);
                setMonthlyData(Array.isArray(data?.mensal) ? data.mensal : []);
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setChartsError(
                    error?.message || 'Erro ao carregar dados dos gráficos.'
                );
                setWeeklyData([]);
                setMonthlyData([]);
            } finally {
                if (isMounted) {
                    setChartsLoading(false);
                }
            }
        }

        carregarGraficos();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Painel do gestor"
                title="Dashboard"
                subtitle="Visão geral do Centro Bloco de Notas"
                icon={BarChart3}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Alunos"
                    value={resumo.alunosAtivos}
                    icon={Users}
                    bgColor="bg-spindle"
                    onClick={() => navigate('/gestor/alunos')}
                />
                <StatCard
                    title="Professores"
                    value={resumo.professores}
                    icon={GraduationCap}
                    bgColor="bg-cruise"
                    onClick={() => navigate('/gestor/professores')}
                />
                <StatCard
                    title="Serviços Curriculares"
                    value={resumo.servicosCurriculares}
                    icon={BookOpenCheck}
                    bgColor="bg-malibu-400"
                    onClick={() => navigate('/gestor/servicos/curriculares')}
                />
                <StatCard
                    title="Serviços Extra-Curriculares"
                    value={resumo.servicosExtra}
                    icon={BookOpen}
                    bgColor="bg-lavender-500"
                    onClick={() => navigate('/gestor/servicos/extra-curriculares')}
                />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <AlertMetricCard
                    title="Inscrições Ativas"
                    value={resumo.inscricoesAtivas}
                    icon={ClipboardList}
                    alertColor="blue"
                />
                <AlertMetricCard
                    title="Faltas por Resolver"
                    value={resumo.faltasPorResolver}
                    icon={AlertTriangle}
                    alertColor="red"
                />
                <AlertMetricCard
                    title="Matrículas a Renovar"
                    value={resumo.matriculasExpiradas}
                    icon={RefreshCcw}
                    alertColor="amber"
                />
                <AlertMetricCard
                    title="Reagendamentos Pendentes"
                    value={resumo.reagendamentosPendentes}
                    icon={CalendarClock}
                    alertColor="amber"
                    onClick={() => navigate('/gestor/reagendar')}
                />
                <AlertMetricCard
                    title="Inscrições Públicas Pendentes"
                    value={resumo.inscricoesPublicasPendentes}
                    icon={UserCheck}
                    alertColor="violet"
                    onClick={() => navigate('/gestor/inscricoes-publicas')}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MiniAction
                    title="Adicionar Aluno"
                    subtitle="Registar novo aluno"
                    icon={UserPlus}
                    bgColor="bg-spindle"
                    onClick={() => navigate('/gestor/alunos/addAluno')}
                />
                <MiniAction
                    title="Novo Serviço Curricular"
                    subtitle="Criar serviço curricular"
                    icon={Plus}
                    bgColor="bg-cruise"
                    onClick={() => navigate('/gestor/servicos/curriculares')}
                />
                <MiniAction
                    title="Novo Serviço Extra-Curricular"
                    subtitle="Criar serviço extra-curricular"
                    icon={Plus}
                    bgColor="bg-cruise"
                    onClick={() =>
                        navigate('/gestor/servicos/extra-curriculares')
                    }
                />
                <MiniAction
                    title="Ver Sessões Hoje"
                    subtitle="Consultar Sessão"
                    icon={Calendar}
                    bgColor="bg-pink"
                    onClick={() => navigate('/gestor/agenda')}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <article
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                    onClick={() => setExpandedChart('weekly')}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedChart('weekly');
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Ampliar gráfico de atividade semanal"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="text-blue-500" size={20} />
                            <h2 className="text-lg font-medium text-slate-700">
                                Atividade Ativa Semanal
                            </h2>
                        </div>
                        <Maximize2
                            className="shrink-0 text-slate-400 transition group-hover:text-blue-500"
                            size={18}
                            aria-hidden="true"
                        />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        Serviços e inscrições ativas em cada dia da última
                        semana.
                    </p>
                    <WeeklyChart
                        data={weeklyData}
                        loading={chartsLoading}
                        error={chartsError}
                    />
                </article>

                <article
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-200 hover:shadow-md"
                    onClick={() => setExpandedChart('monthly')}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedChart('monthly');
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Ampliar gráfico de serviços ativos por mês"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="text-amber-500" size={20} />
                            <h2 className="text-lg font-medium text-slate-700">
                                Serviços Ativos por Mês
                            </h2>
                        </div>
                        <Maximize2
                            className="shrink-0 text-slate-400 transition group-hover:text-amber-500"
                            size={18}
                            aria-hidden="true"
                        />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        Volume de serviços ativos ao longo dos últimos seis
                        meses.
                    </p>
                    <MonthlyChart
                        data={monthlyData}
                        loading={chartsLoading}
                        error={chartsError}
                    />
                </article>
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
                        className="w-full max-w-6xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="expanded-chart-title"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2
                                    id="expanded-chart-title"
                                    className="text-xl font-semibold text-slate-800"
                                >
                                    {expandedChart === 'weekly'
                                        ? 'Atividade Ativa Semanal'
                                        : 'Serviços Ativos por Mês'}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Passe o cursor sobre as barras para consultar os valores.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setExpandedChart(null)}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                aria-label="Fechar gráfico ampliado"
                                autoFocus
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {expandedChart === 'weekly' ? (
                            <WeeklyChart
                                data={weeklyData}
                                loading={chartsLoading}
                                error={chartsError}
                                expanded
                            />
                        ) : (
                            <MonthlyChart
                                data={monthlyData}
                                loading={chartsLoading}
                                error={chartsError}
                                expanded
                            />
                        )}
                    </section>
                </div>
            ) : null}
        </section>
    );
}
