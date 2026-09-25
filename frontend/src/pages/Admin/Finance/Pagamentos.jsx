import { useCallback, useEffect, useState } from 'react';
import { Banknote, Search } from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import MensalidadeDrawer from '../../../components/finance/MensalidadeDrawer';
import {
    METODOS_PAGAMENTO,
    currentMes,
    formatDate,
    formatMes,
    formatMoney,
    metodoLabel,
    todayISO,
} from '../../../components/finance/financeFormat';
import { cardClass, inputClass, labelClass } from '../../../components/finance/financeUi';
import { apiGet } from '../../../utils/api';

export default function PagamentosPage() {
    const [de, setDe] = useState(`${currentMes()}-01`);
    const [ate, setAte] = useState(todayISO());
    const [metodo, setMetodo] = useState('');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [data, setData] = useState({ pagamentos: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
        return () => clearTimeout(timer);
    }, [q]);

    useEffect(() => {
        let active = true;
        const params = new URLSearchParams();
        if (de) params.set('de', de);
        if (ate) params.set('ate', ate);
        if (metodo) params.set('metodo', metodo);
        if (debouncedQ) params.set('q', debouncedQ);

        apiGet(`/api/gestor/financeiro/pagamentos?${params.toString()}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || 'Erro ao carregar pagamentos.');
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
    }, [de, ate, metodo, debouncedQ, reloadKey]);

    const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
    const validos = data.pagamentos.filter((p) => !p.anulado);

    return (
        <section className="space-y-6">
            <AdminPageHeader
                title="Pagamentos"
                subtitle="Todos os pagamentos registados. Para registar um pagamento, abra a mensalidade respetiva."
            />

            <div className={`${cardClass} grid grid-cols-2 gap-3 p-4 lg:grid-cols-[10rem_10rem_12rem_1fr]`}>
                <div>
                    <label className={labelClass} htmlFor="pag-de">De</label>
                    <input id="pag-de" type="date" className={inputClass} value={de} onChange={(e) => setDe(e.target.value)} />
                </div>
                <div>
                    <label className={labelClass} htmlFor="pag-ate">Até</label>
                    <input id="pag-ate" type="date" className={inputClass} value={ate} onChange={(e) => setAte(e.target.value)} />
                </div>
                <div>
                    <label className={labelClass} htmlFor="pag-metodo-f">Método</label>
                    <select id="pag-metodo-f" className={inputClass} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                        <option value="">Todos</option>
                        {METODOS_PAGAMENTO.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div className="col-span-2 lg:col-span-1">
                    <label className={labelClass} htmlFor="pag-q">Pesquisar</label>
                    <div className="relative">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            id="pag-q"
                            className={`${inputClass} pl-9`}
                            placeholder="Aluno, encarregado ou referência..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-slate-500">
                    {validos.length} pagamento{validos.length === 1 ? '' : 's'} no período
                </p>
                <p className="text-sm text-slate-500">
                    Total recebido: <strong className="text-lg font-semibold text-slate-900">{formatMoney(data.total)}</strong>
                </p>
            </div>

            <div className={`${cardClass} overflow-hidden`}>
                {error ? (
                    <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p>
                ) : loading ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">A carregar...</p>
                ) : data.pagamentos.length === 0 ? (
                    <div className="flex flex-col items-center px-5 py-14 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Banknote size={20} aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-sm font-medium text-slate-800">Sem pagamentos neste período.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                                <tr>
                                    <th className="px-4 py-2.5">Data</th>
                                    <th className="px-4 py-2.5">Aluno</th>
                                    <th className="px-4 py-2.5">Mensalidade</th>
                                    <th className="px-4 py-2.5">Método</th>
                                    <th className="px-4 py-2.5">Referência</th>
                                    <th className="px-4 py-2.5 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.pagamentos.map((p) => (
                                    <tr
                                        key={p.id}
                                        className={`cursor-pointer transition hover:bg-slate-50 ${p.anulado ? 'text-slate-400' : ''}`}
                                        onClick={() => setSelectedId(p.idMensalidade)}
                                    >
                                        <td className="px-4 py-3 tabular-nums">{formatDate(p.data)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                className={`text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none ${p.anulado ? '' : 'text-slate-800'}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedId(p.idMensalidade);
                                                }}
                                            >
                                                {p.aluno}
                                            </button>
                                            <p className="text-xs text-slate-500">{p.encarregado || 'Sem encarregado'}</p>
                                        </td>
                                        <td className="px-4 py-3">{formatMes(p.mes)}</td>
                                        <td className="px-4 py-3">{metodoLabel(p.metodo)}</td>
                                        <td className="px-4 py-3">{p.referencia || '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`tabular-nums font-medium ${p.anulado ? 'line-through' : 'text-slate-900'}`}>
                                                {formatMoney(p.valor)}
                                            </span>
                                            {p.anulado ? <p className="text-xs">Anulado</p> : null}
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
        </section>
    );
}
