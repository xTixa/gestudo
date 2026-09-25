import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    Bell,
    CheckCircle2,
    Clock3,
    GraduationCap,
    UserCog,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

function getCurrentMonthRange() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const [year, month] = today.split('-').map(Number);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;

    return { from, to: today, today };
}

function StatusCard({ icon, tone, title, description, actionLabel, onAction }) {
    const Icon = icon;
    const toneClasses = {
        amber: 'border-amber-200 bg-amber-50 text-amber-600',
        blue: 'border-blue-200 bg-blue-50 text-blue-600',
        rose: 'border-rose-200 bg-rose-50 text-rose-600',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600',
        slate: 'border-slate-200 bg-white text-slate-400',
    };

    return (
        <article
            className={`rounded-2xl border px-5 py-4 shadow-sm ${
                tone === 'slate' ? toneClasses.slate : toneClasses[tone]
            }`}
        >
            <div className="flex items-start gap-3">
                <span
                    className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/70`}
                >
                    <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                        {title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {description}
                    </p>
                    {actionLabel && (
                        <button
                            type="button"
                            onClick={onAction}
                            className="mt-2 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                        >
                            {actionLabel}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

export default function DashboardAlunoPage() {
    const navigate = useNavigate();
    const [todaysSessions, setTodaysSessions] = useState([]);
    const [perfil, setPerfil] = useState(null);
    const [alertasNaoLidos, setAlertasNaoLidos] = useState(0);
    const [presencas, setPresencas] = useState([]);
    const [loadingError, setLoadingError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadDashboard() {
            try {
                setLoadingError(null);
                const { from, to, today } = getCurrentMonthRange();

                const [agendaRes, perfilRes, alertasRes, presencasRes] =
                    await Promise.all([
                        apiGet(`/api/public/agenda?from=${from}&to=${to}`),
                        apiGet('/api/aluno/perfil'),
                        apiGet('/api/alertas/eventos?lido=false&limite=1'),
                        apiGet('/api/aluno/presencas'),
                    ]);

                if (!agendaRes.ok) {
                    if (agendaRes.status === 401) {
                        setLoadingError(
                            'Sessão expirada. Faça login novamente.'
                        );
                    } else {
                        setLoadingError(
                            `Erro ao carregar agenda (${agendaRes.status})`
                        );
                    }
                    return;
                }

                const agendaData = await agendaRes.json();
                const atividades = agendaData?.atividadesPorDia || {};

                let todayList = atividades[today] || [];
                if (todayList.length === 0) {
                    const matchingKey = Object.keys(atividades).find((key) =>
                        key?.startsWith(today)
                    );
                    if (matchingKey) {
                        todayList = atividades[matchingKey] || [];
                    }
                }

                todayList = todayList.map((session) => ({
                    time: session.hora || '--:--',
                    title: session.titulo || 'Sessão',
                    subtitle: `${session.professor || 'Professor'} • ${session.local || 'Sala'}`,
                }));

                if (!isMounted) return;
                setTodaysSessions(todayList);

                if (perfilRes.ok) {
                    const perfilData = await perfilRes.json();
                    if (isMounted) setPerfil(perfilData?.aluno || null);
                }

                if (alertasRes.ok) {
                    const alertasData = await alertasRes.json();
                    if (isMounted)
                        setAlertasNaoLidos(Number(alertasData?.total || 0));
                }

                if (presencasRes.ok) {
                    const presencasData = await presencasRes.json();
                    if (isMounted)
                        setPresencas(
                            Array.isArray(presencasData?.presencas)
                                ? presencasData.presencas
                                : []
                        );
                }
            } catch (error) {
                if (isMounted) {
                    setLoadingError(
                        'Erro ao carregar dashboard: ' + error.message
                    );
                }
            }
        }

        loadDashboard();

        return () => {
            isMounted = false;
        };
    }, []);

    const attendanceSummary = useMemo(() => {
        const now = new Date();
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const thisMonth = presencas.filter((p) =>
            String(p.date || '').startsWith(monthPrefix)
        );
        const faltas = thisMonth.filter(
            (p) => String(p.status || '').toLowerCase() === 'falta'
        ).length;
        return { total: thisMonth.length, faltas };
    }, [presencas]);

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Painel do Aluno"
                title="Dashboard"
                subtitle="Visão geral das tuas disciplinas e sessões"
                icon={GraduationCap}
            />

            {loadingError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <AlertCircle
                            size={24}
                            className="shrink-0 text-red-600 mt-0.5"
                        />
                        <div>
                            <p className="font-medium text-red-700">
                                {loadingError}
                            </p>
                            <p className="mt-1 text-sm text-red-600">
                                Verifique sua conexão ou tente fazer login
                                novamente.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
                <div className="space-y-3">
                    {perfil?.alteracaoPendente && (
                        <StatusCard
                            icon={UserCog}
                            tone="amber"
                            title="Alteração de perfil pendente"
                            description="O pedido que fizeste está a aguardar aprovação do gestor."
                            actionLabel="Ver o meu perfil"
                            onAction={() => navigate('/aluno/perfil')}
                        />
                    )}

                    <StatusCard
                        icon={Bell}
                        tone={alertasNaoLidos > 0 ? 'blue' : 'slate'}
                        title={
                            alertasNaoLidos > 0
                                ? `${alertasNaoLidos} notificaç${alertasNaoLidos > 1 ? 'ões' : 'ão'} por ler`
                                : 'Sem notificações novas'
                        }
                        description={
                            alertasNaoLidos > 0
                                ? 'Tens avisos que ainda não abriste.'
                                : 'Já viste tudo o que há de novo.'
                        }
                        actionLabel={
                            alertasNaoLidos > 0 ? 'Ver notificações' : null
                        }
                        onAction={() => navigate('/aluno/notificacoes')}
                    />

                    <StatusCard
                        icon={CheckCircle2}
                        tone={
                            attendanceSummary.faltas > 0 ? 'rose' : 'emerald'
                        }
                        title={
                            attendanceSummary.faltas > 0
                                ? `${attendanceSummary.faltas} falta${attendanceSummary.faltas > 1 ? 's' : ''} este mês`
                                : 'Sem faltas este mês'
                        }
                        description={
                            attendanceSummary.total > 0
                                ? `${attendanceSummary.total} sessões registadas este mês.`
                                : 'Ainda sem sessões registadas este mês.'
                        }
                        actionLabel="Ver assiduidade"
                        onAction={() => navigate('/aluno/presencas')}
                    />
                </div>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-200 text-blue-700">
                            <Clock3 size={20} />
                        </span>
                        <h2 className="text-2xl font-medium text-slate-700">
                            Sessões Hoje
                        </h2>
                    </div>

                    <div className="mt-6 space-y-3">
                        {todaysSessions.length ? (
                            todaysSessions.map((session) => (
                                <div
                                    key={`${session.time}-${session.title}`}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="inline-flex rounded-lg bg-[#06b6d4] px-2.5 py-1 text-sm font-medium text-emerald-700">
                                            {session.time}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-lg font-medium text-slate-700">
                                                {session.title}
                                            </p>
                                            <p className="truncate text-sm text-slate-400">
                                                {session.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                    <CheckCircle2
                                        size={20}
                                        className="shrink-0 text-slate-400"
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                Sem sessões para hoje.
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </section>
    );
}
