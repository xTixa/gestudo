import { useEffect, useMemo, useState, useRef } from 'react';
import {
    AlertCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Filter,
    MapPin,
    RefreshCw,
    UserRound,
    X,
    Grid3x3,
    Calendar,
} from 'lucide-react';
import { apiGet } from '../../utils/api.js';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

const monthNames = [
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

const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const weekDayNamesLong = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
];
const HOUR_LABELS = Array.from({ length: 16 }, (_, i) => {
    const hour = i + 7;
    return `${String(hour).padStart(2, '0')}:00`;
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ACTIVITY_COLORS = {
    extra: {
        bg: 'bg-violet-100',
        border: 'border-violet-500',
        text: 'text-violet-900',
        badge: 'bg-violet-500',
    },
    curricular: {
        bg: 'bg-blue-100',
        border: 'border-blue-500',
        text: 'text-blue-900',
        badge: 'bg-[#7fbe84]',
    },
    reposta: {
        bg: 'bg-amber-100',
        border: 'border-amber-500',
        text: 'text-amber-900',
        badge: 'bg-amber-500',
    },
};

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startFromSunday(date) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = (timeStr || '').split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

function getAtividadeCategoria(atividade) {
    const categoria = String(
        atividade?.categoria || atividade?.tipo || atividade?.modalidade || ''
    ).toLowerCase();
    if (categoria.includes('extra')) {
        return 'extra';
    }
    return 'curricular';
}

function isAtividadeReposta(atividade) {
    return String(atividade?.estado || '').toLowerCase() === 'reposta';
}

function getAtividadeColors(atividade) {
    if (isAtividadeReposta(atividade)) {
        return ACTIVITY_COLORS.reposta;
    }

    return ACTIVITY_COLORS[getAtividadeCategoria(atividade)];
}

function detectAtividadeColisoes(atividades, targetAtividade) {
    const startMin = timeToMinutes(targetAtividade.hora);
    const endMin = targetAtividade.horaFim
        ? timeToMinutes(targetAtividade.horaFim)
        : startMin + 60;

    return atividades.filter((a) => {
        const aStart = timeToMinutes(a.hora);
        const aEnd = a.horaFim ? timeToMinutes(a.horaFim) : aStart + 60;
        return aStart < endMin && aEnd > startMin;
    });
}

function formatMonthPickerValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function AgendaPage() {
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [atividadesPorDia, setAtividadesPorDia] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('week'); // 'month' or 'week'
    const [selectedAtividade, setSelectedAtividade] = useState(null);
    const [filterTipo, setFilterTipo] = useState(''); // 'curricular', 'extra', ''
    const [reloadToken, setReloadToken] = useState(0);

    const todayKey = formatDateKey(new Date());
    const selectedMonthValue = formatMonthPickerValue(currentMonth);

    // For week view: get the week that contains selectedDate
    const weekStart = useMemo(
        () => startFromSunday(selectedDate),
        [selectedDate]
    );
    const weekEnd = useMemo(() => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        return end;
    }, [weekStart]);

    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            1
        );
        const firstCell = startFromSunday(firstDayOfMonth);
        const days = [];

        for (let i = 0; i < 42; i += 1) {
            const date = new Date(firstCell);
            date.setDate(firstCell.getDate() + i);
            days.push(date);
        }

        return days;
    }, [currentMonth]);

    const selectedKey = formatDateKey(selectedDate);

    const atividadesPorDiaFiltradas = useMemo(() => {
        const resultado = {};
        Object.keys(atividadesPorDia).forEach((dia) => {
            const filtradas = atividadesPorDia[dia].filter((a) => {
                const tipo = getAtividadeCategoria(a);
                if (filterTipo && tipo !== filterTipo) return false;
                return true;
            });
            resultado[dia] = filtradas;
        });
        return resultado;
    }, [atividadesPorDia, filterTipo]);

    const atividadesFiltradas = atividadesPorDiaFiltradas[selectedKey] || [];
    const totalAtividades = useMemo(
        () =>
            Object.values(atividadesPorDiaFiltradas).reduce(
                (total, atividades) => total + atividades.length,
                0
            ),
        [atividadesPorDiaFiltradas]
    );
    const hasActiveFilters = Boolean(filterTipo);

    useEffect(() => {
        let isMounted = true;

        async function carregarAgenda() {
            setLoading(true);
            setError('');

            try {
                // Carregar dados para a semana visível na week view
                // OU para o mês inteiro na month view
                const from =
                    viewMode === 'week'
                        ? formatDateKey(weekStart)
                        : formatDateKey(calendarDays[0]);
                const to =
                    viewMode === 'week'
                        ? formatDateKey(weekEnd)
                        : formatDateKey(calendarDays[calendarDays.length - 1]);

                const response = await apiGet(
                    `${API_URL}/api/public/agenda?from=${from}&to=${to}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao carregar agenda.');
                }

                if (isMounted) {
                    setAtividadesPorDia(data?.atividadesPorDia || {});
                }
            } catch (fetchError) {
                if (isMounted) {
                    setAtividadesPorDia({});
                    setError(fetchError.message || 'Erro ao carregar agenda.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregarAgenda();

        return () => {
            isMounted = false;
        };
    }, [weekStart, weekEnd, viewMode, calendarDays, reloadToken]);

    function goToPreviousMonth() {
        setCurrentMonth((prev) => {
            const nextMonth = new Date(
                prev.getFullYear(),
                prev.getMonth() - 1,
                1
            );
            setSelectedDate(
                new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
            );
            return nextMonth;
        });
    }

    function goToNextMonth() {
        setCurrentMonth((prev) => {
            const nextMonth = new Date(
                prev.getFullYear(),
                prev.getMonth() + 1,
                1
            );
            setSelectedDate(
                new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
            );
            return nextMonth;
        });
    }

    function goToPreviousWeek() {
        setSelectedDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() - 7);
            return newDate;
        });
    }

    function goToNextWeek() {
        setSelectedDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + 7);
            return newDate;
        });
    }

    function goToMonth(year, monthIndex) {
        const nextMonth = new Date(year, monthIndex, 1);
        setCurrentMonth(nextMonth);
        setSelectedDate(new Date(year, monthIndex, 1));
    }

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Painel do Aluno"
                title="A minha agenda"
                subtitle="Visão geral das tuas atividades, sessões e eventos agendados."
                icon={CalendarDays}
                actions={
                    <button
                        type="button"
                        onClick={() => setReloadToken((prev) => prev + 1)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? 'animate-spin' : ''}
                        />
                        Atualizar
                    </button>
                }
            />

            {/* View Mode Selector */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                            <Filter size={17} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800">
                                Visualização e filtros
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                {totalAtividades === 1
                                    ? '1 serviço visível'
                                    : `${totalAtividades} serviços visíveis`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setViewMode('week')}
                        className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                            viewMode === 'week'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <Grid3x3 size={16} />
                        Semana
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('month')}
                        className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                            viewMode === 'month'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <Calendar size={16} />
                        Mês
                    </button>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select
                        value={filterTipo}
                        onChange={(e) => setFilterTipo(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todos os tipos</option>
                        <option value="curricular">Curricular</option>
                        <option value="extra">Extra-curricular</option>
                    </select>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => setFilterTipo('')}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                            <X size={15} />
                            Limpar filtro
                        </button>
                    )}
                </div>
            </div>

            {/* Week View */}
            {viewMode === 'week' && (
                <WeekView
                    weekStart={weekStart}
                    weekEnd={weekEnd}
                    atividadesPorDia={atividadesPorDiaFiltradas}
                    loading={loading}
                    error={error}
                    onPreviousWeek={goToPreviousWeek}
                    onNextWeek={goToNextWeek}
                    todayKey={todayKey}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    setSelectedAtividade={setSelectedAtividade}
                />
            )}

            {/* Month View */}
            {viewMode === 'month' && (
                <MonthView
                    currentMonth={currentMonth}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    atividadesPorDia={atividadesPorDiaFiltradas}
                    calendarDays={calendarDays}
                    todayKey={todayKey}
                    selectedMonthValue={selectedMonthValue}
                    loading={loading}
                    error={error}
                    atividades={atividadesFiltradas}
                    goToPreviousMonth={goToPreviousMonth}
                    goToNextMonth={goToNextMonth}
                    goToMonth={goToMonth}
                    setCurrentMonth={setCurrentMonth}
                    setSelectedAtividade={setSelectedAtividade}
                />
            )}

            {/* Modal de Detalhes */}
            {selectedAtividade && (
                <AtividadeModal
                    atividade={selectedAtividade}
                    onClose={() => setSelectedAtividade(null)}
                />
            )}
        </section>
    );
}

// Week View Component
function WeekView({
    weekStart,
    weekEnd,
    atividadesPorDia,
    loading,
    error,
    onPreviousWeek,
    onNextWeek,
    todayKey,
    setSelectedDate,
    setCurrentMonth,
    setSelectedAtividade,
}) {
    const gridContainerRef = useRef(null);

    const weekDays = [];
    for (let i = 0; i < 7; i += 1) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        weekDays.push(date);
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isCurrentWeekToday =
        todayKey ===
        formatDateKey(
            new Date(now.getFullYear(), now.getMonth(), now.getDate())
        );

    // Scroll automático para hora atual
    useEffect(() => {
        if (
            isCurrentWeekToday &&
            gridContainerRef.current &&
            currentMinutes >= 420 &&
            currentMinutes <= 1380
        ) {
            // Calcular posição baseado na hora (80px per hour, começando em 7:00)
            const hourIndex = currentMinutes - 420; // minutos desde 7:00
            const scrollTop = (hourIndex / 60) * 80 - 200; // deixar 200px de margem do topo
            gridContainerRef.current.scrollTop = Math.max(0, scrollTop);
        }
    }, [isCurrentWeekToday, currentMinutes]);

    return (
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="border-b border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CalendarDays size={20} className="text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-800">
                        Semana de{' '}
                        {weekStart.toLocaleDateString('pt-PT', {
                            day: 'numeric',
                            month: 'short',
                        })}{' '}
                        a{' '}
                        {weekEnd.toLocaleDateString('pt-PT', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            const today = new Date();
                            setCurrentMonth(
                                new Date(
                                    today.getFullYear(),
                                    today.getMonth(),
                                    1
                                )
                            );
                            setSelectedDate(today);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        Hoje
                    </button>
                    <button
                        type="button"
                        onClick={onPreviousWeek}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onNextWeek}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Time Grid */}
            {loading ? (
                <div className="p-8 text-center text-slate-500">
                    A carregar agenda...
                </div>
            ) : error ? (
                <div className="m-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            ) : (
                <div
                    ref={gridContainerRef}
                    className="overflow-auto"
                    style={{ maxHeight: 'calc(100vh - 300px)' }}
                >
                    <div className="grid grid-cols-8 min-w-full">
                        {/* Time column */}
                        <div className="border-r border-slate-200 bg-slate-50">
                            <div className="h-12 border-b border-slate-200" />
                            {HOUR_LABELS.map((hour) => (
                                <div
                                    key={hour}
                                    className="h-20 border-b border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 flex items-start justify-center"
                                >
                                    {hour}
                                </div>
                            ))}
                        </div>

                        {/* Day columns */}
                        {weekDays.map((date) => {
                            const dateKey = formatDateKey(date);
                            const isToday = dateKey === todayKey;
                            const dayAtividades =
                                atividadesPorDia[dateKey] || [];

                            return (
                                <div
                                    key={dateKey}
                                    className={`border-r border-slate-200 relative ${
                                        isToday ? 'bg-[#eef8ef]' : 'bg-white'
                                    }`}
                                >
                                    {/* Day header */}
                                    <div
                                        className={`h-12 border-b border-slate-200 p-2 text-center cursor-pointer transition ${
                                            isToday
                                                ? 'bg-[#84be88] text-white font-semibold'
                                                : 'hover:bg-slate-50'
                                        }`}
                                        onClick={() => setSelectedDate(date)}
                                    >
                                        <div className="text-xs font-medium">
                                            {weekDayNamesLong[date.getDay()]}
                                        </div>
                                        <div
                                            className={`text-lg font-bold ${
                                                isToday ? '' : 'text-slate-700'
                                            }`}
                                        >
                                            {date.getDate()}
                                        </div>
                                    </div>

                                    {/* Time slots */}
                                    {HOUR_LABELS.map((hour) => (
                                        <div
                                            key={`${dateKey}-${hour}`}
                                            className="h-20 border-b border-slate-100 relative"
                                        />
                                    ))}

                                    {/* Activities positioned absolutely */}
                                    <div className="absolute inset-0 top-12 pointer-events-none overflow-hidden">
                                        {/* Linha hora atual */}
                                        {isCurrentWeekToday &&
                                            formatDateKey(date) === todayKey &&
                                            currentMinutes >= 420 &&
                                            currentMinutes <= 1380 && (
                                                <div
                                                    className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                                                    style={{
                                                        top: `${((currentMinutes - 420) / (16 * 60)) * 100}%`,
                                                    }}
                                                >
                                                    <div className="absolute left-0 top-0 h-3 w-3 -translate-y-1.5 rounded-full bg-red-500" />
                                                </div>
                                            )}

                                        {dayAtividades.map((atividade, idx) => {
                                            const startMinutes = timeToMinutes(
                                                atividade.hora
                                            );
                                            const endMinutes = atividade.horaFim
                                                ? timeToMinutes(
                                                      atividade.horaFim
                                                  )
                                                : startMinutes + 60;

                                            const firstHourMinutes = 7 * 60;
                                            const lastHourMinutes = 23 * 60;

                                            const clampedStart = Math.max(
                                                startMinutes,
                                                firstHourMinutes
                                            );
                                            const clampedEnd = Math.min(
                                                endMinutes,
                                                lastHourMinutes
                                            );

                                            if (clampedStart >= clampedEnd) {
                                                return null;
                                            }

                                            // Detectar colisões
                                            const colisoes =
                                                detectAtividadeColisoes(
                                                    dayAtividades,
                                                    atividade
                                                );
                                            const colisaoIndex =
                                                colisoes.findIndex(
                                                    (a) =>
                                                        a.titulo ===
                                                            atividade.titulo &&
                                                        a.hora ===
                                                            atividade.hora
                                                );
                                            const totalColisoes =
                                                colisoes.length;

                                            const topOffset =
                                                ((clampedStart -
                                                    firstHourMinutes) /
                                                    (16 * 60)) *
                                                100;
                                            const height =
                                                (((clampedEnd - clampedStart) /
                                                    60) *
                                                    100) /
                                                16;

                                            const colors =
                                                getAtividadeColors(atividade);

                                            const widthPercent =
                                                100 / totalColisoes;
                                            const leftPercent =
                                                colisaoIndex * widthPercent;

                                            return (
                                                <div
                                                    key={`${dateKey}-${idx}`}
                                                    className="absolute pointer-events-auto cursor-pointer"
                                                    style={{
                                                        top: `${topOffset}%`,
                                                        height: `${height}%`,
                                                        minHeight: '34px',
                                                        left: `${leftPercent}%`,
                                                        width: `${widthPercent}%`,
                                                        paddingLeft: '2px',
                                                        paddingRight: '2px',
                                                    }}
                                                    onClick={() =>
                                                        setSelectedAtividade(
                                                            atividade
                                                        )
                                                    }
                                                >
                                                    <div
                                                        className={`h-full rounded px-2 py-1 text-xs overflow-hidden flex flex-col ${colors.bg} border-l-4 ${colors.border} ${colors.text} transition hover:shadow-lg hover:z-20`}
                                                    >
                                                        <p className="font-semibold truncate">
                                                            {atividade.titulo}
                                                        </p>
                                                        <p className="text-xs opacity-75 truncate">
                                                            {atividade.hora}
                                                            {atividade.horaFim
                                                                ? ` - ${atividade.horaFim}`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </article>
    );
}

// Month View Component (existing logic)
function MonthView({
    currentMonth,
    selectedDate,
    setSelectedDate,
    atividadesPorDia,
    calendarDays,
    todayKey,
    selectedMonthValue,
    loading,
    error,
    atividades,
    goToPreviousMonth,
    goToNextMonth,
    goToMonth,
    setCurrentMonth,
    setSelectedAtividade,
}) {
    const selectedKey = formatDateKey(selectedDate);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <article className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2 text-slate-700">
                        <CalendarDays size={16} />
                        <h2 className="text-xl font-medium">
                            {monthNames[currentMonth.getMonth()]}{' '}
                            {currentMonth.getFullYear()}
                        </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                setCurrentMonth(
                                    new Date(
                                        today.getFullYear(),
                                        today.getMonth(),
                                        1
                                    )
                                );
                                setSelectedDate(today);
                            }}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                        >
                            Hoje
                        </button>

                        <input
                            type="month"
                            value={selectedMonthValue}
                            onChange={(event) => {
                                const raw = String(event.target.value || '');
                                const [year, month] = raw
                                    .split('-')
                                    .map(Number);
                                if (
                                    Number.isInteger(year) &&
                                    Number.isInteger(month)
                                ) {
                                    goToMonth(year, month - 1);
                                }
                            }}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#7fbe84]"
                            aria-label="Escolher mês do histórico"
                        />

                        <button
                            type="button"
                            onClick={goToPreviousMonth}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                            aria-label="Mês anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={goToNextMonth}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                            aria-label="Mês seguinte"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-3">
                    {weekDayNames.map((dayName) => (
                        <div
                            key={dayName}
                            className="text-xs sm:text-sm font-medium text-slate-500 text-center py-2"
                        >
                            {dayName}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((date) => {
                        const isCurrentMonth =
                            date.getMonth() === currentMonth.getMonth();
                        const dateKey = formatDateKey(date);
                        const isSelected = dateKey === selectedKey;
                        const isToday = dateKey === todayKey;
                        const atividadesDia = atividadesPorDia[dateKey] || [];
                        const hasAtividades = Boolean(atividadesDia.length);
                        const hasCurricular = atividadesDia.some(
                            (atividade) =>
                                getAtividadeCategoria(atividade) ===
                                'curricular'
                        );
                        const hasExtra = atividadesDia.some(
                            (atividade) =>
                                getAtividadeCategoria(atividade) === 'extra'
                        );
                        const hasReposta = atividadesDia.some(
                            isAtividadeReposta
                        );

                        return (
                            <button
                                key={dateKey}
                                type="button"
                                onClick={() => setSelectedDate(date)}
                                className={`relative rounded-xl h-[74px] p-2 text-sm border transition ${
                                    isSelected
                                        ? 'border-[#79b57d] bg-[#84be88] text-white font-semibold'
                                        : isToday
                                          ? 'border-[#a4cfa8] bg-[#eef8ef] text-slate-700'
                                          : 'border-slate-200 hover:bg-slate-50'
                                } ${!isCurrentMonth ? 'text-slate-400 bg-slate-50/40' : 'text-slate-700'}`}
                            >
                                <span className="flex h-full items-center justify-center">
                                    {date.getDate()}
                                </span>
                                {hasAtividades ? (
                                    <span className="absolute left-2.5 bottom-2 flex items-center gap-1">
                                        {hasCurricular ? (
                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                        ) : null}
                                        {hasExtra ? (
                                            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                        ) : null}
                                        {hasReposta ? (
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        ) : null}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <span>Curricular</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                        <span>Extra-Curricular</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <span>Reposta</span>
                    </div>
                </div>
            </article>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="text-2xl font-medium text-slate-700">
                    {selectedDate.toLocaleDateString('pt-PT', {
                        day: 'numeric',
                        month: 'long',
                    })}
                </h3>

                <div className="mt-4 space-y-3">
                    {loading ? (
                        <p className="text-sm text-slate-500">
                            A carregar agenda...
                        </p>
                    ) : error ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                            {error}
                        </p>
                    ) : atividades.length ? (
                        atividades.map((atividade, index) => {
                            const categoria = getAtividadeCategoria(atividade);
                            const isReposta = isAtividadeReposta(atividade);
                            const badgeLabel =
                                isReposta
                                    ? 'R'
                                    : categoria === 'extra'
                                      ? 'E'
                                      : 'C';
                            const badgeColor = isReposta
                                ? 'bg-amber-500'
                                : categoria === 'extra'
                                  ? 'bg-violet-500'
                                  : 'bg-[#7fbe84]';

                            return (
                                <article
                                    key={`${atividade.hora}-${index}`}
                                    className="rounded-xl border border-slate-200 bg-white p-3 cursor-pointer transition hover:shadow-md hover:border-slate-300"
                                    onClick={() =>
                                        setSelectedAtividade(atividade)
                                    }
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-slate-800">
                                            {atividade.titulo}
                                        </p>
                                        <span
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${badgeColor}`}
                                        >
                                            {badgeLabel}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                        <Clock3 size={14} />
                                        <span>
                                            {atividade.hora}
                                            {atividade.horaFim
                                                ? ` - ${atividade.horaFim}`
                                                : ''}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                        <UserRound size={14} />
                                        <span>
                                            {atividade.professor ||
                                                atividade.responsavel ||
                                                'Professor por definir'}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                        <MapPin size={14} />
                                        <span>{atividade.local}</span>
                                    </div>
                                    {isReposta ? (
                                        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                            Aula reposta
                                            {atividade.dataReposicao
                                                ? ` em ${atividade.dataReposicao}`
                                                : ''}
                                        </p>
                                    ) : null}
                                </article>
                            );
                        })
                    ) : (
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            Sem atividades/serviços para este dia.
                        </p>
                    )}
                </div>
            </aside>
        </div>
    );
}

// Modal de Detalhes da Atividade
function AtividadeModal({ atividade, onClose }) {
    const categoria = getAtividadeCategoria(atividade);
    const isReposta = isAtividadeReposta(atividade);
    const colors = getAtividadeColors(atividade);
    const badgeLabel = isReposta
        ? 'Reposta'
        : categoria === 'extra'
          ? 'Extra-Curricular'
          : 'Curricular';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-sm transition"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <article className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {/* Header com cor */}
                    <div
                        className={`px-6 py-4 ${colors.bg} border-b-2 ${colors.border}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2
                                    className={`text-2xl font-bold ${colors.text}`}
                                >
                                    {atividade.titulo}
                                </h2>
                                <span
                                    className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white ${colors.badge}`}
                                >
                                    {badgeLabel}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/70 text-slate-600 transition hover:bg-white"
                                aria-label="Fechar modal"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="px-6 py-4 space-y-4">
                        {/* Hora */}
                        <div className="flex items-center gap-3">
                            <Clock3 size={18} className="text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">
                                    Horário
                                </p>
                                <p className="text-base font-semibold text-slate-800">
                                    {atividade.hora}
                                    {atividade.horaFim
                                        ? ` - ${atividade.horaFim}`
                                        : ''}
                                </p>
                            </div>
                        </div>

                        {/* Professor */}
                        {(atividade.professor || atividade.responsavel) && (
                            <div className="flex items-center gap-3">
                                <UserRound
                                    size={18}
                                    className="text-slate-500"
                                />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                        Professor/Responsável
                                    </p>
                                    <p className="text-base font-semibold text-slate-800">
                                        {atividade.professor ||
                                            atividade.responsavel}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Local */}
                        {atividade.local && (
                            <div className="flex items-center gap-3">
                                <MapPin size={18} className="text-slate-500" />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                        Local
                                    </p>
                                    <p className="text-base font-semibold text-slate-800">
                                        {atividade.local}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Descrição */}
                        {isReposta && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                                Aula marcada como reposta
                                {atividade.dataReposicao
                                    ? ` em ${atividade.dataReposicao}`
                                    : ''}
                            </div>
                        )}

                        {atividade.descricao && (
                            <div className="pt-2 border-t border-slate-200">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                                    Descrição
                                </p>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {atividade.descricao}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition"
                        >
                            Fechar
                        </button>
                    </div>
                </article>
            </div>
        </>
    );
}
