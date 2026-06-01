import { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    Clock3,
    MapPin,
    PencilLine,
    Send,
    UserRound,
    X,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
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

    const ptMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ptMatch) {
        const [, day, month, year] = ptMatch;
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

function formatDateLabel(dateIso) {
    const date = parseDateOrNull(dateIso);
    if (!date) {
        return 'Data por definir';
    }

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function formatShortDate(dateIso) {
    const date = parseDateOrNull(dateIso);
    if (!date) {
        return 'Data por definir';
    }

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatTimeLabel(value) {
    const raw = String(value || '').trim();
    return raw ? raw.slice(0, 5) : '--:--';
}

function getServiceTitle(service) {
    return String(service?.titulo || 'Disciplina').trim();
}

function getYearLabel(service) {
    const alunoAno = String(service?.alunos?.[0]?.ano || '').trim();
    if (alunoAno) {
        return alunoAno.includes('Ano') ? alunoAno : `${alunoAno}º Ano`;
    }

    const nivel = String(service?.ano || '').trim();
    return nivel || 'Ano não definido';
}

function getServiceStartDate(service) {
    return (
        service?.dataInicio ||
        service?.data_inicio ||
        service?.nextSessionDate ||
        null
    );
}

function getServiceEndDate(service) {
    return service?.dataFim || service?.data_fim || null;
}

function getServiceDays(service) {
    return service?.diasSemana || service?.dias_semana || [];
}

function getServiceSubtitle(service) {
    const firstStudent = service?.alunos?.[0];
    return String(firstStudent?.nome || 'Aluno associado').trim();
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

    const allowedDays = parseDiasSemana(getServiceDays(service));
    if (!allowedDays.length) {
        return true;
    }

    return allowedDays.includes(getDayKey(target));
}

function getNextOccurrence(service, fromDate) {
    const start = parseDateOrNull(getServiceStartDate(service));
    const end = parseDateOrNull(getServiceEndDate(service)) || start;
    if (!start || !end) {
        return null;
    }

    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);

    const limit = new Date(end);
    limit.setHours(0, 0, 0, 0);

    if (cursor < start) {
        cursor.setTime(start.getTime());
    }

    while (cursor <= limit) {
        if (isServiceActiveOnDate(service, cursor)) {
            return new Date(cursor);
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return null;
}

function getFutureSessions(services) {
    const cutoff = new Date(Date.now() + 60 * 60000);
    cutoff.setSeconds(0, 0);

    return services
        .map((service) => {
            const fromBackend = parseDateOrNull(service?.nextSessionDate);
            const startDate = parseDateOrNull(getServiceStartDate(service));
            const nextDate =
                fromBackend ||
                getNextOccurrence(service, cutoff) ||
                (startDate && startDate.getTime() >= cutoff.getTime()
                    ? startDate
                    : null);

            const startHour = formatTimeLabel(service.horaInicio);
            const [hours, minutes] = startHour.split(':').map(Number);

            let sessionStart = null;
            let canRequest = false;
            if (nextDate) {
                sessionStart = new Date(nextDate);
                if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
                    sessionStart.setHours(hours, minutes, 0, 0);
                }

                canRequest = sessionStart.getTime() >= cutoff.getTime();
            }

            return {
                id: service.id,
                service,
                canRequest,
                dateKey: nextDate ? formatDateKey(nextDate) : '',
                dateLabel: nextDate
                    ? formatDateLabel(nextDate)
                    : 'Sem sessão elegível',
                hour: formatTimeLabel(service.horaInicio),
                hourEnd: formatTimeLabel(service.horaFim),
                title: getServiceTitle(service),
                student: getServiceSubtitle(service),
                room: String(service.sala || 'Sem sala').trim() || 'Sem sala',
                yearLabel: getYearLabel(service),
                sessionStart,
            };
        })
        .sort(
            (a, b) =>
                a.dateKey.localeCompare(b.dateKey) ||
                a.hour.localeCompare(b.hour)
        );
}

function SessionCard({ session, onRequest }) {
    return (
        <article className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-700">
                {session.title} - {session.yearLabel}
            </h3>

            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <UserRound size={14} />
                {session.student}
            </p>

            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                    <CalendarDays size={14} />
                    {session.dateLabel}
                </span>
                <span className="inline-flex items-center gap-1">
                    <Clock3 size={14} />
                    {session.hour} - {session.hourEnd}
                </span>
                <span className="inline-flex items-center gap-1">
                    <MapPin size={14} />
                    {session.room}
                </span>
            </p>

            {!session.canRequest ? (
                <p className="mt-2 text-xs text-amber-600">
                    Sem sessão elegível para reagendamento neste momento.
                </p>
            ) : null}

            <button
                type="button"
                onClick={() => onRequest(session)}
                disabled={!session.canRequest}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#abd6e6] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-95"
            >
                <Send size={14} />
                {session.canRequest ? 'Pedir Reagendamento' : 'Indisponível'}
            </button>
        </article>
    );
}

function RequestCard({ request }) {
    return (
        <article className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-700">
                    {request.title}
                </h3>
                <span className="rounded-full border border-[#d9b9ff] bg-[#f6ecff] px-2 py-0.5 text-[11px] font-medium text-[#b26cff]">
                    {request.status}
                </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">{request.yearLabel}</p>

            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <UserRound size={14} />
                {request.student}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Sessão Original
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <CalendarDays size={14} />
                        {request.originalDate}
                        <Clock3 size={14} />
                        {request.originalTime}
                    </p>
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Nova Data Sugerida
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                        <CalendarDays size={14} />
                        {request.newDate}
                        <Clock3 size={14} />
                        {request.newTime}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin size={13} />
                        {request.newRoom}
                    </p>
                </div>
            </div>

            <div className="mt-3 rounded-xl bg-[#eef7f8] px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Motivo
                </p>
                <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
            </div>
        </article>
    );
}

function RequestModal({ open, session, onClose, onSubmit }) {
    const [newDate, setNewDate] = useState(session?.dateKey || '');
    const [newTime, setNewTime] = useState(session?.hour || '');
    const [newRoom, setNewRoom] = useState(session?.room || '');
    const [reason, setReason] = useState('');

    if (!open || !session) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60"
                aria-label="Fechar modal"
            />

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit({ newDate, newTime, newRoom, reason });
                }}
                className="relative z-10 w-full max-w-2xl rounded-[18px] border border-slate-200 bg-white p-5 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-700">
                            Solicitar Reagendamento
                        </h2>
                        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-base font-semibold text-slate-700">
                                {session.title} - {session.yearLabel}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                    <CalendarDays size={14} />
                                    {formatShortDate(session.dateKey)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Clock3 size={14} />
                                    {session.hour} - {session.hourEnd}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <MapPin size={14} />
                                    {session.room}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                        aria-label="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <label className="block space-y-1.5 text-sm text-slate-600">
                        <span className="font-medium text-slate-700">
                            Nova Data Pretendida
                        </span>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(event) => setNewDate(event.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="block space-y-1.5 text-sm text-slate-600 sm:col-span-1">
                            <span className="font-medium text-slate-700">
                                Horário Disponível
                            </span>
                            <input
                                type="time"
                                value={newTime}
                                onChange={(event) =>
                                    setNewTime(event.target.value)
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                            />
                        </label>

                        <label className="block space-y-1.5 text-sm text-slate-600 sm:col-span-2">
                            <span className="font-medium text-slate-700">
                                Sala Disponível
                            </span>
                            <input
                                type="text"
                                value={newRoom}
                                onChange={(event) =>
                                    setNewRoom(event.target.value)
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                            />
                        </label>
                    </div>

                    <label className="block space-y-1.5 text-sm text-slate-600">
                        <span className="font-medium text-slate-700">
                            Motivo do Reagendamento
                        </span>
                        <textarea
                            rows={4}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Explique o motivo..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                    </label>
                </div>

                <div className="mt-5 flex gap-3 border-t border-slate-200 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="w-full rounded-xl bg-[#abd6e6] py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                        <span className="inline-flex items-center gap-2">
                            <Send size={14} />
                            Enviar Pedido
                        </span>
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function ReagendamentosProfessorPage() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [requests, setRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [requestsError, setRequestsError] = useState('');
    const [selectedSession, setSelectedSession] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalSeed, setModalSeed] = useState(0);

    useEffect(() => {
        let isMounted = true;

        async function loadServices() {
            setLoading(true);
            setError('');

            try {
                const response = await apiGet('/api/professor/servicos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar reagendamentos.'
                    );
                }

                if (isMounted) {
                    setServices(
                        Array.isArray(data?.servicos) ? data.servicos : []
                    );
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError.message ||
                            'Erro ao carregar reagendamentos.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadServices();

        async function loadRequests() {
            setRequestsLoading(true);
            setRequestsError('');

            try {
                const response = await apiGet('/api/professor/reagendamentos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                            'Erro ao carregar pedidos de reagendamento.'
                    );
                }

                if (isMounted) {
                    setRequests(
                        Array.isArray(data?.pedidos) ? data.pedidos : []
                    );
                }
            } catch (requestError) {
                if (isMounted) {
                    setRequestsError(
                        requestError.message ||
                            'Erro ao carregar pedidos de reagendamento.'
                    );
                }
            } finally {
                if (isMounted) {
                    setRequestsLoading(false);
                }
            }
        }

        loadRequests();

        return () => {
            isMounted = false;
        };
    }, []);

    const futureSessions = useMemo(
        () => getFutureSessions(services),
        [services]
    );

    function openRequestModal(session) {
        setSelectedSession(session);
        setModalOpen(true);
        setModalSeed((value) => value + 1);
    }

    function closeRequestModal() {
        setModalOpen(false);
        setSelectedSession(null);
    }

    async function handleSubmitRequest({ newDate, newTime, newRoom, reason }) {
        if (!selectedSession) {
            return;
        }

        try {
            const response = await apiPost('/api/professor/reagendamentos', {
                id_servico: selectedSession.id,
                data_sugerida: newDate || null,
                hora_sugerida: newTime || null,
                sala_sugerida: newRoom || null,
                motivo: reason,
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Erro ao criar pedido de reagendamento.'
                );
            }

            if (data?.pedido) {
                setRequests((prev) => [data.pedido, ...prev]);
            }

            closeRequestModal();
        } catch (requestError) {
            setRequestsError(
                requestError.message || 'Erro ao criar pedido de reagendamento.'
            );
        }
    }

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Reagendamento de Sessões"
                title="Reagendamento"
                subtitle="Crie os pedidos de reagendamento e visualize as sessões elegíveis para reagendamento."
                icon={CalendarDays}
            />

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
                    A carregar serviços...
                </div>
            ) : null}

            {!loading && error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            {!loading && !error ? (
                <>
                    <div>
                        <h2 className="mb-4 text-lg font-semibold text-slate-700">
                            As Minhas Sessões
                        </h2>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {futureSessions.length ? (
                                futureSessions.map((session) => (
                                    <SessionCard
                                        key={session.id}
                                        session={session}
                                        onRequest={openRequestModal}
                                    />
                                ))
                            ) : (
                                <div className="rounded-[16px] border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 xl:col-span-2">
                                    Sem serviços associados a esta conta.
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h2 className="mb-4 text-lg font-semibold text-slate-700">
                            Meus Pedidos de Reagendamento
                        </h2>

                        {!requestsLoading && requestsError ? (
                            <div className="mb-3 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {requestsError}
                            </div>
                        ) : null}

                        {requestsLoading ? (
                            <div className="rounded-[16px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                                A carregar pedidos de reagendamento...
                            </div>
                        ) : requests.length ? (
                            <div className="space-y-3">
                                {requests.map((request) => (
                                    <RequestCard
                                        key={request.id}
                                        request={request}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                        <PencilLine size={16} />
                                    </span>
                                    <div>
                                        <p className="font-medium text-slate-700">
                                            Sem pedidos de reagendamento.
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Clica em “Pedir Reagendamento” numa
                                            sessão futura para criar um pedido.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : null}

            <RequestModal
                key={`${selectedSession?.id || 'request-modal'}-${modalSeed}`}
                open={modalOpen}
                session={selectedSession}
                onClose={closeRequestModal}
                onSubmit={handleSubmitRequest}
            />
        </section>
    );
}
