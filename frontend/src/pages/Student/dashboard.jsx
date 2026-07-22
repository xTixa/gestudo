import { useEffect, useState } from 'react';
import {
    BookOpen,
    CheckCircle2,
    GraduationCap,
    Users,
    AlertCircle,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

function getCurrentMonthRange() {
    // Usar ISO string para evitar problemas de fuso horário
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // Ex: 2026-04-30

    // Extrair ano e mês de forma segura
    const [year, month] = today.split('-').map(Number);

    // Primeiro dia do mês
    const from = `${year}-${String(month).padStart(2, '0')}-01`;

    // Até hoje (para incluir aulas de hoje)
    const to = today;

    return {
        from,
        to,
        today,
    };
}

export default function DashboardAlunoPage() {
    const [stats, setStats] = useState([
        {
            label: 'Serviços Ativos',
            value: '0',
            icon: Users,
            iconClasses: 'bg-blue-200 text-blue-700',
        },
        {
            label: 'Aulas Este Mês',
            value: '0',
            icon: GraduationCap,
            iconClasses: 'bg-emerald-200 text-emerald-700',
        },
        {
            label: 'Horas de Estudo',
            value: '0h',
            icon: BookOpen,
            iconClasses: 'bg-pink-200 text-pink-700',
        },
    ]);
    const [todaysSessions, setTodaysSessions] = useState([]);
    const [loadingError, setLoadingError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadDashboard() {
            try {
                setLoadingError(null);
                const { from, to, today } = getCurrentMonthRange();

                console.log(
                    '[Dashboard] Fetching agenda from:',
                    from,
                    'to:',
                    to
                );

                const response = await apiGet(
                    `/api/public/agenda?from=${from}&to=${to}`
                );

                console.log('[Dashboard] Response status:', response.status);

                if (!response.ok) {
                    const errorData = await response.text();
                    console.error('[Dashboard] Error response:', errorData);

                    if (response.status === 401) {
                        setLoadingError(
                            'Sessão expirada. Faça login novamente.'
                        );
                    } else {
                        setLoadingError(
                            `Erro ao carregar agenda (${response.status})`
                        );
                    }
                    return;
                }

                const data = await response.json();
                console.log('[Dashboard] Response data:', data);

                const atividades = data?.atividadesPorDia || {};
                console.log(
                    '[Dashboard] Atividades por dia:',
                    Object.keys(atividades).length,
                    'days'
                );
                console.log(
                    '[Dashboard] Chaves disponíveis:',
                    Object.keys(atividades)
                );
                console.log('[Dashboard] Today é:', today);
                console.log(
                    '[Dashboard] Sessões para hoje:',
                    atividades[today]
                );

                const allSessions = Object.values(atividades).flat();
                console.log('[Dashboard] Total sessions:', allSessions.length);

                const distinctServices = new Set(
                    allSessions.map((session) => session.id)
                ).size;

                const horas = allSessions.reduce((acc, session) => {
                    const start = String(session.hora || '')
                        .split(':')
                        .map(Number);
                    const end = String(session.horaFim || '')
                        .split(':')
                        .map(Number);
                    if (
                        start.length < 2 ||
                        end.length < 2 ||
                        start.some(Number.isNaN) ||
                        end.some(Number.isNaN)
                    ) {
                        return acc;
                    }

                    const startMinutes = start[0] * 60 + start[1];
                    const endMinutes = end[0] * 60 + end[1];
                    return acc + Math.max(0, endMinutes - startMinutes);
                }, 0);

                // Procurar sessões de hoje com fallback robusto
                let todayList = atividades[today] || [];

                // Se não encontrar com a chave exata, tentar procurar por qualquer chave que comece com a data
                if (todayList.length === 0) {
                    console.log(
                        '[Dashboard] Chave exata não encontrada, procurando por fallback...'
                    );
                    const matchingKey = Object.keys(atividades).find(
                        (key) => key && key.startsWith(today.substring(0, 10))
                    );
                    console.log('[Dashboard] Matching key found:', matchingKey);
                    if (matchingKey) {
                        todayList = atividades[matchingKey] || [];
                        console.log(
                            '[Dashboard] Usando chave de fallback, sessões encontradas:',
                            todayList.length
                        );
                    }
                }

                todayList = todayList.map((session) => ({
                    time: session.hora || '--:--',
                    title: session.titulo || 'Sessão',
                    subtitle: `${session.professor || 'Professor'} • ${session.local || 'Sala'}`,
                }));

                if (isMounted) {
                    setStats([
                        {
                            label: 'Serviços Ativos',
                            value: String(distinctServices),
                            icon: Users,
                            iconClasses: 'bg-blue-200 text-blue-700',
                        },
                        {
                            label: 'Aulas Este Mês',
                            value: String(allSessions.length),
                            icon: GraduationCap,
                            iconClasses: 'bg-emerald-200 text-emerald-700',
                        },
                        {
                            label: 'Horas de Estudo',
                            value: `${Math.round(horas / 60)}h`,
                            icon: BookOpen,
                            iconClasses: 'bg-pink-200 text-pink-700',
                        },
                    ]);
                    setTodaysSessions(todayList);
                }
            } catch (error) {
                console.error('[Dashboard] Error loading agenda:', error);
                if (isMounted) {
                    setLoadingError(
                        'Erro ao carregar agenda: ' + error.message
                    );
                }
            }
        }

        loadDashboard();

        return () => {
            isMounted = false;
        };
    }, []);

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
                    {stats.map((item) => {
                        const Icon = item.icon;

                        return (
                            <article
                                key={item.label}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-lg text-slate-400">
                                            {item.label}
                                        </p>
                                        <p className="mt-1 text-4xl font-semibold text-slate-700">
                                            {item.value}
                                        </p>
                                    </div>
                                    <span
                                        className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${item.iconClasses}`}
                                    >
                                        <Icon size={24} />
                                    </span>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-200 text-blue-700">
                            <Users size={20} />
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
                                        <span className="inline-flex rounded-lg bg-[#14ad81] px-2.5 py-1 text-sm font-medium text-emerald-700">
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
