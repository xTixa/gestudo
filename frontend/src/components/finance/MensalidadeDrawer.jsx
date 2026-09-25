import { useCallback, useEffect, useState } from 'react';
import { Ban, Pencil, Plus, Trash2, User, Wallet } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../utils/api';
import { Drawer } from './Overlay';
import EstadoBadge from './EstadoBadge';
import {
    METODOS_PAGAMENTO,
    formatDate,
    formatMes,
    formatMoney,
    metodoLabel,
    todayISO,
} from './financeFormat';
import {
    btnDanger,
    btnGhost,
    btnPrimary,
    btnSecondary,
    inputClass,
    labelClass,
} from './financeUi';

async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.message || data?.errors?.join?.(' ') || 'Ocorreu um erro.');
    }
    return data;
}

function Section({ title, action, children }) {
    return (
        <section className="mt-6 first:mt-0">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

function MotivoForm({ label, onCancel, onConfirm, busy }) {
    const [motivo, setMotivo] = useState('');
    return (
        <form
            className="mt-3 space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3"
            onSubmit={(event) => {
                event.preventDefault();
                onConfirm(motivo.trim());
            }}
        >
            <label className={labelClass} htmlFor="motivo-anulacao">
                {label}
            </label>
            <input
                id="motivo-anulacao"
                className={inputClass}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Motivo (obrigatório)"
                autoFocus
            />
            <div className="flex justify-end gap-2">
                <button type="button" className={btnSecondary} onClick={onCancel}>
                    Cancelar
                </button>
                <button type="submit" className={btnDanger} disabled={busy || motivo.trim().length < 3}>
                    Confirmar anulação
                </button>
            </div>
        </form>
    );
}

export default function MensalidadeDrawer({ idMensalidade, onClose, onChanged }) {
    const [mensalidade, setMensalidade] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [busy, setBusy] = useState(false);
    const [editingLinhas, setEditingLinhas] = useState(null);
    const [editingVencimento, setEditingVencimento] = useState(null);
    const [anularMensalidadeOpen, setAnularMensalidadeOpen] = useState(false);
    const [anularPagamentoId, setAnularPagamentoId] = useState(null);
    const [pagamento, setPagamento] = useState(null);

    const open = Boolean(idMensalidade);

    const applyResult = useCallback(
        (data, message) => {
            setMensalidade(data.mensalidade);
            setFeedback(message || data.message || '');
            setError('');
            onChanged?.(data.mensalidade);
        },
        [onChanged]
    );

    // O componente pai monta um painel novo por mensalidade (key={id}), por
    // isso o estado já começa limpo; aqui só carregamos os dados.
    useEffect(() => {
        if (!idMensalidade) return undefined;
        let active = true;

        apiGet(`/api/gestor/financeiro/mensalidades/${idMensalidade}`)
            .then(readJson)
            .then((data) => active && setMensalidade(data.mensalidade))
            .catch((err) => active && setError(err.message))
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [idMensalidade]);

    async function run(action) {
        setBusy(true);
        setError('');
        setFeedback('');
        try {
            await action();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    const m = mensalidade;
    const pagamentosAtivos = m?.pagamentos?.filter((p) => !p.anulado) || [];
    const anulada = m?.estado === 'anulada';
    const podeEditarValores = m && !anulada && pagamentosAtivos.length === 0;
    const podePagar = m && !anulada && m.valorEmDivida > 0;

    function startPagamento() {
        setPagamento({
            valor: m.valorEmDivida.toFixed(2),
            data_pagamento: todayISO(),
            metodo: 'numerario',
            referencia: '',
            observacoes: '',
        });
    }

    const footer = m && !anulada && !loading ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
            {pagamentosAtivos.length === 0 ? (
                <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setAnularMensalidadeOpen(true)}
                >
                    <Ban size={14} aria-hidden="true" />
                    Anular mensalidade
                </button>
            ) : (
                <span />
            )}
            {podePagar && !pagamento ? (
                <button type="button" className={btnPrimary} onClick={startPagamento}>
                    <Wallet size={16} aria-hidden="true" />
                    Registar pagamento
                </button>
            ) : null}
        </div>
    ) : null;

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={m ? m.aluno : 'Mensalidade'}
            subtitle={
                m ? (
                    <span className="flex flex-wrap items-center gap-2">
                        {formatMes(m.mes)}
                        <EstadoBadge estado={m.estado} />
                    </span>
                ) : null
            }
            footer={footer}
        >
            {loading ? <p className="text-sm text-slate-500">A carregar...</p> : null}

            {error ? (
                <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                </p>
            ) : null}
            {feedback ? (
                <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {feedback}
                </p>
            ) : null}

            {m && !loading ? (
                <>
                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4">
                        <div>
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatMoney(m.valorTotal)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Pago</p>
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatMoney(m.valorPago)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Em dívida</p>
                            <p className={`mt-0.5 text-lg font-semibold ${m.valorEmDivida > 0 && !anulada ? 'text-rose-600' : 'text-slate-900'}`}>
                                {formatMoney(anulada ? 0 : m.valorEmDivida)}
                            </p>
                        </div>
                    </div>

                    {anulada ? (
                        <p className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
                            Anulada{m.motivoAnulacao ? `: ${m.motivoAnulacao}` : '.'}
                        </p>
                    ) : null}

                    {anularMensalidadeOpen ? (
                        <MotivoForm
                            label="Anular esta mensalidade"
                            busy={busy}
                            onCancel={() => setAnularMensalidadeOpen(false)}
                            onConfirm={(motivo) =>
                                run(async () => {
                                    const data = await readJson(
                                        await apiPost(`/api/gestor/financeiro/mensalidades/${m.id}/anular`, { motivo })
                                    );
                                    setAnularMensalidadeOpen(false);
                                    applyResult(data);
                                })
                            }
                        />
                    ) : null}

                    {/* Registar pagamento */}
                    {pagamento ? (
                        <form
                            className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                run(async () => {
                                    const data = await readJson(
                                        await apiPost(`/api/gestor/financeiro/mensalidades/${m.id}/pagamentos`, {
                                            ...pagamento,
                                            valor: Number(pagamento.valor),
                                        })
                                    );
                                    setPagamento(null);
                                    applyResult(data);
                                });
                            }}
                        >
                            <p className="text-sm font-semibold text-slate-900">Registar pagamento</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass} htmlFor="pag-valor">Valor (€)</label>
                                    <input
                                        id="pag-valor"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={m.valorEmDivida}
                                        required
                                        className={inputClass}
                                        value={pagamento.valor}
                                        onChange={(e) => setPagamento({ ...pagamento, valor: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass} htmlFor="pag-data">Data</label>
                                    <input
                                        id="pag-data"
                                        type="date"
                                        required
                                        max={todayISO()}
                                        className={inputClass}
                                        value={pagamento.data_pagamento}
                                        onChange={(e) => setPagamento({ ...pagamento, data_pagamento: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass} htmlFor="pag-metodo">Método</label>
                                    <select
                                        id="pag-metodo"
                                        className={inputClass}
                                        value={pagamento.metodo}
                                        onChange={(e) => setPagamento({ ...pagamento, metodo: e.target.value })}
                                    >
                                        {METODOS_PAGAMENTO.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass} htmlFor="pag-ref">Referência</label>
                                    <input
                                        id="pag-ref"
                                        className={inputClass}
                                        placeholder="Opcional"
                                        value={pagamento.referencia}
                                        onChange={(e) => setPagamento({ ...pagamento, referencia: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="pag-obs">Observações</label>
                                <input
                                    id="pag-obs"
                                    className={inputClass}
                                    placeholder="Opcional"
                                    value={pagamento.observacoes}
                                    onChange={(e) => setPagamento({ ...pagamento, observacoes: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" className={btnSecondary} onClick={() => setPagamento(null)}>
                                    Cancelar
                                </button>
                                <button type="submit" className={btnPrimary} disabled={busy}>
                                    {busy ? 'A registar...' : 'Registar'}
                                </button>
                            </div>
                        </form>
                    ) : null}

                    {/* Encarregado */}
                    <Section title="Pagador (encarregado de educação)">
                        <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <User size={16} aria-hidden="true" />
                            </span>
                            <div className="min-w-0 text-sm">
                                <p className="font-medium text-slate-800">{m.encarregado || 'Sem encarregado associado'}</p>
                                <p className="truncate text-slate-500">
                                    {[m.encarregadoEmail, m.encarregadoNif ? `NIF ${m.encarregadoNif}` : null]
                                        .filter(Boolean)
                                        .join(' · ') || '—'}
                                </p>
                            </div>
                        </div>
                    </Section>

                    {/* Linhas */}
                    <Section
                        title="Serviços"
                        action={
                            podeEditarValores && !editingLinhas ? (
                                <button
                                    type="button"
                                    className={btnGhost}
                                    onClick={() =>
                                        setEditingLinhas(
                                            m.linhas.map((l) => ({
                                                descricao: l.descricao,
                                                valor: l.valor.toFixed(2),
                                                id_inscricao: l.idInscricao,
                                            }))
                                        )
                                    }
                                >
                                    <Pencil size={13} aria-hidden="true" />
                                    Editar
                                </button>
                            ) : null
                        }
                    >
                        {editingLinhas ? (
                            <form
                                className="space-y-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    run(async () => {
                                        const data = await readJson(
                                            await apiPatch(`/api/gestor/financeiro/mensalidades/${m.id}`, {
                                                linhas: editingLinhas.map((l) => ({ ...l, valor: Number(l.valor) })),
                                            })
                                        );
                                        setEditingLinhas(null);
                                        applyResult(data);
                                    });
                                }}
                            >
                                {editingLinhas.map((linha, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            aria-label={`Descrição da linha ${index + 1}`}
                                            className={inputClass}
                                            value={linha.descricao}
                                            required
                                            onChange={(e) =>
                                                setEditingLinhas(editingLinhas.map((l, i) => (i === index ? { ...l, descricao: e.target.value } : l)))
                                            }
                                        />
                                        <input
                                            aria-label={`Valor da linha ${index + 1}`}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            required
                                            className={`${inputClass} w-28 shrink-0 text-right`}
                                            value={linha.valor}
                                            onChange={(e) =>
                                                setEditingLinhas(editingLinhas.map((l, i) => (i === index ? { ...l, valor: e.target.value } : l)))
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-30"
                                            aria-label={`Remover linha ${index + 1}`}
                                            disabled={editingLinhas.length === 1}
                                            onClick={() => setEditingLinhas(editingLinhas.filter((_, i) => i !== index))}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className={btnGhost}
                                    onClick={() => setEditingLinhas([...editingLinhas, { descricao: '', valor: '0.00', id_inscricao: null }])}
                                >
                                    <Plus size={13} aria-hidden="true" />
                                    Adicionar linha
                                </button>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                    <span className="text-sm text-slate-600">
                                        Novo total:{' '}
                                        <strong className="text-slate-900">
                                            {formatMoney(editingLinhas.reduce((s, l) => s + (Number(l.valor) || 0), 0))}
                                        </strong>
                                    </span>
                                    <div className="flex gap-2">
                                        <button type="button" className={btnSecondary} onClick={() => setEditingLinhas(null)}>
                                            Cancelar
                                        </button>
                                        <button type="submit" className={btnPrimary} disabled={busy}>
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                {m.linhas.map((linha) => (
                                    <li key={linha.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                        <span className="text-slate-700">{linha.descricao}</span>
                                        <span className="shrink-0 tabular-nums font-medium text-slate-900">{formatMoney(linha.valor)}</span>
                                    </li>
                                ))}
                                <li className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2.5 text-sm">
                                    <span className="font-medium text-slate-700">Total</span>
                                    <span className="tabular-nums font-semibold text-slate-900">{formatMoney(m.valorTotal)}</span>
                                </li>
                            </ul>
                        )}
                        {!podeEditarValores && !anulada ? (
                            <p className="mt-2 text-xs text-slate-500">
                                Os valores não podem ser alterados porque já existem pagamentos. Anule-os primeiro, se necessário.
                            </p>
                        ) : null}
                    </Section>

                    {/* Vencimento */}
                    <Section
                        title="Vencimento"
                        action={
                            !anulada && editingVencimento === null ? (
                                <button type="button" className={btnGhost} onClick={() => setEditingVencimento(m.dataVencimento)}>
                                    <Pencil size={13} aria-hidden="true" />
                                    Alterar
                                </button>
                            ) : null
                        }
                    >
                        {editingVencimento !== null ? (
                            <form
                                className="flex items-center gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    run(async () => {
                                        const data = await readJson(
                                            await apiPatch(`/api/gestor/financeiro/mensalidades/${m.id}`, {
                                                data_vencimento: editingVencimento,
                                            })
                                        );
                                        setEditingVencimento(null);
                                        applyResult(data);
                                    });
                                }}
                            >
                                <input
                                    type="date"
                                    aria-label="Data de vencimento"
                                    required
                                    className={`${inputClass} max-w-[12rem]`}
                                    value={editingVencimento}
                                    onChange={(e) => setEditingVencimento(e.target.value)}
                                />
                                <button type="button" className={btnSecondary} onClick={() => setEditingVencimento(null)}>
                                    Cancelar
                                </button>
                                <button type="submit" className={btnPrimary} disabled={busy}>
                                    Guardar
                                </button>
                            </form>
                        ) : (
                            <p className="text-sm text-slate-700">{formatDate(m.dataVencimento)}</p>
                        )}
                    </Section>

                    {/* Pagamentos */}
                    <Section title="Pagamentos">
                        {m.pagamentos.length === 0 ? (
                            <p className="text-sm text-slate-500">Ainda não há pagamentos registados.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                {m.pagamentos.map((p) => (
                                    <li key={p.id} className="px-3 py-2.5 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className={p.anulado ? 'text-slate-400 line-through' : ''}>
                                                <span className="font-medium text-slate-800">{formatMoney(p.valor)}</span>
                                                <span className="text-slate-500">
                                                    {' · '}
                                                    {formatDate(p.data)} · {metodoLabel(p.metodo)}
                                                    {p.referencia ? ` · ${p.referencia}` : ''}
                                                </span>
                                            </div>
                                            {!p.anulado && anularPagamentoId !== p.id ? (
                                                <button
                                                    type="button"
                                                    className={btnGhost}
                                                    onClick={() => setAnularPagamentoId(p.id)}
                                                >
                                                    Anular
                                                </button>
                                            ) : null}
                                        </div>
                                        {p.anulado ? (
                                            <p className="mt-0.5 text-xs text-slate-500">Anulado: {p.motivoAnulacao}</p>
                                        ) : p.observacoes ? (
                                            <p className="mt-0.5 text-xs text-slate-500">{p.observacoes}</p>
                                        ) : null}
                                        {anularPagamentoId === p.id ? (
                                            <MotivoForm
                                                label="Anular este pagamento"
                                                busy={busy}
                                                onCancel={() => setAnularPagamentoId(null)}
                                                onConfirm={(motivo) =>
                                                    run(async () => {
                                                        const data = await readJson(
                                                            await apiPost(`/api/gestor/financeiro/pagamentos/${p.id}/anular`, { motivo })
                                                        );
                                                        setAnularPagamentoId(null);
                                                        applyResult(data);
                                                    })
                                                }
                                            />
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </>
            ) : null}
        </Drawer>
    );
}
