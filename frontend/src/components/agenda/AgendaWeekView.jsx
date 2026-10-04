import { useEffect, useRef } from 'react';
import {
    AlertCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import {
    HOUR_LABELS,
    detectAtividadeColisoes,
    formatDateKey,
    getAgendaCardTitle,
    getCoresAtividade,
    getProfessorName,
    isAtividadeReposta,
    timeToMinutes,
    weekDayNamesLong,
} from './agendaUtils';

// Vista semanal: grelha de horas com as atividades posicionadas por hora.
export default function AgendaWeekView({
    modo,
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
            currentMinutes >= 480 &&
            currentMinutes <= 1260
        ) {
            // Calcular posição baseado na hora (80px per hour, começando em 8:00)
            const hourIndex = currentMinutes - 480; // minutos desde 8:00
            const scrollTop = (hourIndex / 60) * 80 - 200; // deixar 200px de margem do topo
            gridContainerRef.current.scrollTop = Math.max(0, scrollTop);
        }
    }, [isCurrentWeekToday, currentMinutes]);

    return (
        <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                    className="min-h-0 flex-1 overflow-auto"
                >
                    <div className="grid grid-cols-8 min-w-full">
                        {/* Time column */}
                        <div className="border-r border-slate-200 bg-slate-50">
                            <div className="sticky top-0 z-30 h-12 border-b border-slate-200 bg-slate-50" />
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
                                        isToday ? 'bg-emerald-50' : 'bg-white'
                                    }`}
                                >
                                    {/* Day header */}
                                    <div
                                        className={`sticky top-0 z-30 h-12 border-b border-slate-200 p-2 text-center cursor-pointer transition ${
                                            isToday
                                                ? 'bg-emerald-500 text-white font-semibold'
                                                : 'bg-white hover:bg-slate-50'
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
                                            currentMinutes >= 480 &&
                                            currentMinutes <= 1260 && (
                                                <div
                                                    className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                                                    style={{
                                                        top: `${((currentMinutes - 480) / (14 * 60)) * 100}%`,
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

                                            const firstHourMinutes = 8 * 60;
                                            const lastHourMinutes = 21 * 60;

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
                                                    (14 * 60)) *
                                                100;
                                            const height =
                                                (((clampedEnd - clampedStart) /
                                                    60) *
                                                    100) /
                                                14;

                                            const cor = getCoresAtividade(
                                                atividade,
                                                modo
                                            );

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
                                                        className={`h-full rounded border-l-4 px-2 py-1 text-xs overflow-hidden flex flex-col transition hover:shadow-lg hover:z-20 ${cor.bg} ${cor.borderL} ${cor.text}`}
                                                    >
                                                        <p className="font-semibold truncate">
                                                            {isAtividadeReposta(
                                                                atividade
                                                            ) ? (
                                                                <span
                                                                    className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                                                                    title="Aula reposta"
                                                                >
                                                                    <span className="sr-only">
                                                                        Aula reposta:
                                                                    </span>
                                                                </span>
                                                            ) : null}
                                                            {getAgendaCardTitle(
                                                                atividade
                                                            )}
                                                        </p>
                                                        <p className="text-xs opacity-75 truncate">
                                                            {atividade.hora}
                                                            {atividade.horaFim
                                                                ? ` - ${atividade.horaFim}`
                                                                : ''}
                                                        </p>
                                                        {modo === 'equipa' ? (
                                                            <p className="text-xs opacity-80 truncate">
                                                                {getProfessorName(
                                                                    atividade
                                                                ) ||
                                                                    'Professor por definir'}
                                                            </p>
                                                        ) : null}
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
