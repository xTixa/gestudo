import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Home,
    Wallet,
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import { usePlan } from '../../utils/plan';
import UsersPageHeader from '../../components/layout/UsersPageHeader';
import { EducandosEmpty } from '../../components/guardian/EducandoScope';
import { useEducandos } from '../../components/guardian/useEducandos';
import { formatMoney } from '../../components/finance/financeFormat';

const DAYS_AHEAD = 7;
const MAX_SESSIONS = 3;

function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDayLabel(dateKey, todayKey) {
    if (dateKey === todayKey) return 'Hoje';
    const date = new Date(`${dateKey}T00:00:00`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateKey === toDateKey(tomorrow)) return 'Amanhã';
    return date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function readJson(request) {
    const response = await request;
    if (!response.ok) return null;
    return response.json().catch(() => null);
}

// Resumo de um educando: próximas sessões, faltas do mês e valor em dívida.
async function loadResumo(idAluno, withFinance) {
    const today = new Date();
    const until = new Date();
    until.setDate(until.getDate() + DAYS_AHEAD);
    const todayKey = toDateKey(today);
    const base = `/api/encarregado/educandos/${idAluno}`;

    const [agenda, presencas, conta] = await Promise.all([
        readJson(apiGet(`${base}/agenda?from=${todayKey}&to=${toDateKey(until)}`)),
        readJson(apiGet(`${base}/presencas`)),
        withFinance ? readJson(apiGet(`${base}/conta-corrente`)) : Promise.resolve(null),
    ]);

    const sessions = Object.entries(agenda?.atividadesPorDia || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([day, items]) =>
            (items || []).map((item) => ({
                day: day.slice(0, 10),
                time: item.hora || '--:--',
                title: item.titulo || 'Sessão',
                detail: [item.professor, item.local].filter(Boolean).join(' · '),
            }))
        )
        .slice(0, MAX_SESSIONS);

    const monthPrefix = todayKey.slice(0, 7);
    const doMes = (presencas?.presencas || []).filter((p) =>
        String(p.date || '').startsWith(monthPrefix)
    );
    const faltas = doMes.filter((p) => String(p.status).toLowerCase() === 'falta').length;

    return {
        todayKey,
        sessions,
        aulasMes: doMes.length,
        faltasMes: faltas,
        emDivida: conta?.totais?.emDivida ?? null,
        vencido: conta?.totais?.vencido ?? 0,
    };
}

function EducandoCard({ educando, withFinance, onOpen }) {
    const [resumo, setResumo] = useState(null);

    useEffect(() => {
        let active = true;
        loadResumo(educando.idAluno, withFinance).then((data) => {
            if (active) setResumo(data);
        });
        return () => {
            active = false;
        };
    }, [educando.idAluno, withFinance]);

    const detalhe = [educando.escola, educando.ano ? `${educando.ano}º ano` : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-base font-semibold text-cyan-800">
                    {educando.nome.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-900">
                        {educando.nome}
                    </h2>
                    {detalhe && <p className="truncate text-sm text-slate-500">{detalhe}</p>}
                </div>
                {!educando.ativo && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Inativo
                    </span>
                )}
            </header>

            {!resumo ? (
                <p className="px-5 py-6 text-sm text-slate-500">A carregar…</p>
            ) : (
                <div className="space-y-5 px-5 py-5">
                    <div>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <Clock3 size={14} /> Próximas sessões
                        </p>
                        {resumo.sessions.length ? (
                            <ul className="mt-3 space-y-2">
                                {resumo.sessions.map((s, i) => (
                                    <li
                                        key={`${s.day}-${s.time}-${i}`}
                                        className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5"
                                    >
                                        <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                                            {formatDayLabel(s.day, resumo.todayKey)}
                                        </span>
                                        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                                            {s.time}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-slate-800">
                                                {s.title}
                                            </span>
                                            {s.detail && (
                                                <span className="block truncate text-xs text-slate-500">
                                                    {s.detail}
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-sm text-slate-500">
                                Sem sessões nos próximos {DAYS_AHEAD} dias.
                            </p>
                        )}
                    </div>

                    <div className={`grid gap-3 ${withFinance ? 'sm:grid-cols-2' : ''}`}>
                        <button
                            type="button"
                            onClick={() => onOpen('/encarregado/presencas', educando.idAluno)}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                            {resumo.faltasMes > 0 ? (
                                <AlertTriangle size={20} className="shrink-0 text-rose-500" />
                            ) : (
                                <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                            )}
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-800">
                                    {resumo.faltasMes > 0
                                        ? `${resumo.faltasMes} falta${resumo.faltasMes > 1 ? 's' : ''} este mês`
                                        : 'Sem faltas este mês'}
                                </span>
                                <span className="block text-xs text-slate-500">
                                    {resumo.aulasMes} aula{resumo.aulasMes === 1 ? '' : 's'} registada
                                    {resumo.aulasMes === 1 ? '' : 's'}
                                </span>
                            </span>
                            <ChevronRight size={16} className="text-slate-400" />
                        </button>

                        {withFinance && (
                            <button
                                type="button"
                                onClick={() => onOpen('/encarregado/pagamentos', educando.idAluno)}
                                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                                <Wallet
                                    size={20}
                                    className={`shrink-0 ${resumo.emDivida > 0 ? 'text-rose-500' : 'text-emerald-600'}`}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-slate-800">
                                        {resumo.emDivida > 0
                                            ? `${formatMoney(resumo.emDivida)} por pagar`
                                            : 'Pagamentos em dia'}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                        {resumo.vencido > 0
                                            ? `${formatMoney(resumo.vencido)} em atraso`
                                            : 'Mensalidades'}
                                    </span>
                                </span>
                                <ChevronRight size={16} className="text-slate-400" />
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onOpen('/encarregado/agenda', educando.idAluno)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
                    >
                        <CalendarDays size={16} /> Ver agenda completa
                    </button>
                </div>
            )}
        </article>
    );
}

export default function DashboardEncarregadoPage() {
    const navigate = useNavigate();
    const { loading, error, educandos, setSelectedId } = useEducandos();
    const { hasModule } = usePlan();
    const [nome, setNome] = useState('');

    useEffect(() => {
        let active = true;
        apiGet('/api/encarregado/perfil')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (active && data?.nome) setNome(data.nome.split(' ')[0]);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    function openFor(path, idAluno) {
        setSelectedId(idAluno);
        navigate(path);
    }

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Área do encarregado"
                title={nome ? `Olá, ${nome}` : 'Dashboard'}
                subtitle="Acompanhe as sessões, presenças e pagamentos dos seus educandos."
                icon={Home}
            />

            {loading ? (
                <p className="text-sm text-slate-500">A carregar…</p>
            ) : error || !educandos.length ? (
                <EducandosEmpty error={error} />
            ) : (
                <div className="grid gap-5 xl:grid-cols-2">
                    {educandos.map((educando) => (
                        <EducandoCard
                            key={educando.idAluno}
                            educando={educando}
                            withFinance={hasModule('financeiro')}
                            onOpen={openFor}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
