import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiPost } from '../../utils/api';
import { Modal } from './Overlay';
import { defaultVencimento, formatDate, formatMes, formatMoney } from './financeFormat';
import { btnPrimary, btnSecondary, inputClass, labelClass } from './financeUi';

async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.errors?.join?.(' ') || 'Ocorreu um erro.');
    return data;
}

/**
 * Gera as mensalidades de um mês em dois passos: pré-visualizar (não grava
 * nada) e confirmar.
 */
export default function GerarMensalidadesModal({ open, initialMes, onClose, onGenerated }) {
    const [mes, setMes] = useState(initialMes);
    const [vencimento, setVencimento] = useState(defaultVencimento(initialMes));
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const pedido = { mes, data_vencimento: vencimento };

    async function handlePreview(event) {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            setPreview(await readJson(await apiPost('/api/gestor/financeiro/mensalidades/gerar/previsualizar', pedido)));
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function handleConfirm() {
        setBusy(true);
        setError('');
        try {
            const data = await readJson(await apiPost('/api/gestor/financeiro/mensalidades/gerar', pedido));
            onGenerated?.(data, mes);
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    const footer = preview ? (
        <>
            <button type="button" className={btnSecondary} onClick={() => setPreview(null)} disabled={busy}>
                Voltar
            </button>
            <button
                type="button"
                className={btnPrimary}
                onClick={handleConfirm}
                disabled={busy || preview.aCriar.length === 0}
            >
                {busy
                    ? 'A gerar...'
                    : `Gerar ${preview.aCriar.length} mensalidade${preview.aCriar.length === 1 ? '' : 's'}`}
            </button>
        </>
    ) : (
        <>
            <button type="button" className={btnSecondary} onClick={onClose}>
                Cancelar
            </button>
            <button type="submit" form="gerar-form" className={btnPrimary} disabled={busy}>
                {busy ? 'A calcular...' : 'Pré-visualizar'}
            </button>
        </>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            size={preview ? 'lg' : 'md'}
            title="Gerar mensalidades"
            description="Cria uma mensalidade por aluno com os serviços curriculares ativos no mês. Alunos que já têm mensalidade nesse mês são ignorados."
            footer={footer}
        >
            {error ? (
                <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                </p>
            ) : null}

            {!preview ? (
                <form id="gerar-form" className="grid grid-cols-2 gap-3" onSubmit={handlePreview}>
                    <div>
                        <label className={labelClass} htmlFor="gerar-mes">Mês</label>
                        <input
                            id="gerar-mes"
                            type="month"
                            required
                            className={inputClass}
                            value={mes}
                            onChange={(e) => {
                                setMes(e.target.value);
                                if (e.target.value) setVencimento(defaultVencimento(e.target.value));
                            }}
                        />
                    </div>
                    <div>
                        <label className={labelClass} htmlFor="gerar-venc">Data de vencimento</label>
                        <input
                            id="gerar-venc"
                            type="date"
                            required
                            className={inputClass}
                            value={vencimento}
                            onChange={(e) => setVencimento(e.target.value)}
                        />
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-4 py-3">
                        <p className="text-sm text-slate-600">
                            {formatMes(preview.mes)} · vencimento{' '}
                            {formatDate(preview.dataVencimento)}
                        </p>
                        <p className="text-sm text-slate-600">
                            Total a faturar: <strong className="text-base text-slate-900">{formatMoney(preview.total)}</strong>
                        </p>
                    </div>

                    {preview.jaExistentes > 0 ? (
                        <p className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle2 size={16} className="text-slate-400" aria-hidden="true" />
                            {preview.jaExistentes} aluno{preview.jaExistentes === 1 ? ' já tem' : 's já têm'} mensalidade neste mês (não {preview.jaExistentes === 1 ? 'é alterado' : 'são alterados'}).
                        </p>
                    ) : null}

                    {preview.semPreco.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <p className="flex items-center gap-2 font-medium">
                                <AlertTriangle size={16} aria-hidden="true" />
                                {preview.semPreco.length} inscrição{preview.semPreco.length === 1 ? '' : 'ões'} sem preço (não {preview.semPreco.length === 1 ? 'entra' : 'entram'})
                            </p>
                            <ul className="mt-1 list-disc pl-6 text-amber-700">
                                {preview.semPreco.slice(0, 6).map((item) => (
                                    <li key={item.idInscricao}>
                                        {item.aluno} — {item.servico}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1 text-xs text-amber-700">Defina o preço no pacote ou na inscrição do aluno.</p>
                        </div>
                    ) : null}

                    {preview.aCriar.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                            Não há mensalidades novas para gerar neste mês.
                        </p>
                    ) : (
                        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Aluno</th>
                                        <th className="px-3 py-2">Serviços</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {preview.aCriar.map((item) => (
                                        <tr key={item.idAluno}>
                                            <td className="px-3 py-2 align-top">
                                                <p className="font-medium text-slate-800">{item.aluno}</p>
                                                <p className="text-xs text-slate-500">{item.encarregado || 'Sem encarregado'}</p>
                                            </td>
                                            <td className="px-3 py-2 align-top text-slate-600">
                                                {item.linhas.map((l) => (
                                                    <p key={l.id_inscricao}>
                                                        {l.descricao} <span className="text-slate-400">·</span> {formatMoney(l.valor)}
                                                    </p>
                                                ))}
                                            </td>
                                            <td className="px-3 py-2 text-right align-top font-medium tabular-nums text-slate-900">
                                                {formatMoney(item.total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
