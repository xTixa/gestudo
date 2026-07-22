import { createElement, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    BookOpen,
    CalendarDays,
    Clock3,
    GraduationCap,
    MapPin,
    Search,
    UserRound,
    X,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

function getRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}

function timeToMinutes(value) {
    const [hours, minutes] = String(value || '')
        .split(':')
        .map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null;
    }

    return hours * 60 + minutes;
}

function formatDuration(start, end) {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
        return 'Por definir';
    }

    const total = endMinutes - startMinutes;
    const hours = Math.floor(total / 60);
    const minutes = total % 60;

    if (!hours) return `${minutes} min`;
    return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function getCategoria(item) {
    const raw = String(
        item?.categoria || item?.tipo || item?.modalidade || item?.titulo || ''
    ).toLowerCase();

    return raw.includes('extra') ? 'extra' : 'curricular';
}

function getCategoriaLabel(categoria) {
    return categoria === 'extra' ? 'Extra-curricular' : 'Curricular';
}

function formatDateLabel(value) {
    const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return 'Data por definir';
    }

    return date.toLocaleDateString('pt-PT', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
    });
}

function formatWeekDayLabel(value) {
    const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return 'Dia por definir';
    }

    const label = date.toLocaleDateString('pt-PT', { weekday: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildServiceGroups(atividadesPorDia) {
    const services = new Map();

    Object.entries(atividadesPorDia || {}).forEach(([date, atividades]) => {
        (atividades || []).forEach((atividade) => {
            const title = atividade.titulo || 'Serviço';
            const key = String(
                atividade.id ||
                    atividade.id_servico ||
                    `${title}-${atividade.professor || ''}-${atividade.local || ''}`
            );

            if (!services.has(key)) {
                services.set(key, {
                    id: key,
                    titulo: title,
                    categoria: getCategoria(atividade),
                    professor:
                        atividade.professor ||
                        atividade.responsavel ||
                        'Professor por definir',
                    local: atividade.local || 'Sala por definir',
                    occurrences: [],
                });
            }

            services.get(key).occurrences.push({
                data: date,
                hora: atividade.hora || '--:--',
                horaFim: atividade.horaFim || '',
                local: atividade.local || 'Sala por definir',
                professor:
                    atividade.professor ||
                    atividade.responsavel ||
                    'Professor por definir',
            });
        });
    });

    return Array.from(services.values()).map((service) => {
        const occurrences = [...service.occurrences].sort((a, b) =>
            `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)
        );
        const nextOccurrence = occurrences[0] || null;
        const weeklySlots = new Map();

        occurrences.forEach((occurrence) => {
            weeklySlots.set(
                `${formatWeekDayLabel(occurrence.data)}-${occurrence.hora}`,
                {
                    day: formatWeekDayLabel(occurrence.data),
                    hour: occurrence.hora,
                }
            );
        });

        return {
            ...service,
            occurrences,
            nextOccurrence,
            sessionsCount: occurrences.length,
            sessionsPerWeek: weeklySlots.size,
            weeklySlots: Array.from(weeklySlots.values()).slice(0, 4),
            duration: nextOccurrence
                ? formatDuration(nextOccurrence.hora, nextOccurrence.horaFim)
                : 'Por definir',
        };
    });
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

function ServiceCard({ service }) {
    const badgeClasses =
        service.categoria === 'extra'
            ? 'bg-[#f3e8ff] text-[#a855f7]'
            : 'bg-emerald-50 text-emerald-700';

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9b7ea] text-white shadow-sm">
                    <BookOpen size={16} />
                </span>
                <span
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${badgeClasses}`}
                >
                    {getCategoriaLabel(service.categoria)}
                </span>
            </div>

            <div className="mt-3">
                <h2 className="line-clamp-2 text-xl font-semibold leading-tight text-slate-700">
                    {service.titulo}
                </h2>
                <div className="mt-2 grid gap-1.5 text-sm text-slate-500">
                    <p className="flex items-center gap-2">
                        <UserRound size={14} className="shrink-0 text-slate-400" />
                        <span className="truncate">{service.professor}</span>
                    </p>
                    <p className="flex items-center gap-2">
                        <MapPin size={14} className="shrink-0 text-slate-400" />
                        <span className="truncate">{service.local}</span>
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
                <SummaryCard
                    icon={CalendarDays}
                    value={service.sessionsCount}
                    label="Sessões"
                />
                <SummaryCard
                    icon={Clock3}
                    value={service.duration}
                    label="Duração"
                />
                <SummaryCard
                    icon={GraduationCap}
                    value={service.sessionsPerWeek}
                    label="Dias/sem."
                />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Próxima sessão
                </p>
                {service.nextOccurrence ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                        <CalendarDays size={14} className="text-slate-400" />
                        <span>{formatDateLabel(service.nextOccurrence.data)}</span>
                        <span className="text-slate-300">·</span>
                        <span>{service.nextOccurrence.hora}</span>
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-slate-500">
                        Ainda sem sessão marcada.
                    </p>
                )}
            </div>

            {service.weeklySlots.length ? (
                <div className="mt-3">
                    <h3 className="text-sm font-medium text-slate-500">
                        Horário habitual
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {service.weeklySlots.map((slot) => (
                            <span
                                key={`${service.id}-${slot.day}-${slot.hour}`}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500"
                            >
                                {slot.day} · {slot.hour}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
        </article>
    );
}

export default function ServicosAlunoPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadServicos() {
            setLoading(true);
            setError('');

            try {
                const { from, to } = getRange();
                const response = await apiGet(
                    `/api/public/agenda?from=${from}&to=${to}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.message || 'Erro ao carregar serviços.');
                }

                if (isMounted) {
                    setRows(buildServiceGroups(data?.atividadesPorDia || {}));
                }
            } catch (requestError) {
                if (isMounted) {
                    setRows([]);
                    setError(requestError?.message || 'Erro ao carregar serviços.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadServicos();

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredServices = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return rows.filter((service) => {
            if (filterTipo && service.categoria !== filterTipo) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return [
                service.titulo,
                service.professor,
                service.local,
                getCategoriaLabel(service.categoria),
            ]
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [rows, searchTerm, filterTipo]);

    const hasActiveFilters = Boolean(searchTerm.trim() || filterTipo);

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Serviços do aluno"
                title="Os Meus Serviços"
                subtitle="Consulta os serviços associados à tua conta e acompanha as próximas sessões."
                icon={BookOpen}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="relative block min-w-0 sm:w-72">
                            <Search
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) =>
                                    setSearchTerm(event.target.value)
                                }
                                placeholder="Pesquisar serviço"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <select
                            value={filterTipo}
                            onChange={(event) =>
                                setFilterTipo(event.target.value)
                            }
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Todos os tipos</option>
                            <option value="curricular">Curricular</option>
                            <option value="extra">Extra-curricular</option>
                        </select>

                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterTipo('');
                                }}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                                <X size={15} />
                                Limpar
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
                    A carregar serviços...
                </div>
            ) : null}

            {!loading && error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            ) : null}

            {!loading && !error && filteredServices.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredServices.map((service) => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            ) : null}

            {!loading && !error && !filteredServices.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
                    {hasActiveFilters
                        ? 'Não encontrámos serviços com estes filtros.'
                        : 'Sem serviços associados à tua conta neste período.'}
                </div>
            ) : null}
        </section>
    );
}
