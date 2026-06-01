import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Filter,
    UserRound,
    GraduationCap,
    PencilLine,
    MapPin,
    RefreshCw,
    X,
    Check,
    Ban,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { apiGet, apiPatch } from '../../utils/api';

// função para formatar uma data em formato ISO (YYYY-MM-DD) para o formato de data local (DD/MM/YYYY), garantindo que as datas sejam apresentadas de forma legível e consistente na interface
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// função para normalizar um valor de data, aceitando formatos ISO (YYYY-MM-DD), ISO com hora (YYYY-MM-DDTHH:mm), ou formatos de data reconhecíveis pelo construtor Date, e retornando a data no formato ISO (YYYY-MM-DD) ou uma string vazia caso o valor seja inválido, garantindo que as datas sejam armazenadas em um formato consistente e válido
function normalizeDateKey(value) {
    if (!value) return '';

    const raw = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

    const parts = raw.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
    }

    return '';
}

// função para formatar uma data em formato ISO para um rótulo de data legível em português, retornando "Data por definir" caso o valor seja inválido ou ausente, garantindo que as datas sejam apresentadas de forma legível e consistente na interface
function formatDateLabel(dateIso) {
    const normalized = normalizeDateKey(dateIso);
    if (!normalized) {
        return 'Data por definir';
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const safeDate = new Date(year, month - 1, day);

    return safeDate.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

// função para obter o intervalo de datas para a agenda com base em um período selecionado, retornando as datas de início e fim no formato ISO (YYYY-MM-DD) para os períodos "mês atual", "próximos 30 dias" e "próximos 60 dias", garantindo que a agenda seja filtrada corretamente de acordo com o período selecionado
function getAgendaRange(periodo = 'mesAtual') {
    const now = new Date();

    if (periodo === 'proximos30' || periodo === 'proximos60') {
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysAhead = periodo === 'proximos60' ? 60 : 30;
        const to = new Date(from);
        to.setDate(to.getDate() + daysAhead);

        return {
            from: formatDateKey(from),
            to: formatDateKey(to),
        };
    }

    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
        from: formatDateKey(from),
        to: formatDateKey(to),
    };
}

// constante para definir o tempo mínimo de antecedência para solicitar um reagendamento, em minutos, garantindo que os reagendamentos sejam solicitados com tempo suficiente para serem processados e evitarem conflitos de última hora
const RESCHEDULE_MIN_LEAD_MINUTES = 60;

// função para obter a data e hora de início de uma sessão com base nos campos de data e hora de início, retornando um objeto Date ou null caso os valores sejam inválidos, garantindo que as datas e horas sejam processadas corretamente para verificar a elegibilidade para reagendamento
function getSessionStartDateTime(sessao) {
    const normalized = normalizeDateKey(sessao?.data);
    const timeLabel = String(sessao?.horaInicio || '')
        .trim()
        .slice(0, 5);

    if (!normalized || !/^\d{2}:\d{2}$/.test(timeLabel)) {
        return null;
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const [hour, minute] = timeLabel.split(':').map(Number);

    if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
        return null;
    }

    return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// função para verificar se uma sessão é elegível para solicitar um reagendamento, comparando a data e hora de início da sessão com o tempo atual mais o tempo mínimo de antecedência definido, retornando true se a sessão for elegível ou false caso contrário, garantindo que os reagendamentos sejam solicitados apenas para sessões que ainda não estão próximas do início
function canRequestReschedule(sessao) {
    const sessionStart = getSessionStartDateTime(sessao);
    if (!sessionStart) return false;

    const now = new Date();
    const diffMinutes = (sessionStart - now) / 60000;

    return diffMinutes >= RESCHEDULE_MIN_LEAD_MINUTES;
}

// função para analisar um rótulo de intervalo de tempo no formato "HH:mm - HH:mm", retornando um objeto com as propriedades "start" e "end" contendo os horários de início e fim no formato "HH:mm" ou uma string vazia caso os valores sejam inválidos, garantindo que os horários sejam processados corretamente para calcular a duração e verificar conflitos
function parseRangeTimeLabel(label) {
    const raw = String(label || '').trim();
    if (!raw) {
        return { start: '', end: '' };
    }

    const parts = raw.split('-').map((item) => String(item || '').trim());
    const start = String(parts[0] || '').slice(0, 5);
    const end = String(parts[1] || '').slice(0, 5);

    return {
        start: /^\d{2}:\d{2}$/.test(start) ? start : '',
        end: /^\d{2}:\d{2}$/.test(end) ? end : '',
    };
}

// função para calcular a duração em minutos de um intervalo de tempo representado por um rótulo no formato "HH:mm - HH:mm", utilizando a função parseRangeTimeLabel para obter os horários de início e fim, e retornando a duração em minutos ou um valor de fallback caso os horários sejam inválidos, garantindo que as durações sejam calculadas corretamente para verificar conflitos e definir a duração das sessões
function getDurationFromRangeLabel(label, fallback = 60) {
    const { start, end } = parseRangeTimeLabel(label);
    if (!start || !end) {
        return Number(fallback) > 0 ? Number(fallback) : 60;
    }

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (
        [startHour, startMinute, endHour, endMinute].some((value) =>
            Number.isNaN(value)
        )
    ) {
        return Number(fallback) > 0 ? Number(fallback) : 60;
    }

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const diff = (endTotal - startTotal + 24 * 60) % (24 * 60);
    return diff || (Number(fallback) > 0 ? Number(fallback) : 60);
}

// função para extrair o ID do serviço a partir do ID da sessão, assumindo que o ID da sessão contém um número inteiro representando o ID do serviço no início, e retornando o ID do serviço como um número inteiro ou null caso o valor seja inválido, garantindo que o ID do serviço seja identificado corretamente para processar os reagendamentos
function extractServicoId(sessaoId) {
    const raw = String(sessaoId || '').trim();
    const match = raw.match(/^\d+/);
    const parsed = Number(match?.[0]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// função para obter o nome do dia da semana em português a partir de uma data em formato ISO, normalizando a data e utilizando o método getDay para obter o índice do dia da semana, e retornando o nome correspondente ou uma string vazia caso a data seja inválida, garantindo que os dias da semana sejam apresentados de forma legível e consistente na interface
function getDayKeyFromIsoDate(dateIso) {
    const normalized = normalizeDateKey(dateIso);
    if (!normalized) {
        return '';
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const keys = [
        'domingo',
        'segunda',
        'terca',
        'quarta',
        'quinta',
        'sexta',
        'sabado',
    ];

    return keys[date.getDay()] || '';
}

// função para normalizar um valor de dias da semana, aceitando um array de valores ou um valor único, convertendo cada item para string, removendo espaços em branco, convertendo para minúsculas e filtrando valores vazios, retornando um array de dias da semana normalizados, garantindo que os dias da semana sejam processados de forma consistente para verificar a elegibilidade para reagendamento e atualizar os dados do serviço
function normalizeDiasSemana(values) {
    return Array.isArray(values)
        ? values
              .map((item) =>
                  String(item || '')
                      .trim()
                      .toLowerCase()
              )
              .filter(Boolean)
        : [];
}

// função para verificar se uma data em formato ISO está dentro do período definido pela função getAgendaRange, normalizando a data e comparando com as datas de início e fim do período, retornando true se a data estiver dentro do período ou false caso contrário, garantindo que as sessões sejam filtradas corretamente de acordo com o período selecionado
function isDateInsidePeriod(dateIso, periodo) {
    const normalized = normalizeDateKey(dateIso);
    if (!normalized) {
        return false;
    }

    const { from, to } = getAgendaRange(periodo);
    return normalized >= from && normalized <= to;
}

// componente para exibir uma notificação de feedback com base em um objeto de feedback contendo um tipo (success ou error) e uma mensagem, retornando null caso a mensagem seja ausente, e estilizando a notificação de acordo com o tipo para garantir que os usuários recebam um feedback claro e visualmente distinto sobre as ações realizadas
function FeedbackNotice({ feedback }) {
    if (!feedback?.message) {
        return null;
    }

    const Icon = feedback.type === 'success' ? CheckCircle2 : AlertCircle;
    const baseClass =
        'flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium';
    const toneClass =
        feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800';

    return (
        <div className={`${baseClass} ${toneClass}`}>
            <Icon size={17} className="mt-0.5 flex-shrink-0" />
            <span>{feedback.message}</span>
        </div>
    );
}

// componente para exibir um badge de status com base em um rótulo e um tom opcional, utilizando uma configuração de estilos predefinida para diferentes tons, garantindo que os status sejam apresentados de forma visualmente distinta e compreensível na interface
function StatusPill({ label, tone = 'slate' }) {
    const tones = {
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-700',
        rose: 'border-rose-200 bg-rose-50 text-rose-700',
        sky: 'border-sky-200 bg-sky-50 text-sky-700',
        slate: 'border-slate-200 bg-slate-50 text-slate-600',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
        >
            {label}
        </span>
    );
}

function StatCard({ label, value, tone = 'slate', icon: Icon }) {
    const tones = {
        emerald: 'text-emerald-700',
        amber: 'text-amber-700',
        sky: 'text-sky-700',
        slate: 'text-slate-700',
    };

    return (
        <article className="rounded-xl bg-[#f3f8fb] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            {Icon ? (
                <div className={`flex justify-center ${tones[tone]}`}>
                    <Icon size={13} />
                </div>
            ) : null}
            <div className="mt-1 text-xl font-semibold leading-none text-slate-700">
                {value}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                {label}
            </div>
        </article>
    );
}

export default function ReagendamentosPage() {
    const [sessoesAgendadas, setSessoesAgendadas] = useState([]);
    const [salasCatalogo, setSalasCatalogo] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filtroProfessor, setFiltroProfessor] = useState('');
    const [filtroSala, setFiltroSala] = useState('');
    const [filtroData, setFiltroData] = useState('');
    const [isReagendarModalOpen, setIsReagendarModalOpen] = useState(false);
    const [sessaoSelecionada, setSessaoSelecionada] = useState(null);
    const [novaDataPretendida, setNovaDataPretendida] = useState('');
    const [horarioSelecionado, setHorarioSelecionado] = useState('');
    const [salaSelecionada, setSalaSelecionada] = useState('');
    const [motivoReagendamento, setMotivoReagendamento] = useState('');
    const [pedidosPendentes, setPedidosPendentes] = useState([]);
    const [pedidosLoading, setPedidosLoading] = useState(true);
    const [pedidosError, setPedidosError] = useState('');
    const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('pendente');
    const [filtroPeriodoAgenda, setFiltroPeriodoAgenda] = useState('mesAtual');
    const [agendaReloadToken, setAgendaReloadToken] = useState(0);
    const [isAReagendar, setIsAReagendar] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [decisaoModal, setDecisaoModal] = useState({
        open: false,
        pedido: null,
        estado: 'aprovado',
        motivoDecisao: '',
    });

    const ocupacaoMap = useMemo(() => {
        const map = new Set();

        sessoesAgendadas.forEach((sessao) => {
            map.add(`${sessao.data}-${sessao.hora}-${sessao.sala}`);
        });

        return map;
    }, [sessoesAgendadas]);

    useEffect(() => {
        let isMounted = true;

        async function loadSessoes() {
            setLoading(true);
            setError('');

            try {
                const { from, to } = getAgendaRange(filtroPeriodoAgenda);
                const response = await apiGet(
                    `/api/gestor/agenda?from=${from}&to=${to}&rescheduleEligible=true`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar sessões agendadas.'
                    );
                }

                const rows = [];
                Object.entries(data.atividadesPorDia || {}).forEach(
                    ([date, items]) => {
                        const normalizedDate = normalizeDateKey(date);
                        if (!normalizedDate) {
                            return;
                        }

                        (items || []).forEach((item) => {
                            const horaInicio =
                                String(item?.hora || '').slice(0, 5) || '';
                            const horaFim =
                                String(item?.horaFim || '').slice(0, 5) || '';
                            const alunos = Array.isArray(item?.alunos)
                                ? item.alunos
                                      .map((aluno) =>
                                          String(aluno || '').trim()
                                      )
                                      .filter(Boolean)
                                : [];

                            rows.push({
                                id: `${item.id}-${normalizedDate}`,
                                disciplina: item.titulo || 'Sessão',
                                alunos,
                                professor: item.professor || 'Professor',
                                data: normalizedDate,
                                horaInicio,
                                horaFim,
                                hora: `${horaInicio || '--:--'} - ${horaFim || '--:--'}`,
                                sala: item.local || 'Sala',
                            });
                        });
                    }
                );

                rows.sort((a, b) => {
                    const aKey = `${a.data}T${a.horaInicio || '23:59'}`;
                    const bKey = `${b.data}T${b.horaInicio || '23:59'}`;
                    return aKey.localeCompare(bKey);
                });

                if (isMounted) setSessoesAgendadas(rows);
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError.message || 'Erro ao carregar sessões.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadSessoes();

        return () => {
            isMounted = false;
        };
    }, [agendaReloadToken, filtroPeriodoAgenda]);

    useEffect(() => {
        let isMounted = true;

        async function loadPedidos() {
            setPedidosLoading(true);
            setPedidosError('');

            try {
                const query =
                    filtroEstadoPedido === 'all'
                        ? ''
                        : `?estado=${encodeURIComponent(filtroEstadoPedido)}`;
                const response = await apiGet(
                    `/api/gestor/reagendamentos/pedidos${query}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                            'Erro ao carregar pedidos de reagendamento.'
                    );
                }

                if (isMounted) {
                    setPedidosPendentes(
                        Array.isArray(data?.pedidos) ? data.pedidos : []
                    );
                }
            } catch (err) {
                if (isMounted) {
                    setPedidosError(
                        err.message ||
                            'Erro ao carregar pedidos de reagendamento.'
                    );
                }
            } finally {
                if (isMounted) {
                    setPedidosLoading(false);
                }
            }
        }

        loadPedidos();

        return () => {
            isMounted = false;
        };
    }, [filtroEstadoPedido]);

    useEffect(() => {
        let isMounted = true;

        async function loadSalas() {
            try {
                const response = await apiGet('/api/gestor/salas');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao carregar salas.');
                }

                const rows = Array.isArray(data?.salas) ? data.salas : [];
                const parsed = rows
                    .filter((sala) => sala?.ativa !== false)
                    .map((sala) => ({
                        id:
                            sala?.id_sala ??
                            sala?.id ??
                            sala?.sala_id ??
                            sala?.nome,
                        nome:
                            String(
                                sala?.nome ?? sala?.designacao ?? 'Sala'
                            ).trim() || 'Sala',
                        capacidade: Number.isFinite(Number(sala?.capacidade))
                            ? Number(sala.capacidade)
                            : null,
                    }))
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT'));

                if (isMounted) {
                    setSalasCatalogo(parsed);
                }
            } catch {
                if (isMounted) {
                    setSalasCatalogo([]);
                }
            }
        }

        loadSalas();

        return () => {
            isMounted = false;
        };
    }, []);

    const sessoesElegiveis = useMemo(
        () => sessoesAgendadas,
        [sessoesAgendadas]
    );

    const professoresDisponiveis = useMemo(() => {
        return Array.from(
            new Set(sessoesElegiveis.map((sessao) => sessao.professor))
        ).sort((a, b) => a.localeCompare(b));
    }, [sessoesElegiveis]);

    const salasDisponiveis = useMemo(() => {
        return Array.from(
            new Set(sessoesElegiveis.map((sessao) => sessao.sala))
        ).sort((a, b) => a.localeCompare(b));
    }, [sessoesElegiveis]);

    const sessoesFiltradas = useMemo(() => {
        return sessoesElegiveis.filter((sessao) => {
            if (filtroProfessor && sessao.professor !== filtroProfessor) {
                return false;
            }

            if (filtroSala && sessao.sala !== filtroSala) {
                return false;
            }

            if (filtroData && sessao.data !== filtroData) {
                return false;
            }

            return true;
        });
    }, [filtroData, filtroProfessor, filtroSala, sessoesElegiveis]);

    const sessoesPorData = useMemo(() => {
        return sessoesFiltradas.reduce((acc, sessao) => {
            if (!acc[sessao.data]) {
                acc[sessao.data] = [];
            }

            acc[sessao.data].push(sessao);
            return acc;
        }, {});
    }, [sessoesFiltradas]);

    const pedidosPendentesCount = pedidosPendentes.filter(
        (pedido) => pedido.statusKey === 'pendente'
    ).length;
    const hasActiveAgendaFilters = Boolean(
        filtroProfessor ||
        filtroSala ||
        filtroData ||
        filtroPeriodoAgenda !== 'mesAtual'
    );

    function limparFiltrosAgenda() {
        setFiltroPeriodoAgenda('mesAtual');
        setFiltroProfessor('');
        setFiltroSala('');
        setFiltroData('');
    }

    const horariosBase = useMemo(() => {
        const set = new Set(
            sessoesAgendadas
                .map((sessao) => String(sessao?.hora || '').trim())
                .filter(Boolean)
        );

        if (sessaoSelecionada?.hora) {
            set.add(sessaoSelecionada.hora);
        }

        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [sessaoSelecionada, sessoesAgendadas]);

    const horariosDisponiveis = useMemo(() => {
        const dataAlvo = novaDataPretendida || sessaoSelecionada?.data;

        return horariosBase.map((label) => {
            const ocupado = Boolean(
                dataAlvo &&
                ocupacaoMap.has(
                    `${dataAlvo}-${label}-${sessaoSelecionada?.sala}`
                )
            );

            return { label, ocupado };
        });
    }, [horariosBase, novaDataPretendida, sessaoSelecionada, ocupacaoMap]);

    const salasDoFormulario = useMemo(() => {
        const dataAlvo = novaDataPretendida || sessaoSelecionada?.data;
        const horarioAlvo = horarioSelecionado || sessaoSelecionada?.hora;

        return salasCatalogo.map((sala) => {
            const ocupada = Boolean(
                dataAlvo &&
                horarioAlvo &&
                ocupacaoMap.has(`${dataAlvo}-${horarioAlvo}-${sala.nome}`)
            );

            return {
                ...sala,
                ocupada,
            };
        });
    }, [
        horarioSelecionado,
        novaDataPretendida,
        salasCatalogo,
        sessaoSelecionada,
        ocupacaoMap,
    ]);

    function resetFormularioReagendamento() {
        setNovaDataPretendida('');
        setHorarioSelecionado('');
        setSalaSelecionada('');
        setMotivoReagendamento('');
    }

    function fecharModalReagendamento() {
        setIsReagendarModalOpen(false);
        setSessaoSelecionada(null);
        resetFormularioReagendamento();
    }

    function abrirDecisaoPedido(pedido, estado) {
        setFeedback({ type: '', message: '' });

        if (!pedido?.id) {
            return;
        }

        if (estado === 'rejeitado') {
            setDecisaoModal({
                open: true,
                pedido,
                estado,
                motivoDecisao: '',
            });
            return;
        }

        atualizarPedido(pedido.id, estado, '');
    }

    function fecharDecisaoModal() {
        if (isAReagendar) {
            return;
        }

        setDecisaoModal({
            open: false,
            pedido: null,
            estado: 'aprovado',
            motivoDecisao: '',
        });
    }

    async function atualizarPedido(pedidoId, estado, motivoDecisao = '') {
        try {
            const response = await apiPatch(
                `/api/gestor/reagendamentos/pedidos/${pedidoId}/estado`,
                {
                    estado,
                    motivo_decisao: String(motivoDecisao || '').trim(),
                }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        'Não foi possível atualizar o pedido de reagendamento.'
                );
            }

            setPedidosPendentes((prev) =>
                prev.filter((pedido) => pedido.id !== pedidoId)
            );
            setFeedback({
                type: 'success',
                message:
                    estado === 'aprovado'
                        ? 'Pedido aprovado e sessão reagendada com sucesso.'
                        : 'Pedido rejeitado com sucesso.',
            });

            if (decisaoModal.pedido?.id === pedidoId) {
                fecharDecisaoModal();
            }
        } catch (err) {
            setPedidosError(
                err.message ||
                    'Não foi possível atualizar o pedido de reagendamento.'
            );
            setFeedback({
                type: 'error',
                message:
                    err.message ||
                    'Não foi possível atualizar o pedido de reagendamento.',
            });
        }
    }

    async function handleReagendarSessao(sessaoId) {
        const sessao =
            sessoesElegiveis.find((item) => item.id === sessaoId) || null;

        if (!sessao || !canRequestReschedule(sessao)) {
            setFeedback({
                type: 'error',
                message:
                    'Só é possível reagendar até 1 hora antes do início da sessão.',
            });
            return;
        }

        setSessaoSelecionada(sessao);
        setNovaDataPretendida(sessao?.data || '');
        setHorarioSelecionado(sessao?.hora || '');
        setSalaSelecionada(sessao?.sala || '');
        setIsReagendarModalOpen(true);
    }

    async function submeterReagendamento() {
        if (!sessaoSelecionada) {
            setFeedback({
                type: 'error',
                message: 'Sessão inválida para reagendamento.',
            });
            return;
        }

        if (!novaDataPretendida) {
            setFeedback({
                type: 'error',
                message: 'Seleciona uma nova data para reagendar.',
            });
            return;
        }

        if (!horarioSelecionado) {
            setFeedback({
                type: 'error',
                message: 'Seleciona um horário para reagendar.',
            });
            return;
        }

        if (!salaSelecionada) {
            setFeedback({
                type: 'error',
                message: 'Seleciona uma sala para reagendar.',
            });
            return;
        }

        const servicoId = extractServicoId(sessaoSelecionada.id);
        if (!servicoId) {
            setFeedback({
                type: 'error',
                message: 'Não foi possível identificar o serviço.',
            });
            return;
        }

        const salaSelecionadaInfo = salasCatalogo.find(
            (sala) => sala.nome === salaSelecionada
        );
        const salaId = Number(salaSelecionadaInfo?.id);
        if (!Number.isInteger(salaId) || salaId <= 0) {
            setFeedback({
                type: 'error',
                message: 'Sala inválida para reagendamento.',
            });
            return;
        }

        setIsAReagendar(true);
        setFeedback({ type: '', message: '' });

        try {
            const servicesResponse = await apiGet(
                '/api/gestor/servicos/curriculares'
            );
            const servicesData = await servicesResponse.json();

            if (!servicesResponse.ok) {
                throw new Error(
                    servicesData.message ||
                        'Não foi possível obter os dados do serviço.'
                );
            }

            const servico = (
                Array.isArray(servicesData?.servicos)
                    ? servicesData.servicos
                    : []
            ).find((item) => Number(item?.id) === servicoId);

            if (!servico) {
                throw new Error('Serviço não encontrado para reagendamento.');
            }

            const { start: horaInicio } =
                parseRangeTimeLabel(horarioSelecionado);
            if (!horaInicio) {
                throw new Error('Horário inválido para reagendamento.');
            }

            const duracao = getDurationFromRangeLabel(
                horarioSelecionado,
                Number(servico?.duracao) || 60
            );
            const diaNovo = getDayKeyFromIsoDate(novaDataPretendida);
            const diasSemanaBase = normalizeDiasSemana(servico?.diasSemana);
            const diasSemanaAtualizados = diaNovo
                ? Array.from(new Set([...diasSemanaBase, diaNovo]))
                : diasSemanaBase;

            const updateBody = {
                tipoServico:
                    String(servico?.tipoServico || '').trim() || 'Periódico',
                idTipoServico: servico?.tipoServicoId,
                modalidadeId: servico?.modalidadeId,
                disciplinaId: servico?.disciplinaId,
                professorId: servico?.professorId,
                salaId,
                dataInicio: novaDataPretendida,
                horaInicio,
                duracao,
                diasSemana: diasSemanaAtualizados,
                motivoReagendamento,
            };

            const updateResponse = await apiPatch(
                `/api/gestor/servicos/curriculares/${servicoId}`,
                updateBody
            );
            const updateData = await updateResponse.json();

            if (!updateResponse.ok) {
                throw new Error(
                    updateData.message || 'Não foi possível reagendar a sessão.'
                );
            }

            setSessoesAgendadas((prev) =>
                prev.map((sessao) => {
                    if (sessao.id !== sessaoSelecionada.id) {
                        return sessao;
                    }

                    const { end: horaFimSelecionada } =
                        parseRangeTimeLabel(horarioSelecionado);
                    const horaFimFinal =
                        horaFimSelecionada ||
                        String(sessao.horaFim || '').slice(0, 5);

                    return {
                        ...sessao,
                        data: novaDataPretendida,
                        horaInicio: horaInicio,
                        horaFim: horaFimFinal,
                        hora: `${horaInicio || '--:--'} - ${horaFimFinal || '--:--'}`,
                        sala: salaSelecionada,
                    };
                })
            );

            setFeedback({
                type: 'success',
                message: `Sessão reagendada para ${formatDateLabel(novaDataPretendida)} às ${horaInicio}.`,
            });

            const dataReagendada = normalizeDateKey(novaDataPretendida);
            if (dataReagendada) {
                if (!isDateInsidePeriod(dataReagendada, filtroPeriodoAgenda)) {
                    setFiltroPeriodoAgenda('proximos60');
                }

                setFiltroData(dataReagendada);
            }

            setAgendaReloadToken((prev) => prev + 1);
            fecharModalReagendamento();
        } catch (err) {
            setFeedback({
                type: 'error',
                message: err.message || 'Não foi possível reagendar a sessão.',
            });
        } finally {
            setIsAReagendar(false);
        }
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Reagendamentos"
                title="Gestão de reagendamentos"
                subtitle="Aprova pedidos e gere sessões elegíveis para reagendamento."
                icon={RefreshCw}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                    label="Sessões elegíveis"
                    value={sessoesElegiveis.length}
                    tone="sky"
                    icon={CalendarDays}
                />
                <StatCard
                    label="Resultados filtrados"
                    value={sessoesFiltradas.length}
                    tone="slate"
                    icon={Filter}
                />
                <StatCard
                    label="Pedidos pendentes"
                    value={pedidosPendentesCount}
                    tone="amber"
                    icon={Clock3}
                />
            </div>
            <FeedbackNotice feedback={feedback} />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <div className="space-y-4 xl:col-span-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                Sessões elegíveis
                            </h2>
                            <p className="text-xs text-slate-500">
                                A lista abaixo mostra as sessões disponíveis
                                para reagendamento.
                            </p>
                        </div>
                        <StatusPill
                            label={`${sessoesFiltradas.length} resultados`}
                            tone="sky"
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <Filter size={15} className="text-slate-400" />
                                Filtros da agenda
                            </h3>
                            {hasActiveAgendaFilters ? (
                                <button
                                    type="button"
                                    onClick={limparFiltrosAgenda}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                                >
                                    <X size={14} />
                                    Limpar
                                </button>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                            <label className="space-y-1 text-xs font-medium text-slate-500">
                                <span>Período</span>
                                <select
                                    value={filtroPeriodoAgenda}
                                    onChange={(event) =>
                                        setFiltroPeriodoAgenda(
                                            event.target.value
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                >
                                    <option value="mesAtual">Mês atual</option>
                                    <option value="proximos30">
                                        Próximos 30 dias
                                    </option>
                                    <option value="proximos60">
                                        Próximos 60 dias
                                    </option>
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-slate-500">
                                <span>Professor</span>
                                <select
                                    value={filtroProfessor}
                                    onChange={(event) =>
                                        setFiltroProfessor(event.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                >
                                    <option value="">Todos</option>
                                    {professoresDisponiveis.map((professor) => (
                                        <option
                                            key={professor}
                                            value={professor}
                                        >
                                            {professor}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-slate-500">
                                <span>Sala</span>
                                <select
                                    value={filtroSala}
                                    onChange={(event) =>
                                        setFiltroSala(event.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                >
                                    <option value="">Todas</option>
                                    {salasDisponiveis.map((sala) => (
                                        <option key={sala} value={sala}>
                                            {sala}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-slate-500">
                                <span>Data</span>
                                <input
                                    type="date"
                                    value={filtroData}
                                    onChange={(event) =>
                                        setFiltroData(event.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                />
                            </label>
                        </div>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                            A carregar sessões da base de dados...
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-800">
                            <AlertCircle
                                size={17}
                                className="mt-0.5 flex-shrink-0"
                            />
                            <span>{error}</span>
                        </div>
                    ) : sessoesAgendadas.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
                            Sem sessões agendadas para este mês.
                        </div>
                    ) : sessoesFiltradas.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
                            Sem sessões elegíveis para reagendamento (apenas até
                            1 hora antes).
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(sessoesPorData).map(
                                ([data, sessoes]) => (
                                    <section
                                        key={data}
                                        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                                            <div>
                                                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                                    <CalendarDays size={15} />
                                                    {formatDateLabel(data)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {sessoes.length === 1
                                                        ? '1 sessão elegível'
                                                        : `${sessoes.length} sessões elegíveis`}
                                                </p>
                                            </div>
                                            <StatusPill
                                                label={`${sessoes.length} itens`}
                                                tone="slate"
                                            />
                                        </div>

                                        <div className="grid gap-3 p-3 md:grid-cols-2">
                                            {sessoes.map((sessao) => (
                                                <article
                                                    key={sessao.id}
                                                    className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-md"
                                                >
                                                    <h3 className="truncate text-base font-semibold text-slate-800">
                                                        {sessao.disciplina}
                                                    </h3>

                                                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                                        <p className="inline-flex items-center gap-1">
                                                            <Clock3 size={13} />
                                                            {sessao.hora}
                                                        </p>
                                                        <p className="inline-flex items-center gap-1">
                                                            <MapPin size={13} />
                                                            {sessao.sala}
                                                        </p>
                                                    </div>

                                                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                                                        <UserRound size={13} />
                                                        {sessao.professor ||
                                                            'Professor'}
                                                    </p>

                                                    <div className="mt-3">
                                                        <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                                                            <GraduationCap
                                                                size={13}
                                                            />
                                                            Alunos associados
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {sessao.alunos
                                                                .length > 0 ? (
                                                                <>
                                                                    {sessao.alunos
                                                                        .slice(
                                                                            0,
                                                                            3
                                                                        )
                                                                        .map(
                                                                            (
                                                                                nome
                                                                            ) => (
                                                                                <StatusPill
                                                                                    key={
                                                                                        nome
                                                                                    }
                                                                                    label={
                                                                                        nome
                                                                                    }
                                                                                    tone="emerald"
                                                                                />
                                                                            )
                                                                        )}
                                                                    {sessao
                                                                        .alunos
                                                                        .length >
                                                                    3 ? (
                                                                        <StatusPill
                                                                            label={`+${sessao.alunos.length - 3}`}
                                                                            tone="slate"
                                                                        />
                                                                    ) : null}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-slate-500">
                                                                    Sem alunos
                                                                    associados.
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                                                        onClick={() =>
                                                            handleReagendarSessao(
                                                                sessao.id
                                                            )
                                                        }
                                                    >
                                                        <PencilLine size={13} />
                                                        Reagendar
                                                    </button>
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                )
                            )}
                        </div>
                    )}
                </div>

                <aside className="space-y-4 xl:col-span-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                Histórico de pedidos
                            </h2>
                            <p className="text-xs text-slate-500">
                                Pedidos submetidos e respetivas decisões.
                            </p>
                        </div>
                        <StatusPill
                            label={`${pedidosPendentes.length} pedidos`}
                            tone="amber"
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'pendente', label: 'Pendentes' },
                                { key: 'aprovado', label: 'Aprovados' },
                                { key: 'rejeitado', label: 'Rejeitados' },
                                { key: 'all', label: 'Todos' },
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() =>
                                        setFiltroEstadoPedido(item.key)
                                    }
                                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                        filtroEstadoPedido === item.key
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {pedidosLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                            A carregar pedidos pendentes...
                        </div>
                    ) : pedidosError ? (
                        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">
                            <AlertCircle
                                size={17}
                                className="mt-0.5 flex-shrink-0"
                            />
                            <span>{pedidosError}</span>
                        </div>
                    ) : pedidosPendentes.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 shadow-sm">
                            Não existem pedidos registados na base de dados.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pedidosPendentes.map((pedido) => (
                                <article
                                    key={pedido.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-semibold text-slate-700">
                                            {pedido.title}
                                        </h3>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                pedido.statusKey === 'aprovado'
                                                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                                                    : pedido.statusKey ===
                                                        'rejeitado'
                                                      ? 'border border-rose-300 bg-rose-50 text-rose-700'
                                                      : 'border border-amber-300 bg-amber-50 text-amber-700'
                                            }`}
                                        >
                                            {pedido.status || 'Pendente'}
                                        </span>
                                    </div>

                                    <p className="mt-1.5 text-xs text-slate-500">
                                        {pedido.student} · {pedido.professor}
                                    </p>

                                    <p className="mt-1.5 text-xs text-slate-600">
                                        Nova proposta: {pedido.newDate}{' '}
                                        {pedido.newTime
                                            ? `às ${pedido.newTime}`
                                            : ''}
                                    </p>

                                    {pedido.statusKey === 'pendente' ? (
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirDecisaoPedido(
                                                        pedido,
                                                        'aprovado'
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                            >
                                                <Check size={13} />
                                                Aprovar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirDecisaoPedido(
                                                        pedido,
                                                        'rejeitado'
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                            >
                                                <Ban size={13} />
                                                Rejeitar
                                            </button>
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </aside>
            </div>

            {isReagendarModalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        onClick={fecharModalReagendamento}
                        className="absolute inset-0 bg-slate-900/45"
                        disabled={isAReagendar}
                        aria-label="Fechar formulário de reagendamento"
                    />

                    <form className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Reagendamento
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold text-slate-800">
                                    Reagendar aula
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={fecharModalReagendamento}
                                disabled={isAReagendar}
                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
                                aria-label="Fechar modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-lg font-semibold text-slate-800">
                                {sessaoSelecionada?.disciplina || 'Sessão'}
                            </p>
                            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                    <CalendarDays size={14} />
                                    {formatDateLabel(sessaoSelecionada?.data)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Clock3 size={14} />
                                    {sessaoSelecionada?.hora || '--:-- - --:--'}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <MapPin size={14} />
                                    {sessaoSelecionada?.sala || 'Sala'}
                                </span>
                            </p>
                        </div>

                        <div className="space-y-5">
                            <label className="block space-y-1.5 text-sm text-slate-600">
                                <span className="font-medium text-slate-700">
                                    Nova data pretendida
                                </span>
                                <input
                                    type="date"
                                    value={novaDataPretendida}
                                    onChange={(event) =>
                                        setNovaDataPretendida(
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                />
                            </label>

                            <div>
                                <p className="text-sm font-medium text-slate-700">
                                    Horário disponível
                                </p>
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {horariosDisponiveis.length === 0 ? (
                                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500 sm:col-span-3">
                                            Sem horários reais disponíveis para
                                            o período carregado.
                                        </p>
                                    ) : null}
                                    {horariosDisponiveis.map((horario) => {
                                        const selecionado =
                                            horarioSelecionado ===
                                            horario.label;
                                        const desativado = horario.ocupado;

                                        return (
                                            <button
                                                type="button"
                                                key={horario.label}
                                                disabled={desativado}
                                                onClick={() =>
                                                    setHorarioSelecionado(
                                                        horario.label
                                                    )
                                                }
                                                className={`rounded-xl border px-3 py-3 text-sm transition ${
                                                    desativado
                                                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                                                        : selecionado
                                                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                                                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200'
                                                }`}
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock3 size={14} />
                                                    {horario.label}
                                                </span>
                                                {desativado ? (
                                                    <span className="block text-xs text-red-400">
                                                        Ocupado
                                                    </span>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-slate-700">
                                    Sala disponível
                                </p>
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {salasDoFormulario.length === 0 ? (
                                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500 sm:col-span-3">
                                            Sem salas disponíveis na base de
                                            dados.
                                        </p>
                                    ) : null}
                                    {salasDoFormulario.map((sala) => {
                                        const selecionada =
                                            salaSelecionada === sala.nome;
                                        const desativada = sala.ocupada;

                                        return (
                                            <button
                                                type="button"
                                                key={String(
                                                    sala.id ?? sala.nome
                                                )}
                                                disabled={desativada}
                                                onClick={() =>
                                                    setSalaSelecionada(
                                                        sala.nome
                                                    )
                                                }
                                                className={`rounded-xl border px-3 py-3 text-sm transition ${
                                                    desativada
                                                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                                                        : selecionada
                                                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                                                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200'
                                                }`}
                                            >
                                                <p className="inline-flex items-center gap-1 font-medium">
                                                    <MapPin size={14} />
                                                    {sala.nome}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Capacidade:{' '}
                                                    {sala.capacidade ?? '-'}
                                                </p>
                                                {desativada ? (
                                                    <span className="block text-xs text-red-400">
                                                        Ocupada
                                                    </span>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <label className="block space-y-1.5 text-sm text-slate-600">
                                <span className="font-medium text-slate-700">
                                    Motivo do reagendamento
                                </span>
                                <textarea
                                    rows={3}
                                    value={motivoReagendamento}
                                    onChange={(event) =>
                                        setMotivoReagendamento(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Explique o motivo..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                />
                            </label>
                        </div>

                        <div className="mt-6 flex gap-3 border-t border-slate-200 pt-4">
                            <button
                                type="button"
                                onClick={fecharModalReagendamento}
                                disabled={isAReagendar}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={submeterReagendamento}
                                disabled={isAReagendar}
                                className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
                                    isAReagendar
                                        ? 'cursor-not-allowed bg-slate-400'
                                        : 'bg-slate-900 hover:bg-slate-700'
                                }`}
                            >
                                {isAReagendar ? 'A reagendar...' : 'Reagendar'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            {decisaoModal.open && decisaoModal.pedido ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        onClick={fecharDecisaoModal}
                        className="absolute inset-0 bg-slate-900/45"
                        disabled={isAReagendar}
                        aria-label="Fechar decisão"
                    />

                    <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Decisão do pedido
                                </p>
                                <h3 className="mt-1 text-2xl font-semibold text-slate-800">
                                    {decisaoModal.estado === 'aprovado'
                                        ? 'Aprovar pedido'
                                        : 'Rejeitar pedido'}
                                </h3>
                                <p className="mt-2 text-sm text-slate-500">
                                    {decisaoModal.pedido.title} ·{' '}
                                    {decisaoModal.pedido.professor}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={fecharDecisaoModal}
                                disabled={isAReagendar}
                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
                                aria-label="Fechar modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {decisaoModal.estado === 'rejeitado' ? (
                            <label className="mt-5 block space-y-1.5 text-sm text-slate-600">
                                <span className="font-medium text-slate-700">
                                    Motivo da rejeição
                                </span>
                                <textarea
                                    rows={4}
                                    value={decisaoModal.motivoDecisao}
                                    onChange={(event) =>
                                        setDecisaoModal((prev) => ({
                                            ...prev,
                                            motivoDecisao: event.target.value,
                                        }))
                                    }
                                    placeholder="Explique o motivo da rejeição..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                />
                            </label>
                        ) : null}

                        <div className="mt-6 flex gap-3 border-t border-slate-200 pt-4">
                            <button
                                type="button"
                                onClick={fecharDecisaoModal}
                                disabled={isAReagendar}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    atualizarPedido(
                                        decisaoModal.pedido.id,
                                        decisaoModal.estado,
                                        decisaoModal.motivoDecisao
                                    )
                                }
                                disabled={
                                    isAReagendar ||
                                    (decisaoModal.estado === 'rejeitado' &&
                                        !String(
                                            decisaoModal.motivoDecisao || ''
                                        ).trim())
                                }
                                className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
                                    decisaoModal.estado === 'aprovado'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-rose-600 hover:bg-rose-700'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                                {isAReagendar
                                    ? 'A processar...'
                                    : decisaoModal.estado === 'aprovado'
                                      ? 'Confirmar aprovação'
                                      : 'Confirmar rejeição'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
