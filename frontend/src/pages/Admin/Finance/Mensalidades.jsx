import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FilePlus2, Receipt, Search, Sparkles } from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import EstadoBadge from '../../../components/finance/EstadoBadge';
import MensalidadeDrawer from '../../../components/finance/MensalidadeDrawer';
import GerarMensalidadesModal from '../../../components/finance/GerarMensalidadesModal';
import NovaMensalidadeModal from '../../../components/finance/NovaMensalidadeModal';
import {
    ESTADO_OPTIONS,
    currentMes,
    formatDate,
    formatMes,
    formatMoney,
    shiftMes,
} from '../../../components/finance/financeFormat';
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../../components/finance/financeUi';
import { apiGet } from '../../../utils/api';

export default function MensalidadesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const mes = searchParams.get('mes') ?? currentMes();
    const estado = searchParams.get('estado') || '';
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [data, setData] = useState({ mensalidades: [], totais: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [gerarOpen, setGerarOpen] = useState(false);
    const [novaOpen, setNovaOpen] = useState(false);
    const [notice, setNotice] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    function updateParams(changes) {
        const next = new URLSearchParams(searchParams);
        Object.entries(changes).forEach(([key, value]) => {
            if (value === null || value === undefined) next.delete(key);
            else next.set(key, value);
        });
        setSearchParams(next, { replace: true });
    }

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
        return () => clearTimeout(timer);
    }, [q]);

    useEffect(() => {
        let active = true;
        const params = new URLSearchParams();
        if (mes) params.set('mes', mes);
        if (estado) params.set('estado', estado);
        if (debouncedQ) params.set('q', debouncedQ);

        apiGet(`/api/gestor/financeiro/mensalidades?${params.toString()}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || 'Erro ao carregar mensalidades.');
                return json;
            })
            .then((json) => {
                if (!active) return;
                setData(json);
                setError('');
            })
            .catch((err) => active && setError(err.message))
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [mes, estado, debouncedQ, reloadKey]);

    const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

    const { mensalidades, totais } = data;

    return (
        <section className="space-y-6">
            <AdminPageHeader
                title="Mensalidades"
                subtitle="O que cada aluno deve por mês, pago pelo encarregado de educação."
                actions={
                    <>
                        <button type="button" className={btnSecondary} onClick={() => setNovaOpen(true)}>
                            <FilePlus2 size={16} aria-hidden="true" />
                            Nova mensalidade
                        </button>
                        <button type="button" className={btnPrimary} onClick={() => setGerarOpen(true)}>
                            <Sparkles size={16} aria-hidden="true" />
                            Gerar mensalidades
                        </button>
                    </>
                }
            />

            {notice ? (
                <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
                    {notice}
                </p>
            ) : null}

            {/* Filtros */}
            <div className={`${cardClass} flex flex-col gap-3 p-3 lg:flex-row lg:items-center`}>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                        onClick={() => updateParams({ mes: shiftMes(mes || currentMes(), -1) })}
                        aria-label="Mês anterior"
                        disabled={!mes}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <select
                        aria-label="Mês"
                        className={`${inputClass} w-48`}
                        value={mes}
                        onChange={(e) => updateParams({ mes: e.target.value })}
                    >
                        <option value="">Todos os meses</option>
                        {Array.from({ length: 18 }, (_, i) => shiftMes(currentMes(), 3 - i)).map((m) => (
                            <option key={m} value={m}>
                                {formatMes(m)}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                        onClick={() => updateParams({ mes: shiftMes(mes || currentMes(), 1) })}
                        aria-label="Mês seguinte"
                        disabled={!mes}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <select
                    aria-label="Estado"
                    className={`${inputClass} lg:w-48`}
                    value={estado}
                    onChange={(e) => updateParams({ estado: e.target.value || null })}
                >
                    {ESTADO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <div className="relative flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        aria-label="Pesquisar"
                        className={`${inputClass} pl-9`}
                        placeholder="Pesquisar por aluno ou encarregado..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
            </div>

            {/* Totais */}
            {totais ? (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Faturado', value: totais.faturado },
                        { label: 'Recebido', value: totais.recebido },
                        { label: 'Em dívida', value: totais.emDivida, danger: totais.emDivida > 0 },
                    ].map((item) => (
                        <div key={item.label} className={`${cardClass} px-4 py-3`}>
                            <p className="text-xs font-medium text-slate-500">{item.label}</p>
                            <p className={`mt-1 text-xl font-semibold tracking-tight ${item.danger ? 'text-rose-600' : 'text-slate-900'}`}>
                                {formatMoney(item.value)}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* Tabela */}
            <div className={`${cardClass} overflow-hidden`}>
                {error ? (
                    <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p>
                ) : loading ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">A carregar...</p>
                ) : mensalidades.length === 0 ? (
                    <div className="flex flex-col items-center px-5 py-14 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Receipt size={20} aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-sm font-medium text-slate-800">
                            {estado || debouncedQ
                                ? 'Nenhuma mensalidade corresponde aos filtros.'
                                : `Ainda não há mensalidades${mes ? ` de ${formatMes(mes).toLowerCase()}` : ''}.`}
                        </p>
                        {!estado && !debouncedQ ? (
                            <button type="button" className={`${btnPrimary} mt-4`} onClick={() => setGerarOpen(true)}>
                                <Sparkles size={16} aria-hidden="true" />
                                Gerar mensalidades
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                                <tr>
                                    <th className="px-4 py-2.5">Aluno</th>
                                    {!mes ? <th className="px-4 py-2.5">Mês</th> : null}
                                    <th className="px-4 py-2.5">Vencimento</th>
                                    <th className="px-4 py-2.5 text-right">Total</th>
                                    <th className="px-4 py-2.5 text-right">Pago</th>
                                    <th className="px-4 py-2.5 text-right">Em dívida</th>
                                    <th className="px-4 py-2.5">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mensalidades.map((m) => (
                                    <tr
                                        key={m.id}
                                        className="cursor-pointer transition hover:bg-slate-50"
                                        onClick={() => setSelectedId(m.id)}
                                    >
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                className="text-left font-medium text-slate-800 hover:underline focus-visible:underline focus-visible:outline-none"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedId(m.id);
                                                }}
                                            >
                                                {m.aluno}
                                            </button>
                                            <p className="text-xs text-slate-500">{m.encarregado || 'Sem encarregado'}</p>
                                        </td>
                                        {!mes ? <td className="px-4 py-3 text-slate-600">{formatMes(m.mes, { short: true })}</td> : null}
                                        <td className="px-4 py-3 tabular-nums text-slate-600">{formatDate(m.dataVencimento)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-800">{formatMoney(m.valorTotal)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatMoney(m.valorPago)}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${m.valorEmDivida > 0 && m.estado !== 'anulada' ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {m.estado === 'anulada' ? '—' : formatMoney(m.valorEmDivida)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <EstadoBadge estado={m.estado} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
                    initialMes={mes || currentMes()}
                    onClose={() => setGerarOpen(false)}
                    onGenerated={(result, mesGerado) => {
                        setGerarOpen(false);
                        setNotice(result.message);
                        updateParams({ mes: mesGerado, estado: null });
                        refresh();
                    }}
                />
            ) : null}

            {novaOpen ? (
                <NovaMensalidadeModal
                    open
                    initialMes={mes || currentMes()}
                    onClose={() => setNovaOpen(false)}
                    onCreated={(mensalidade) => {
                        setNovaOpen(false);
                        setNotice('Mensalidade criada.');
                        refresh();
                        setSelectedId(mensalidade.id);
                    }}
                />
            ) : null}
        </section>
    );
}
