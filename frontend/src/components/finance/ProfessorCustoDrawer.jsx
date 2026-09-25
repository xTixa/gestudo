import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Lock } from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import { Drawer } from './Overlay';
import CustoEstadoBadge from './CustoEstadoBadge';
import {
    METODOS_PAGAMENTO,
    formatDate,
    formatHoras,
    formatMes,
    formatMoney,
    metodoLabel,
    todayISO,
} from './financeFormat';
import { btnDanger, btnGhost, btnPrimary, btnSecondary, inputClass, labelClass } from './financeUi';

async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.errors?.join?.(' ') || 'Ocorreu um erro.');
    return data;
}

/** Detalhe das sessões de um professor num mês, com fecho e pagamento. */
export default function ProfessorCustoDrawer({ idProfessor, mes, onClose, onChanged }) {
    const [detalhe, setDetalhe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [busy, setBusy] = useState(false);
    const [pagamento, setPagamento] = useState(null);
    const [anularOpen, setAnularOpen] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;
        apiGet(`/api/gestor/financeiro/professores/${idProfessor}?mes=${mes}`)
            .then(readJson)
            .then((data) => active && setDetalhe(data))
            .catch((err) => active && setError(err.message))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [idProfessor, mes, reloadKey]);

    const run = useCallback(
        async (action) => {
            setBusy(true);
            setError('');
            setFeedback('');
            try {
                const message = await action();
                setFeedback(message || '');
                setReloadKey((k) => k + 1);
                onChanged?.();
            } catch (err) {
                setError(err.message);
            } finally {
                setBusy(false);
            }
        },
        [onChanged]
    );

    const d = detalhe;
    const fecho = d?.fecho;
    const estado = fecho ? fecho.estado : d?.linhas?.length ? 'em_aberto' : 'sem_sessoes';
    const podeFechar = d && !fecho && d.linhas.length > 0 && d.semTarifa.length === 0;

    const footer = d && !loading ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
            {fecho ? (
                <button type="button" className={btnGhost} onClick={() => setAnularOpen(true)}>
                    <Ban size={14} aria-hidden="true" />
                    {fecho.pago ? 'Anular pagamento e reabrir' : 'Reabrir mês'}
                </button>
            ) : (
                <span />
            )}
            {podeFechar ? (
                <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy}
                    onClick={() =>
                        run(async () => {
                            const data = await readJson(
                                await apiPost('/api/gestor/financeiro/professores/fechar', {
                                    mes,
                                    ids_professores: [idProfessor],
                                })
                            );
                            return data.message;
                        })
                    }
                >
                    <Lock size={15} aria-hidden="true" />
                    Fechar mês
                </button>
            ) : fecho && !fecho.pago && !pagamento ? (
                <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => setPagamento({ data_pagamento: todayISO(), metodo: 'transferencia', referencia: '', observacoes: '' })}
                >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Marcar como pago
                </button>
            ) : null}
        </div>
    ) : null;

    return (
        <Drawer
            open
            onClose={onClose}
            title={d ? d.professor : 'Professor'}
            subtitle={
                d ? (
                    <span className="flex flex-wrap items-center gap-2">
                        {formatMes(d.mes)}
                        <CustoEstadoBadge estado={estado} />
                    </span>
                ) : null
            }
            footer={footer}
        >
            {loading ? <p className="text-sm text-slate-500">A carregar...</p> : null}
            {error ? (
                <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}
            {feedback ? (
                <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{feedback}</p>
            ) : null}

            {d && !loading ? (
                <>
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4">
                        <div>
                            <p className="text-xs text-slate-500">Sessões</p>
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{fecho ? fecho.sessoes : d.totais.sessoes}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Horas</p>
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatHoras(fecho ? fecho.minutos : d.totais.minutos)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">A pagar</p>
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatMoney(fecho ? fecho.valor : d.totais.valor)}</p>
                        </div>
                    </div>

                    {d.semTarifa.length > 0 ? (
                        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            Falta definir o valor por hora para: {d.semTarifa.join(', ')}. Defina-o no separador “Valores por hora” para poder fechar o mês.
                        </p>
                    ) : null}

                    {!fecho && d.linhas.length > 0 && d.semTarifa.length === 0 ? (
                        <p className="mt-4 text-xs text-slate-500">
                            Valores calculados com as tarifas atuais. Ao fechar o mês ficam gravados e deixam de mudar.
                        </p>
                    ) : null}

                    {fecho?.pago ? (
                        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                            Pago a {formatDate(fecho.dataPagamento)} · {metodoLabel(fecho.metodo)}
                            {fecho.referencia ? ` · ${fecho.referencia}` : ''}
                        </p>
                    ) : null}

                    {anularOpen ? (
                        <form
                            className="mt-4 space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                run(async () => {
                                    const data = await readJson(
                                        await apiPost(`/api/gestor/financeiro/professores/pagamentos/${fecho.id}/anular`, { motivo: motivo.trim() })
                                    );
                                    setAnularOpen(false);
                                    setMotivo('');
                                    return data.message;
                                });
                            }}
                        >
                            <label className={labelClass} htmlFor="motivo-fecho">
                                {fecho?.pago ? 'Anular o pagamento e reabrir o mês' : 'Reabrir o mês deste professor'}
                            </label>
                            <input
                                id="motivo-fecho"
                                className={inputClass}
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder="Motivo (obrigatório)"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" className={btnSecondary} onClick={() => setAnularOpen(false)}>Cancelar</button>
                                <button type="submit" className={btnDanger} disabled={busy || motivo.trim().length < 3}>Confirmar</button>
                            </div>
                        </form>
                    ) : null}

                    {pagamento ? (
                        <form
                            className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                run(async () => {
                                    const data = await readJson(
                                        await apiPost(`/api/gestor/financeiro/professores/pagamentos/${fecho.id}/pagar`, pagamento)
                                    );
                                    setPagamento(null);
                                    return data.message;
                                });
                            }}
                        >
                            <p className="text-sm font-semibold text-slate-900">Pagamento de {formatMoney(fecho.valor)}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass} htmlFor="pp-data">Data</label>
                                    <input id="pp-data" type="date" required max={todayISO()} className={inputClass} value={pagamento.data_pagamento} onChange={(e) => setPagamento({ ...pagamento, data_pagamento: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClass} htmlFor="pp-metodo">Método</label>
                                    <select id="pp-metodo" className={inputClass} value={pagamento.metodo} onChange={(e) => setPagamento({ ...pagamento, metodo: e.target.value })}>
                                        {METODOS_PAGAMENTO.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass} htmlFor="pp-ref">Referência</label>
                                    <input id="pp-ref" className={inputClass} placeholder="Opcional" value={pagamento.referencia} onChange={(e) => setPagamento({ ...pagamento, referencia: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" className={btnSecondary} onClick={() => setPagamento(null)}>Cancelar</button>
                                <button type="submit" className={btnPrimary} disabled={busy}>{busy ? 'A registar...' : 'Registar pagamento'}</button>
                            </div>
                        </form>
                    ) : null}

                    <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Sessões dadas</h3>
                    {d.linhas.length === 0 ? (
                        <p className="text-sm text-slate-500">Sem sessões com presenças marcadas neste mês.</p>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Data</th>
                                        <th className="px-3 py-2">Serviço</th>
                                        <th className="px-3 py-2 text-right">Duração</th>
                                        <th className="px-3 py-2 text-right">€/h</th>
                                        <th className="px-3 py-2 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {d.linhas.map((l, i) => (
                                        <tr key={`${l.idServico}-${l.data}-${i}`}>
                                            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                                                {formatDate(l.data)}
                                                {l.horaInicio ? <span className="block text-xs text-slate-400">{l.horaInicio}</span> : null}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="block text-slate-800">{l.descricao}</span>
                                                <span className="block text-xs text-slate-500">{l.modalidade || 'Sem modalidade'}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatHoras(l.minutos)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{l.valorHora === null ? '—' : formatMoney(l.valorHora)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{l.valor === null ? '—' : formatMoney(l.valor)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : null}
        </Drawer>
    );
}
