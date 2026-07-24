import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Clock3,
    GraduationCap,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateOrNull(value) {
    if (!value) {
        return null;
    }

    const raw = String(value).trim();
    if (!raw) {
        return null;
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeWeekdayKey(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();

    if (!raw) {
        return '';
    }

    const base = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/-feira/g, '')
        .replace(/\s+/g, '');

    const aliases = {
        domingo: 'domingo',
        dom: 'domingo',
        segunda: 'segunda',
        seg: 'segunda',
        terca: 'terca',
        ter: 'terca',
        quarta: 'quarta',
        qua: 'quarta',
        quinta: 'quinta',
        qui: 'quinta',
        sexta: 'sexta',
        sex: 'sexta',
        sabado: 'sabado',
        sab: 'sabado',
        0: 'domingo',
        1: 'segunda',
        2: 'terca',
        3: 'quarta',
        4: 'quinta',
        5: 'sexta',
        6: 'sabado',
        7: 'domingo',
    };

    return aliases[base] || '';
}

function parseDiasSemana(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeWeekdayKey(item)).filter(Boolean);
    }

    if (typeof value !== 'string' || !value.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.map((item) => normalizeWeekdayKey(item)).filter(Boolean)
            : [];
    } catch {
        return value
            .split(',')
            .map((item) => normalizeWeekdayKey(item))
            .filter(Boolean);
    }
}

function getDayKey(date) {
    return normalizeWeekdayKey(date.getDay());
}

function formatTimeLabel(value) {
    const raw = String(value || '').trim();
    return raw ? raw.slice(0, 5) : '--:--';
}

function getYearLabel(service) {
    const alunoAno = String(service?.alunos?.[0]?.ano || '').trim();
    if (alunoAno) {
        return alunoAno.includes('Ano') ? alunoAno : `${alunoAno}º Ano`;
    }

    const nivel = String(service?.ano || '').trim();
    return nivel || 'Ano não definido';
}

function getServiceTitle(service) {
    return String(service?.titulo || 'Disciplina').trim();
}

function getServiceStartDate(service) {
    return service?.dataInicio || service?.data_inicio || null;
}

function getServiceEndDate(service) {
    return service?.dataFim || service?.data_fim || null;
}

function getServiceDays(service) {
    return service?.diasSemana || service?.dias_semana || [];
}

function isServiceActiveOnDate(service, date) {
    const start = parseDateOrNull(getServiceStartDate(service));
    const end = parseDateOrNull(getServiceEndDate(service)) || start;

    if (!start || !end) {
        return false;
    }

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    if (target < start || target > end) {
        return false;
    }

    const diasPermitidos = parseDiasSemana(getServiceDays(service));
    const isSingleOccurrence = start.getTime() === end.getTime();

    if (isSingleOccurrence) {
        return true;
    }

    if (!diasPermitidos.length) {
        return true;
    }

    return diasPermitidos.includes(getDayKey(target));
}

function PendingAttendanceCard({ pendingSessions, onOpenPresences }) {
    const hasPending = pendingSessions.length > 0;

    return (
        <div
            className={`rounded-[20px] border p-5 shadow-sm ${
                hasPending
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-white'
            }`}
        >
            <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-700">
                    <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                            hasPending
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-emerald-100 text-emerald-500'
                        }`}
                    >
                        {hasPending ? (
                            <AlertTriangle size={16} />
                        ) : (
                            <ClipboardCheck size={16} />
                        )}
                    </span>
                    <h2 className="text-sm font-medium">
                        Presenças por Marcar
                    </h2>
                </div>
                {hasPending && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                        {pendingSessions.length}
                    </span>
                )}
            </div>

            {hasPending ? (
                <div className="space-y-2">
                    {pendingSessions.slice(0, 5).map((session) => (
                        <button
                            key={session.sessionKey}
                            type="button"
                            onClick={onOpenPresences}
                            className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm transition hover:shadow-md"
                        >
                            <span className="min-w-[76px] rounded-lg bg-amber-100 px-2 py-2 text-center text-xs font-semibold text-amber-700">
                                {session.dateLabel}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-700">
                                    {session.titulo}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                    {session.sala || 'Sem sala'}
                                </p>
                            </div>
                        </button>
                    ))}
                    {pendingSessions.length > 5 && (
                        <button
                            type="button"
                            onClick={onOpenPresences}
                            className="w-full rounded-xl border border-dashed border-amber-300 px-4 py-2.5 text-center text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                            Ver mais {pendingSessions.length - 5} pendente
                            {pendingSessions.length - 5 > 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-700">
                    Tudo em dia — sem presenças por marcar.
                </div>
            )}
        </div>
    );
}

function TodaySessionsCard({ sessions }) {
    return (
        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-2 text-slate-700">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-500">
                    <Clock3 size={16} />
                </span>
                <h2 className="text-sm font-medium">Sessões Hoje</h2>
            </div>

            <div className="space-y-3">
                {sessions.length ? (
                    sessions.map((session) => (
                        <div
                            key={session.key}
                            className="flex items-center gap-3 rounded-xl bg-[#f2f1ef] px-4 py-3"
                        >
                            <span className="min-w-[44px] rounded-lg bg-[#d9e8f0] px-2 py-2 text-center text-xs font-semibold text-[#63738c]">
                                {session.hour}
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-700">
                                    {session.title}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                    {session.student} • {session.room}
                                </p>
                            </div>

                            <CheckCircle2
                                size={18}
                                className="text-slate-400"
                            />
                        </div>
                    ))
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                        Sem sessões marcadas para hoje.
                    </div>
                )}
            </div>
        </div>
    );
}

function DisciplineCard({ service }) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-700">
                    {service.title}
                </h3>
                <span className="rounded-full bg-[#f2ecfb] px-2 py-1 text-[11px] font-semibold text-[#a855f7]">
                    Curricular
                </span>
            </div>

            <p className="mt-2 text-xs text-slate-400">{service.yearLabel}</p>

            <div className="mt-4 space-y-2 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                    <span>Alunos:</span>
                    <strong className="text-slate-700">
                        {service.alunosCount}
                    </strong>
                </div>
                <div className="flex items-center justify-between">
                    <span>Sessões/mês:</span>
                    <strong className="text-slate-700">
                        {service.sessoesMes}
                    </strong>
                </div>
            </div>
        </article>
    );
}

function formatPendingDateLabel(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

export default function DashboardProfessorPage() {
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [attendanceSessions, setAttendanceSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadDashboard() {
            setLoading(true);
            setError('');

            try {
                const [servicesResponse, attendanceResponse] =
                    await Promise.all([
                        apiGet('/api/professor/servicos'),
                        apiGet('/api/professor/presencas/servicos'),
                    ]);
                const servicesData = await servicesResponse.json();
                const attendanceData = await attendanceResponse.json();

                if (!servicesResponse.ok) {
                    throw new Error(
                        servicesData.message ||
                            'Erro ao carregar dashboard.'
                    );
                }

                if (isMounted) {
                    setServices(
                        Array.isArray(servicesData?.servicos)
                            ? servicesData.servicos
                            : []
                    );
                    setAttendanceSessions(
                        attendanceResponse.ok &&
                            Array.isArray(attendanceData?.servicos)
                            ? attendanceData.servicos
                            : []
                    );
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError.message || 'Erro ao carregar dashboard.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => {
            isMounted = false;
        };
    }, []);

    const { todaySessions, disciplineCards, pendingSessions } = useMemo(() => {
        const todayKey = formatDateKey(new Date());
        const todayDate = parseDateOrNull(todayKey);

        const todaySessionsList = [];

        services.forEach((service) => {
            if (todayDate && isServiceActiveOnDate(service, todayDate)) {
                todaySessionsList.push({
                    key: service.id,
                    hour: formatTimeLabel(service.horaInicio),
                    title: getServiceTitle(service),
                    student: service.alunos?.[0]?.nome || 'Aluno associado',
                    room:
                        String(service.sala || 'Sem sala').trim() || 'Sem sala',
                });
            }
        });

        todaySessionsList.sort((a, b) => a.hour.localeCompare(b.hour));

        const pendingSessionsList = attendanceSessions
            .filter((s) => {
                const dateKey = String(s.dataAula || '').slice(0, 10);
                return dateKey && dateKey <= todayKey && !s.marcada;
            })
            .map((s) => ({
                sessionKey:
                    s.sessionKey || `${s.id}:${s.dataAula}`,
                titulo: s.titulo,
                sala: s.sala,
                dateLabel: formatPendingDateLabel(s.dataAula),
                dataAula: s.dataAula,
            }))
            .sort((a, b) => a.dataAula.localeCompare(b.dataAula));

        return {
            todaySessions: todaySessionsList,
            pendingSessions: pendingSessionsList,
            disciplineCards: services.map((service) => ({
                id: service.id,
                title: getServiceTitle(service),
                yearLabel: getYearLabel(service),
                alunosCount: service.alunosCount || service.alunos?.length || 0,
                sessoesMes: service.sessoesMes || 0,
            })),
        };
    }, [services, attendanceSessions]);

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Painel do professor"
                title="Dashboard"
                subtitle="Visão geral das tuas disciplinas e sessões"
                icon={GraduationCap}
            />

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
                    A carregar dashboard...
                </div>
            ) : null}

            {!loading && error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            {!loading && !error ? (
                <>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <PendingAttendanceCard
                            pendingSessions={pendingSessions}
                            onOpenPresences={() =>
                                navigate('/professor/presencas')
                            }
                        />
                        <TodaySessionsCard sessions={todaySessions} />
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex items-center gap-2 text-slate-700">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-400">
                                <GraduationCap size={16} />
                            </span>
                            <h2 className="text-sm font-medium">
                                Minhas Disciplinas
                            </h2>
                        </div>

                        {disciplineCards.length ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {disciplineCards.map((service) => (
                                    <DisciplineCard
                                        key={service.id}
                                        service={service}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                Sem disciplinas associadas à tua conta.
                            </div>
                        )}
                    </div>
                </>
            ) : null}
        </section>
    );
}
