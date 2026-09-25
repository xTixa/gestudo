import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowDownToLine, ChevronRight, Receipt, Sparkles, Wallet } from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import KpiCard from '../../../components/dashboard/KpiCard';
import BarSeriesChart from '../../../components/dashboard/BarSeriesChart';
import EstadoBadge from '../../../components/finance/EstadoBadge';
import MensalidadeDrawer from '../../../components/finance/MensalidadeDrawer';
import GerarMensalidadesModal from '../../../components/finance/GerarMensalidadesModal';
import {
    currentMes,
    formatDate,
    formatMes,
    formatMoney,
} from '../../../components/finance/financeFormat';
import { btnPrimary, btnSecondary, cardClass } from '../../../components/finance/financeUi';
import { apiGet } from '../../../utils/api';

const SERIES = [
    { key: 'faturado', label: 'Faturado' },
    { key: 'recebido', label: 'Recebido' },
];

const compactMoney = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
});

function shortMonth(mes) {
    const [y, m] = String(mes).split('-').map(Number);
    return new Date(y, m - 1, 1)
        .toLocaleDateString('pt-PT', { month: 'short' })
        .replace('.', '');
}

export default function FinanceOverview() {
    const navigate = useNavigate();
    const [mes] = useState(currentMes);
    const [resumo, setResumo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [gerarOpen, setGerarOpen] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;
        apiGet(`/api/gestor/financeiro/resumo?mes=${mes}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || 'Erro ao carregar o resumo financeiro.');
                return json;
            })
            .then((json) => {
                if (!active) return;
                setResumo(json);
                setError('');
            })
            .catch((err) => active && setError(err.message))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [mes, reloadKey]);

    const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
    const r = resumo || {};
    const serie = (r.serie || []).map((row) => ({ ...row, label: shortMonth(row.mes) }));
    const taxa = r.faturadoMes > 0 ? Math.round((r.recebidoMes / r.faturadoMes) * 100) : null;

    return (
        <section className="space-y-6">
            <AdminPageHeader
                title="Financeiro"
                subtitle={`Visão geral de ${formatMes(mes).toLowerCase()}.`}
                actions={
                    <>
                        <button type="button" className={btnSecondary} onClick={() => navigate('/gestor/financeiro/pagamentos')}>
                            <ArrowDownToLine size={16} aria-hidden="true" />
                            Pagamentos
                        </button>
                        <button type="button" className={btnPrimary} onClick={() => setGerarOpen(true)}>
                            <Sparkles size={16} aria-hidden="true" />
                            Gerar mensalidades
                        </button>
                    </>
                }
            />

            {error ? (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <KpiCard
                    label="Faturado este mês"
                    value={formatMoney(r.faturadoMes)}
                    hint={loading ? undefined : `${r.mensalidadesMes || 0} mensalidade${r.mensalidadesMes === 1 ? '' : 's'}`}
                    icon={Receipt}
                    loading={loading}
                    onClick={() => navigate(`/gestor/financeiro/mensalidades?mes=${mes}`)}
                />
                <KpiCard
                    label="Recebido este mês"
                    value={formatMoney(r.recebidoMes)}
                    hint={taxa === null ? undefined : `${taxa}% do valor faturado`}
                    icon={Wallet}
                    loading={loading}
                    onClick={() => navigate('/gestor/financeiro/pagamentos')}
                />
                <KpiCard
                    label="Por receber"
                    value={formatMoney(r.emDivida)}
                    hint="Total em dívida, todos os meses"
                    icon={ArrowDownToLine}
                    loading={loading}
                    onClick={() => navigate('/gestor/financeiro/mensalidades?mes=&estado=em_divida')}
                />
                <KpiCard
                    label="Em atraso"
                    value={formatMoney(r.vencido)}
                    hint={loading ? undefined : `${r.vencidas || 0} mensalidade${r.vencidas === 1 ? '' : 's'} vencida${r.vencidas === 1 ? '' : 's'}`}
                    icon={AlertCircle}
                    loading={loading}
                    onClick={() => navigate('/gestor/financeiro/mensalidades?mes=&estado=vencida')}
                />
            </div>

            {/* Resultado do mês: recebido − custos com professores */}
            <section className={`${cardClass} px-5 py-4`}>
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-900">Resultado do mês</h2>
                    <button
                        type="button"
                        onClick={() => navigate(`/gestor/financeiro/professores?mes=${mes}`)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                        Custos com professores
                        <ChevronRight size={14} aria-hidden="true" />
                    </button>
                </div>
                {loading ? (
                    <span className="mt-3 block h-7 w-64 animate-pulse rounded bg-slate-100" />
                ) : (
                    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                        <div>
                            <dt className="text-xs text-slate-500">Recebido</dt>
                            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatMoney(r.recebidoMes)}</dd>
                        </div>
                        <span className="hidden text-lg text-slate-300 sm:block" aria-hidden="true">−</span>
                        <div>
                            <dt className="text-xs text-slate-500">Custos com professores</dt>
                            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatMoney(r.custoProfessores?.total)}</dd>
                            <dd className="text-xs text-slate-500">
                                {formatMoney(r.custoProfessores?.pago)} pago
                                {r.custoProfessores?.emAberto > 0 ? ` · ${formatMoney(r.custoProfessores.emAberto)} estimado (mês por fechar)` : ''}
                            </dd>
                        </div>
                        <span className="hidden text-lg text-slate-300 sm:block" aria-hidden="true">=</span>
                        <div>
                            <dt className="text-xs text-slate-500">Resultado</dt>
                            <dd className={`text-lg font-semibold tabular-nums ${r.resultadoMes < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {formatMoney(r.resultadoMes)}
                            </dd>
                        </div>
                    </dl>
                )}
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <section className={`${cardClass} lg:col-span-3`}>
                    <header className="border-b border-slate-100 px-5 py-4">
                        <h2 className="text-sm font-semibold text-slate-900">Faturado e recebido</h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                            Mensalidades emitidas vs. pagamentos recebidos nos últimos 6 meses.
                        </p>
                    </header>
                    <div className="px-5 pb-5 pt-4">
                        <BarSeriesChart
                            data={serie}
                            xKey="label"
                            series={SERIES}
                            loading={loading}
                            error={error}
                            emptyText="Ainda não foram geradas mensalidades nem registados pagamentos."
                            caption="Faturado e recebido por mês"
                            valueFormatter={formatMoney}
                            tickFormatter={(v) => compactMoney.format(v)}
                        />
                    </div>
                </section>

                <section className={`${cardClass} flex flex-col lg:col-span-2`}>
                    <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Mensalidades em atraso</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Vencidas e ainda não pagas, das mais antigas.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/gestor/financeiro/mensalidades?mes=&estado=vencida')}
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                        >
                            Ver todas
                            <ChevronRight size={14} aria-hidden="true" />
                        </button>
                    </header>
                    {loading ? (
                        <p className="px-5 py-10 text-center text-sm text-slate-500">A carregar...</p>
                    ) : (r.emAtraso || []).length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
                            <p className="text-sm font-medium text-slate-700">Sem mensalidades em atraso</p>
                            <p className="mt-1 text-xs text-slate-500">Todas as mensalidades vencidas estão pagas.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {r.emAtraso.map((m) => (
                                <li key={m.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(m.id)}
                                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-slate-800">{m.aluno}</span>
                                            <span className="block truncate text-xs text-slate-500">
                                                <span >{formatMes(m.mes, { short: true })}</span> · venceu a {formatDate(m.dataVencimento)}
                                            </span>
                                        </span>
                                        <span className="text-right">
                                            <span className="block text-sm font-semibold tabular-nums text-slate-900">{formatMoney(m.valorEmDivida)}</span>
                                            <EstadoBadge estado={m.estado} />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {selectedId ? (
                <MensalidadeDrawer
                    key={selectedId}
                    idMensalidade={selectedId}
                    onClose={() => setSelectedId(null)}
                    onChanged={refresh}
                />
            ) : null}

            {gerarOpen ? (
                <GerarMensalidadesModal
                    open
                    initialMes={mes}
                    onClose={() => setGerarOpen(false)}
                    onGenerated={(result, mesGerado) => {
                        setGerarOpen(false);
                        navigate(`/gestor/financeiro/mensalidades?mes=${mesGerado}`);
                    }}
                />
            ) : null}
        </section>
    );
}
