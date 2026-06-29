import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import StatCard from '../../components/dashboard/StatCard';
import MiniAction from '../../components/dashboard/MiniAction';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
import MonthlyChart from '../../components/dashboard/MonthlyChart';
import { apiGet } from '../../utils/api';

export default function DashboardGestor() {
    const navigate = useNavigate();
    const [resumo, setResumo] = useState({
        alunosAtivos: '-',
        professores: '-',
        servicosCurriculares: '-',
        servicosExtra: '-',
    });
    const [weeklyData, setWeeklyData] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [chartsLoading, setChartsLoading] = useState(true);
    const [chartsError, setChartsError] = useState('');

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
                    servicosCurriculares: String(
                        data?.servicosCurriculares ?? 0
                    ),
                    servicosExtra: String(data?.servicosExtra ?? 0),
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
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="text-blue-500" size={20} />
                        <h2 className="text-lg font-medium text-slate-700">
                            Atividade Ativa Semanal
                        </h2>
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

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="text-amber-500" size={20} />
                        <h2 className="text-lg font-medium text-slate-700">
                            Serviços Ativos por Mês
                        </h2>
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
        </section>
    );
}
