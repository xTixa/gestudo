import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    MapPin,
    UserRound,
} from 'lucide-react';
import {
    formatDateKey,
    getAgendaCardTitle,
    getAtividadeCategoria,
    getCoresAtividade,
    isAtividadeReposta,
    monthNames,
    weekDayNames,
} from './agendaUtils';

// Cartão da lista do dia. Modo equipa: fundo e barra na cor do professor.
// Modo aluno: fundo branco. Em ambos, a letra C/E/R na cor da atividade.
function estiloCartaoDia(atividade, modo) {
    const cor = getCoresAtividade(atividade, modo);
    const reposta = isAtividadeReposta(atividade);
    const extra = getAtividadeCategoria(atividade) === 'extra';
    return {
        cartao:
            modo === 'equipa'
                ? `${cor.bg} border-l-4 ${cor.borderL}`
                : 'bg-white',
        badge: cor.badge,
        letra: reposta ? 'R' : extra ? 'E' : 'C',
        reposta,
    };
}

// Vista mensal: calendário do mês e lista das atividades do dia escolhido.
export default function AgendaMonthView({
    modo,
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
        <div className="grid h-full grid-cols-1 gap-5 overflow-y-auto xl:grid-cols-3 xl:overflow-hidden">
            <article className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:overflow-y-auto">
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
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-emerald-500"
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
                        const hasReposta =
                            atividadesDia.some(isAtividadeReposta);

                        return (
                            <button
                                key={dateKey}
                                type="button"
                                onClick={() => setSelectedDate(date)}
                                className={`relative rounded-xl h-[74px] p-2 text-sm border transition ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-500 text-white font-semibold'
                                        : isToday
                                          ? 'border-emerald-200 bg-emerald-50 text-slate-700'
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

            <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:min-h-0">
                <h3 className="text-2xl font-medium text-slate-700">
                    {selectedDate.toLocaleDateString('pt-PT', {
                        day: 'numeric',
                        month: 'long',
                    })}
                </h3>

                <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
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
                            const cor = estiloCartaoDia(atividade, modo);

                            return (
                                <article
                                    key={`${atividade.hora}-${index}`}
                                    className={`rounded-xl border border-slate-200 p-3 cursor-pointer transition hover:shadow-md hover:border-slate-300 ${cor.cartao}`}
                                    onClick={() =>
                                        setSelectedAtividade(atividade)
                                    }
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-slate-800">
                                            {getAgendaCardTitle(atividade)}
                                        </p>
                                        <span
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${cor.badge}`}
                                        >
                                            {cor.letra}
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
                                    {cor.reposta ? (
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
