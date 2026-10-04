import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Calendar, Filter, Grid3x3, RefreshCw, X } from 'lucide-react';
import AdminPageHeader from '../layout/AdminPageHeader';
import { apiGet } from '../../utils/api.js';
import CalendarSyncButton from './CalendarSyncButton';
import AgendaWeekView from './AgendaWeekView';
import AgendaMonthView from './AgendaMonthView';
import AgendaActivityModal from './AgendaActivityModal';
import {
    extrairProfessoresUnicos,
    filtrarAtividades,
    formatDateKey,
    formatMonthPickerValue,
    startFromSunday,
} from './agendaUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Agenda partilhada por todos os papéis.
 * - modo "equipa" (gestor, professor): cores por professor, filtro de
 *   professor e lista de alunos no detalhe;
 * - modo "aluno" (aluno, encarregado): cores por tipo e aulas repostas.
 * Os dados vêm de agendaPath, que o backend já filtra pelo utilizador.
 */
export default function AgendaCalendar({
    modo = 'equipa',
    agendaPath = '/api/public/agenda',
    eyebrow,
    title,
    subtitle,
    headerActions = null,
    showCalendarSync = true,
}) {
    const equipa = modo === 'equipa';
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [atividadesPorDia, setAtividadesPorDia] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('week'); // 'month' or 'week'
    const [selectedAtividade, setSelectedAtividade] = useState(null);
    const [filterProfessor, setFilterProfessor] = useState('');
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

    // Extrair lista de professores únicos
    const professoresDisponiveis = useMemo(
        () => extrairProfessoresUnicos(atividadesPorDia),
        [atividadesPorDia]
    );

    // Filtrar atividades por dia com base nos filtros
    const atividadesPorDiaFiltradas = useMemo(() => {
        const resultado = {};
        Object.keys(atividadesPorDia).forEach((dia) => {
            const filtradas = filtrarAtividades(
                atividadesPorDia[dia],
                filterProfessor,
                filterTipo
            );
            resultado[dia] = filtradas;
        });
        return resultado;
    }, [atividadesPorDia, filterProfessor, filterTipo]);

    const atividadesFiltradas = atividadesPorDiaFiltradas[selectedKey] || [];
    const totalAtividades = useMemo(
        () =>
            Object.values(atividadesPorDiaFiltradas).reduce(
                (total, atividades) => total + atividades.length,
                0
            ),
        [atividadesPorDiaFiltradas]
    );
    const hasActiveFilters = Boolean(filterProfessor || filterTipo);

    function clearFilters() {
        setFilterTipo('');
        setFilterProfessor('');
    }

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
                    `${API_URL}${agendaPath}?from=${from}&to=${to}`
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
    }, [weekStart, weekEnd, viewMode, calendarDays, reloadToken, agendaPath]);

    // função para navegar para o mês anterior ou próximo, ajustando também a data selecionada para o primeiro dia do mês
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

    // função para navegar para o mês anterior ou próximo, ajustando também a data selecionada para o primeiro dia do mês
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

    // função para navegar para a semana anterior ou próxima, ajustando a data selecionada para o domingo da nova semana
    function goToPreviousWeek() {
        setSelectedDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() - 7);
            return newDate;
        });
    }

    // função para navegar para a semana anterior ou próxima, ajustando a data selecionada para o domingo da nova semana
    function goToNextWeek() {
        setSelectedDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + 7);
            return newDate;
        });
    }

    // função para navegar diretamente para um mês específico, ajustando a data selecionada para o primeiro dia desse mês
    function goToMonth(year, monthIndex) {
        const nextMonth = new Date(year, monthIndex, 1);
        setCurrentMonth(nextMonth);
        setSelectedDate(new Date(year, monthIndex, 1));
    }

    return (
        <section className="flex h-full flex-col space-y-5">
            <AdminPageHeader
                eyebrow={eyebrow}
                title={title}
                subtitle={subtitle}
                icon={CalendarDays}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        {headerActions}
                        {showCalendarSync && <CalendarSyncButton />}
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
                    </div>
                }
            />

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

                <div
                    className={`mt-4 grid grid-cols-1 gap-3 ${
                        equipa ? 'md:grid-cols-3' : 'md:grid-cols-2'
                    }`}
                >
                    <select
                        value={filterTipo}
                        onChange={(e) => setFilterTipo(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todos os tipos</option>
                        <option value="curricular">Curricular</option>
                        <option value="extra">Extra-curricular</option>
                    </select>

                    {equipa ? (
                        <select
                            value={filterProfessor}
                            onChange={(e) => setFilterProfessor(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Todos os professores</option>
                            {professoresDisponiveis.map((prof) => (
                                <option key={prof} value={prof}>
                                    {prof}
                                </option>
                            ))}
                        </select>
                    ) : null}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                            <X size={15} />
                            {equipa ? 'Limpar filtros' : 'Limpar filtro'}
                        </button>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1">
                {/* Week View */}
                {viewMode === 'week' && (
                    <AgendaWeekView
                        modo={modo}
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
                    <AgendaMonthView
                        modo={modo}
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
            </div>

            {/* Modal de Detalhes */}
            {selectedAtividade && (
                <AgendaActivityModal
                    atividade={selectedAtividade}
                    modo={modo}
                    onClose={() => setSelectedAtividade(null)}
                />
            )}
        </section>
    );
}
