import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    FileText,
    RefreshCw,
    Search,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { apiGet } from '../../utils/api';

const MIN_ATTENDANCE_COLUMNS = 8;
const MONTH_NAMES = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
];

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(monthValue, delta) {
    const [year, month] = String(monthValue || getCurrentMonth())
        .split('-')
        .map(Number);
    const date = new Date(year, (month || 1) - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatHours(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatHoursLabel(value) {
    const number = Number(value || 0);
    if (number === 0) return '';
    return `${formatHours(number)}h`;
}

function formatDifference(value) {
    const number = Number(value || 0);
    if (Math.abs(number) < 0.01) return '-';
    return `${number > 0 ? '+' : ''}${formatHours(number)}h`;
}

function formatDayMonth(value) {
    if (!value) return '';
    const [, month, day] = String(value).split('-');
    return `${Number(day)}/${Number(month)}`;
}

function formatAno(value) {
    const raw = String(value || '').trim();
    return raw ? `${raw}º` : '';
}

function formatMonthTitle(monthValue) {
    const [year, month] = String(monthValue || getCurrentMonth())
        .split('-')
        .map(Number);
    const monthName = MONTH_NAMES[month - 1] || '';
    return `${monthName} ${year}`;
}

function buildAttendanceColumns(rows) {
    const maxPresencas = rows.reduce(
        (max, aluno) => Math.max(max, aluno.presencas?.length || 0),
        0
    );
    return Math.max(MIN_ATTENDANCE_COLUMNS, maxPresencas);
}

function PresencasTable({ rows, attendanceColumnCount, title }) {
    const totalColumns = attendanceColumnCount + 5;

    return (
        <div className="overflow-x-auto print:overflow-visible">
            <div className="min-w-max print:min-w-0 print:w-full">
                <table className="w-full border-collapse text-sm text-slate-900">
                    <thead>
                        <tr>
                            <th
                                colSpan={totalColumns}
                                className="border border-slate-900 bg-slate-50 py-3 text-center text-sm font-semibold text-slate-900"
                            >
                                {title || formatMonthTitle(rows?.[0]?.month)}
                            </th>
                        </tr>
                        <tr>
                            <th className="w-14 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                ANO
                            </th>
                            <th className="w-44 border border-slate-900 bg-slate-100 px-2 py-2 text-left font-semibold">
                                NOME
                            </th>
                            <th className="w-16 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                HORAS
                            </th>
                            {Array.from({ length: attendanceColumnCount }).map(
                                (_, index) => (
                                    <th
                                        key={`slot-head-${index}`}
                                        className="h-9 w-20 border border-slate-900 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-700"
                                    />
                                )
                            )}
                            <th className="w-24 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                TOTAL
                            </th>
                            <th className="w-28 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                DIFERENÇA
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((aluno) => (
                            <tr key={aluno.id_aluno}>
                                <td className="border border-slate-900 bg-slate-100 px-2 py-3 text-center font-semibold">
                                    {formatAno(aluno.ano)}
                                </td>
                                <td className="border border-slate-900 bg-slate-100 px-3 py-3 font-medium">
                                    {aluno.nome}
                                </td>
                                <td className="border border-slate-900 bg-slate-100 px-2 py-3 text-center font-semibold">
                                    {formatHoursLabel(aluno.horas_subscritas)}
                                </td>
                                {Array.from({
                                    length: attendanceColumnCount,
                                }).map((_, index) => {
                                    const presenca = aluno.presencas?.[index];
                                    return (
                                        <td
                                            key={`${aluno.id_aluno}-${index}`}
                                            className="h-10 border border-slate-900 bg-white px-1 py-1 text-center align-middle"
                                        >
                                            {presenca ? (
                                                <div className="mx-auto text-center leading-tight">
                                                    <div className="text-xs font-semibold text-slate-800">
                                                        {formatDayMonth(presenca.data)}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatHoursLabel(presenca.horas)}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </td>
                                    );
                                })}
                                <td className="border border-slate-900 bg-white px-2 py-3 text-center text-base font-semibold">
                                    {formatHoursLabel(aluno.total_horas_feitas)}
                                </td>
                                <td className="border border-slate-900 bg-white px-2 py-3 text-center text-base font-semibold">
                                    {formatDifference(aluno.diferenca)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function PresencasGestorPage() {
    const [month, setMonth] = useState(getCurrentMonth());
    const [search, setSearch] = useState('');
    const [refreshTick, setRefreshTick] = useState(0);
    const [report, setReport] = useState({
        alunos: [],
        month: getCurrentMonth(),
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function loadReport() {
            try {
                setLoading(true);
                setError('');

                const response = await apiGet(
                    `/api/gestor/presencas?month=${encodeURIComponent(month)}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Erro ao carregar presenças.'
                    );
                }

                if (cancelled) return;

                setReport({
                    alunos: Array.isArray(data?.alunos) ? data.alunos : [],
                    month: data?.month || month,
                    startDate: data?.startDate,
                    endDate: data?.endDate,
                });
            } catch (err) {
                if (!cancelled) {
                    setError(err?.message || 'Erro ao carregar presenças.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadReport();

        return () => {
            cancelled = true;
        };
    }, [month, refreshTick]);

    const filteredRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        const withPresences = report.alunos.filter(
            (aluno) => aluno.presencas?.length > 0
        );
        if (!term) return withPresences;

        return withPresences.filter((aluno) =>
            `${aluno?.ano || ''} ${aluno?.nome || ''}`
                .toLowerCase()
                .includes(term)
        );
    }, [report.alunos, search]);

    const attendanceColumnCount = useMemo(
        () => buildAttendanceColumns(filteredRows),
        [filteredRows]
    );

    const hasRows = filteredRows.length > 0;
    const tableTitle = formatMonthTitle(report.month || month);

    return (
        <section className="space-y-5">
            <style>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 10mm;
                    }

                    body * {
                        visibility: hidden;
                    }

                    #presencas-print-area,
                    #presencas-print-area * {
                        visibility: visible;
                    }

                    #presencas-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `}</style>
            <div className="print:hidden">
                <AdminPageHeader
                    eyebrow="Presenças"
                    title="Mapa mensal"
                    subtitle="A tabela abaixo é a vista do PDF. Podes filtrar e depois imprimir/guardar."
                    icon={CalendarDays}
                    actions={
                        <>
                            <button
                                type="button"
                                onClick={() =>
                                    setRefreshTick((value) => value + 1)
                                }
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw
                                    size={16}
                                    className={loading ? 'animate-spin' : ''}
                                />
                                Atualizar
                            </button>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                disabled={!hasRows}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FileText size={16} />
                                Imprimir / guardar PDF
                            </button>
                        </>
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 print:hidden">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="text-xs font-medium text-slate-500">
                        Mês
                    </label>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                        {tableTitle}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setMonth((value) => shiftMonth(value, -1))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Mes anterior
                        </button>
                        <button
                            type="button"
                            onClick={() => setMonth(getCurrentMonth())}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Mes atual
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setMonth((value) => shiftMonth(value, 1))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Proximo mes
                        </button>
                    </div>
                    <input
                        type="month"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                        Usa os botoes para navegar rapido ou escolhe diretamente
                        no calendario.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                    <label className="text-xs font-medium text-slate-500">
                        Pesquisar
                    </label>
                    <div className="relative mt-1">
                        <Search
                            size={16}
                            className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Ano ou nome do aluno"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 print:hidden">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <div
                id="presencas-print-area"
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
                {loading ? (
                    <p className="p-6 text-sm text-slate-500 print:hidden">
                        A carregar presenças...
                    </p>
                ) : !hasRows ? (
                    <p className="p-6 text-sm text-slate-500 print:hidden">
                        Sem presenças para o mês selecionado.
                    </p>
                ) : (
                    <PresencasTable
                        rows={filteredRows}
                        attendanceColumnCount={attendanceColumnCount}
                        title={tableTitle}
                    />
                )}
            </div>
        </section>
    );
}
