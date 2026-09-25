import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import CustoEstadoBadge from '../../../components/finance/CustoEstadoBadge';
import ProfessorCustoDrawer from '../../../components/finance/ProfessorCustoDrawer';
import TarifasProfessores from '../../../components/finance/TarifasProfessores';
import {
    currentMes,
    formatHoras,
    formatMes,
    formatMoney,
    shiftMes,
} from '../../../components/finance/financeFormat';
import { btnPrimary, cardClass, inputClass } from '../../../components/finance/financeUi';
import { apiGet, apiPost } from '../../../utils/api';

const TABS = [
    { id: 'mes', label: 'Pagamentos do mês' },
    { id: 'tarifas', label: 'Valores por hora' },
];

export default function CustosProfessoresPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'tarifas' ? 'tarifas' : 'mes';
    const mes = searchParams.get('mes') || currentMes();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    function updateParams(changes) {
        const next = new URLSearchParams(searchParams);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        setSearchParams(next, { replace: true });
    }

    useEffect(() => {
        if (tab !== 'mes') return undefined;
        let active = true;
        apiGet(`/api/gestor/financeiro/professores?mes=${mes}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || 'Erro ao carregar os custos.');
                return json;
            })
            .then((json) => {
                if (!active) return;
                setData(json);
                setError('');
            })
            .catch((err) => active && setError(err.message));
        return () => {
            active = false;
        };
    }, [mes, tab, reloadKey]);

    const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

    const professores = data?.professores || [];
    const comSessoes = professores.filter((p) => p.estado !== 'sem_sessoes');
    const semSessoes = professores.filter((p) => p.estado === 'sem_sessoes');
    const aFechar = comSessoes.filter((p) => p.estado === 'em_aberto' && p.semTarifa.length === 0);

    async function fecharTodos() {
        setBusy(true);
        setNotice(null);
        try {
            const res = await apiPost('/api/gestor/financeiro/professores/fechar', { mes });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.message || 'Erro ao fechar o mês.');
            setNotice({ type: 'ok', text: json.message });
            refresh();
        } catch (err) {
            setNotice({ type: 'erro', text: err.message });
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-6">
            <AdminPageHeader
                title="Pagamentos a professores"
                subtitle="Horas dadas (sessões com presenças marcadas) × valor por hora da modalidade."
                actions={
                    tab === 'mes' && aFechar.length > 0 ? (
                        <button type="button" className={btnPrimary} onClick={fecharTodos} disabled={busy}>
                            <Lock size={15} aria-hidden="true" />
                            {busy ? 'A fechar...' : `Fechar mês (${aFechar.length})`}
                        </button>
                    ) : null
                }
            />

            <nav role="tablist" aria-label="Secções" className="flex gap-1 border-b border-slate-200">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => updateParams({ tab: t.id === 'mes' ? null : t.id })}
                        className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                            tab === t.id
                                ? 'border-cyan-600 text-slate-900'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {tab === 'tarifas' ? (
                <TarifasProfessores />
            ) : (
                <>
                    {notice ? (
                        <p
                            role="status"
                            className={`rounded-lg border px-4 py-2.5 text-sm ${
                                notice.type === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-rose-200 bg-rose-50 text-rose-700'
                            }`}
                        >
                            {notice.text}
                        </p>
                    ) : null}

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                onClick={() => updateParams({ mes: shiftMes(mes, -1) })}
                                aria-label="Mês anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <select
                                aria-label="Mês"
                                className={`${inputClass} w-48`}
                                value={mes}
                                onChange={(e) => updateParams({ mes: e.target.value })}
                            >
                                {Array.from({ length: 18 }, (_, i) => shiftMes(currentMes(), 1 - i)).map((m) => (
                                    <option key={m} value={m}>{formatMes(m)}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                onClick={() => updateParams({ mes: shiftMes(mes, 1) })}
                                aria-label="Mês seguinte"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {data ? (
                            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                <div className="flex gap-1.5"><dt className="text-slate-500">Horas</dt><dd className="font-medium text-slate-900">{formatHoras(data.totais.minutos)}</dd></div>
                                <div className="flex gap-1.5"><dt className="text-slate-500">Total</dt><dd className="font-medium text-slate-900">{formatMoney(data.totais.valor)}</dd></div>
                                <div className="flex gap-1.5"><dt className="text-slate-500">Pago</dt><dd className="font-medium text-slate-900">{formatMoney(data.totais.pago)}</dd></div>
                                <div className="flex gap-1.5"><dt className="text-slate-500">Por pagar</dt><dd className="font-medium text-slate-900">{formatMoney(data.totais.porPagar + data.totais.emAberto)}</dd></div>
                            </dl>
                        ) : null}
                    </div>

                    <div className={`${cardClass} overflow-hidden`}>
                        {error ? (
                            <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p>
                        ) : !data ? (
                            <p className="px-5 py-10 text-center text-sm text-slate-500">A carregar...</p>
                        ) : comSessoes.length === 0 ? (
                            <p className="px-5 py-12 text-center text-sm text-slate-500">
                                Nenhum professor tem sessões com presenças marcadas em {formatMes(mes).toLowerCase()}.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm">
                                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                                        <tr>
                                            <th className="px-4 py-2.5">Professor</th>
                                            <th className="px-4 py-2.5 text-right">Sessões</th>
                                            <th className="px-4 py-2.5 text-right">Horas</th>
                                            <th className="px-4 py-2.5 text-right">Valor</th>
                                            <th className="px-4 py-2.5">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {comSessoes.map((p) => (
                                            <tr key={p.idProfessor} className="cursor-pointer transition hover:bg-slate-50" onClick={() => setSelectedId(p.idProfessor)}>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        className="text-left font-medium text-slate-800 hover:underline focus-visible:underline focus-visible:outline-none"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedId(p.idProfessor);
                                                        }}
                                                    >
                                                        {p.professor}
                                                    </button>
                                                    {p.semTarifa.length > 0 ? (
                                                        <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                                                            <AlertTriangle size={12} aria-hidden="true" />
                                                            Sem valor/hora: {p.semTarifa.join(', ')}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{p.sessoes}</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatHoras(p.minutos)}</td>
                                                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                                                    {p.semTarifa.length > 0 ? '—' : formatMoney(p.valor)}
                                                </td>
                                                <td className="px-4 py-3"><CustoEstadoBadge estado={p.estado} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {semSessoes.length > 0 && comSessoes.length > 0 ? (
                        <p className="text-xs text-slate-500">
                            Sem sessões neste mês: {semSessoes.map((p) => p.professor).join(', ')}.
                        </p>
                    ) : null}
                </>
            )}

            {selectedId ? (
                <ProfessorCustoDrawer
                    key={`${selectedId}-${mes}`}
                    idProfessor={selectedId}
                    mes={mes}
                    onClose={() => setSelectedId(null)}
                    onChanged={refresh}
                />
            ) : null}
        </section>
    );
}
