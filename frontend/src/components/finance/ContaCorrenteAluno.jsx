import { useCallback, useEffect, useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { apiGet } from '../../utils/api';
import EstadoBadge from './EstadoBadge';
import MensalidadeDrawer from './MensalidadeDrawer';
import NovaMensalidadeModal from './NovaMensalidadeModal';
import { currentMes, formatDate, formatMes, formatMoney } from './financeFormat';
import { btnGhost } from './financeUi';

/** Conta corrente do aluno (mensalidades, pagos e em dívida) na ficha. */
export default function ContaCorrenteAluno({ idAluno }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [novaOpen, setNovaOpen] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;
        apiGet(`/api/gestor/financeiro/alunos/${idAluno}/conta-corrente`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || 'Erro ao carregar a conta corrente.');
                return json;
            })
            .then((json) => active && setData(json))
            .catch((err) => active && setError(err.message));
        return () => {
            active = false;
        };
    }, [idAluno, reloadKey]);

    const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
    const totais = data?.totais;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-1 rounded bg-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800">Conta corrente</h2>
                </div>
                <button type="button" className={btnGhost} onClick={() => setNovaOpen(true)}>
                    <FilePlus2 size={14} aria-hidden="true" />
                    Nova mensalidade
                </button>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {!data && !error ? <p className="text-sm text-slate-500">A carregar...</p> : null}

            {data ? (
                <>
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4">
                        <div>
                            <p className="text-xs text-slate-500">Faturado</p>
                            <p className="mt-0.5 font-semibold text-slate-900">{formatMoney(totais.faturado)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Pago</p>
                            <p className="mt-0.5 font-semibold text-slate-900">{formatMoney(totais.pago)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Em dívida</p>
                            <p className={`mt-0.5 font-semibold ${totais.emDivida > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {formatMoney(totais.emDivida)}
                            </p>
                            {totais.vencido > 0 ? (
                                <p className="text-xs text-rose-600">{formatMoney(totais.vencido)} em atraso</p>
                            ) : null}
                        </div>
                    </div>

                    {data.mensalidades.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-500">Ainda não há mensalidades para este aluno.</p>
                    ) : (
                        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {data.mensalidades.map((m) => (
                                <li key={m.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(m.id)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium text-slate-800">{formatMes(m.mes)}</span>
                                            <span className="block text-xs text-slate-500">Vence a {formatDate(m.dataVencimento)}</span>
                                        </span>
                                        <span className="text-right tabular-nums">
                                            <span className="block font-medium text-slate-900">{formatMoney(m.valorTotal)}</span>
                                            {m.valorPago > 0 && m.estado !== 'paga' ? (
                                                <span className="block text-xs text-slate-500">pago {formatMoney(m.valorPago)}</span>
                                            ) : null}
                                        </span>
                                        <span className="w-24 text-right">
                                            <EstadoBadge estado={m.estado} />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            ) : null}

            {selectedId ? (
                <MensalidadeDrawer
                    key={selectedId}
                    idMensalidade={selectedId}
                    onClose={() => setSelectedId(null)}
                    onChanged={refresh}
                />
            ) : null}

            {novaOpen ? (
                <NovaMensalidadeModal
                    open
                    initialMes={currentMes()}
                    initialAlunoId={idAluno}
                    onClose={() => setNovaOpen(false)}
                    onCreated={(mensalidade) => {
                        setNovaOpen(false);
                        refresh();
                        setSelectedId(mensalidade.id);
                    }}
                />
            ) : null}
        </div>
    );
}
