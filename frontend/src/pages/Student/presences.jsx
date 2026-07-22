import { createElement, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarClock,
    CalendarDays,
    Check,
    Clock3,
    Loader2,
    XCircle,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

const MONTH_ORDER = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
];

const MONTH_LABEL = {
    Jan: 'Janeiro',
    Fev: 'Fevereiro',
    Mar: 'Março',
    Abr: 'Abril',
    Mai: 'Maio',
    Jun: 'Junho',
    Jul: 'Julho',
    Ago: 'Agosto',
    Set: 'Setembro',
    Out: 'Outubro',
    Nov: 'Novembro',
    Dez: 'Dezembro',
};

const STATUS_LABELS = {
    presente: 'Presente',
    falta: 'Falta',
    reposta: 'Reposta',
    justificada: 'Justificada',
};

const STATUS_META = {
    presente: {
        icon: Check,
        badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        dot: 'bg-[#14ad81]',
    },
    falta: {
        icon: XCircle,
        badge: 'bg-rose-50 text-rose-700 ring-rose-100',
        dot: 'bg-rose-500',
    },
    reposta: {
        icon: CalendarClock,
        badge: 'bg-blue-50 text-blue-700 ring-blue-100',
        dot: 'bg-blue-500',
    },
    justificada: {
        icon: Check,
        badge: 'bg-amber-50 text-amber-700 ring-amber-100',
        dot: 'bg-amber-500',
    },
};

function monthKeyFromDate(dateIso) {
    if (!dateIso) return '';

    const [, month] = String(dateIso).split('-');
    const monthIndex = Number(month) - 1;

    return MONTH_ORDER[monthIndex] || '';
}

function formatDateLabel(dateIso) {
    const date = new Date(`${String(dateIso || '').slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return '--';
    }

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
    });
}

function currentAcademicYearLabel() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startYear = month >= 9 ? year : year - 1;
    return `${startYear}/${startYear + 1}`;
}

function currentMonthKey() {
    return MONTH_ORDER[new Date().getMonth()] || '';
}

function getInitialVisibleMonth(rows) {
    const current = currentMonthKey();
    if (
        rows.some((row) => (row.month || monthKeyFromDate(row.date)) === current)
    ) {
        return current;
    }

    const firstRow = rows
        .slice()
        .sort((left, right) =>
            String(right.date || '').localeCompare(String(left.date || ''))
        )[0];

    return firstRow?.month || monthKeyFromDate(firstRow?.date) || current;
}

function SummaryCard({ icon, value, label }) {
    return (
        <article className="rounded-xl bg-[#f2f1ef] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="flex justify-center text-slate-500">
                {createElement(icon, { size: 13 })}
            </div>
            <div className="mt-1 text-xl font-semibold leading-none text-slate-700">
                {value}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                {label}
            </div>
        </article>
    );
}

function AttendanceRow({ session }) {
    const status = String(session.status || 'presente').toLowerCase();
    const meta = STATUS_META[status] || STATUS_META.presente;
    const Icon = meta.icon;

    return (
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                            {session.subject || 'Serviço'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                            {session.teacher || 'Professor'} ·{' '}
                            {session.room || 'Sala'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <CalendarDays size={13} />
                        {formatDateLabel(session.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <Clock3 size={13} />
                        {session.time || '--:--'}
                    </span>
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}
                    >
                        <Icon size={13} />
                        {STATUS_LABELS[status] || 'Presente'}
                    </span>
                </div>
            </div>

            {session.note || (status === 'reposta' && session.replacementDate) ? (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {session.note ? <p>{session.note}</p> : null}
                    {status === 'reposta' && session.replacementDate ? (
                        <p className="font-medium text-blue-700">
                            Reposição: {formatDateLabel(session.replacementDate)}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}

export default function PresencasAlunoPage() {
    const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [presencas, setPresencas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [anoLectivo, setAnoLectivo] = useState(currentAcademicYearLabel());
    const [alunoNome, setAlunoNome] = useState('Aluno');

    useEffect(() => {
        let isMounted = true;

        async function loadPresencas() {
            setLoading(true);
            setError('');

            try {
                const response = await apiGet('/api/aluno/presencas');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao carregar presenças.');
                }

                if (!isMounted) return;

                const rows = Array.isArray(data.presencas)
                    ? data.presencas
                    : [];
                setPresencas(rows);
                setAlunoNome(data.aluno?.nome || 'Aluno');
                setAnoLectivo(
                    data.ano_letivo || data.year || currentAcademicYearLabel()
                );
                setSelectedMonth(getInitialVisibleMonth(rows));
            } catch (requestError) {
                if (isMounted) {
                    setError(requestError.message || 'Erro ao carregar presenças.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadPresencas();

        return () => {
            isMounted = false;
        };
    }, []);

    const rowsByMonth = useMemo(() => {
        return presencas.reduce((accumulator, row) => {
            const monthKey = row.month || monthKeyFromDate(row.date);
            if (!monthKey) return accumulator;

            if (!accumulator[monthKey]) {
                accumulator[monthKey] = [];
            }

            accumulator[monthKey].push(row);
            return accumulator;
        }, {});
    }, [presencas]);

    const attendanceRows = useMemo(
        () =>
            (rowsByMonth[selectedMonth] || [])
                .slice()
                .sort((left, right) =>
                    String(right.date || '').localeCompare(String(left.date || ''))
                ),
        [rowsByMonth, selectedMonth]
    );

    const visibleAttendanceRows = useMemo(() => {
        if (selectedStatus === 'all') return attendanceRows;

        return attendanceRows.filter(
            (row) => String(row.status || '').toLowerCase() === selectedStatus
        );
    }, [attendanceRows, selectedStatus]);

    const attendanceSummary = useMemo(() => {
        const total = attendanceRows.length;
        const presentes = attendanceRows.filter(
            (row) => row.status === 'presente'
        ).length;
        const faltas = attendanceRows.filter(
            (row) => row.status === 'falta'
        ).length;
        const assiduidade = total > 0 ? Math.round((presentes / total) * 100) : 0;

        return { total, presentes, faltas, assiduidade };
    }, [attendanceRows]);

    const monthName = MONTH_LABEL[selectedMonth] || selectedMonth;

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Presenças do aluno"
                title="As Minhas Presenças"
                subtitle="Consulta o histórico de aulas e faltas por mês."
                icon={CalendarDays}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryCard
                    icon={CalendarDays}
                    value={attendanceSummary.total}
                    label="Aulas"
                />
                <SummaryCard
                    icon={Check}
                    value={attendanceSummary.presentes}
                    label="Presenças"
                />
                <SummaryCard
                    icon={Clock3}
                    value={`${attendanceSummary.assiduidade}%`}
                    label="Assiduidade"
                />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-800">
                            {alunoNome}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Ano letivo {anoLectivo} · {monthName} ·{' '}
                            {visibleAttendanceRows.length} aulas visíveis
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {MONTH_ORDER.map((month) => {
                                const isActive = selectedMonth === month;
                                return (
                                    <button
                                        type="button"
                                        key={month}
                                        onClick={() => setSelectedMonth(month)}
                                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                            isActive
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                        }`}
                                    >
                                        {month}
                                    </button>
                                );
                            })}
                        </div>

                        <select
                            value={selectedStatus}
                            onChange={(event) =>
                                setSelectedStatus(event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-auto"
                        >
                            <option value="all">Todas</option>
                            <option value="presente">Presentes</option>
                            <option value="falta">Faltas</option>
                            <option value="reposta">Repostas</option>
                            <option value="justificada">Justificadas</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
                    <Loader2 className="mr-2 inline-block animate-spin" size={16} />
                    A carregar presenças...
                </div>
            ) : null}

            {!loading && error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            ) : null}

            {!loading && !error && visibleAttendanceRows.length ? (
                <div className="space-y-3">
                    {visibleAttendanceRows.map((session) => (
                        <AttendanceRow key={session.id} session={session} />
                    ))}
                </div>
            ) : null}

            {!loading && !error && !visibleAttendanceRows.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
                    {selectedStatus === 'all'
                        ? `Sem registos de aulas em ${monthName}.`
                        : 'Sem resultados para o filtro selecionado.'}
                </div>
            ) : null}
        </section>
    );
}
