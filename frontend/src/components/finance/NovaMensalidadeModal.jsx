import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import { Modal } from './Overlay';
import { defaultVencimento, formatMoney } from './financeFormat';
import { btnGhost, btnPrimary, btnSecondary, inputClass, labelClass } from './financeUi';

/**
 * Mensalidade criada à mão — ex.: aluno que entrou a meio do mês, taxa de
 * inscrição ou serviço extra-curricular.
 */
export default function NovaMensalidadeModal({ open, initialMes, initialAlunoId, onClose, onCreated }) {
    const [alunos, setAlunos] = useState([]);
    const [idAluno, setIdAluno] = useState(initialAlunoId ? String(initialAlunoId) : '');
    const [mes, setMes] = useState(initialMes);
    const [vencimento, setVencimento] = useState(defaultVencimento(initialMes));
    const [linhas, setLinhas] = useState([{ descricao: '', valor: '' }]);
    const [observacoes, setObservacoes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        apiGet('/api/gestor/alunos')
            .then((res) => res.json())
            .then((data) => {
                if (!active) return;
                const lista = Array.isArray(data?.alunos) ? data.alunos : [];
                setAlunos(lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt')));
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    const total = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);

    async function handleSubmit(event) {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const response = await apiPost('/api/gestor/financeiro/mensalidades', {
                id_aluno: Number(idAluno),
                mes,
                data_vencimento: vencimento,
                observacoes,
                linhas: linhas.map((l) => ({ descricao: l.descricao, valor: Number(l.valor) })),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.message || 'Não foi possível criar a mensalidade.');
            onCreated?.(data.mensalidade);
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Nova mensalidade"
            description="Para cobranças fora da geração automática: entrada a meio do mês, taxa de inscrição, serviços extra-curriculares."
            footer={
                <>
                    <button type="button" className={btnSecondary} onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" form="nova-mensalidade-form" className={btnPrimary} disabled={busy}>
                        {busy ? 'A criar...' : `Criar (${formatMoney(total)})`}
                    </button>
                </>
            }
        >
            {error ? (
                <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                </p>
            ) : null}

            <form id="nova-mensalidade-form" className="space-y-4" onSubmit={handleSubmit}>
                <div>
                    <label className={labelClass} htmlFor="nova-aluno">Aluno</label>
                    <select
                        id="nova-aluno"
                        required
                        className={inputClass}
                        value={idAluno}
                        onChange={(e) => setIdAluno(e.target.value)}
                    >
                        <option value="">Selecionar aluno...</option>
                        {alunos.map((a) => (
                            <option key={a.id_aluno} value={a.id_aluno}>
                                {a.nome}{a.encarregado ? ` (EE: ${a.encarregado})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass} htmlFor="nova-mes">Mês</label>
                        <input
                            id="nova-mes"
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
                        <label className={labelClass} htmlFor="nova-venc">Vencimento</label>
                        <input
                            id="nova-venc"
                            type="date"
                            required
                            className={inputClass}
                            value={vencimento}
                            onChange={(e) => setVencimento(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <p className={labelClass}>Linhas</p>
                    <div className="space-y-2">
                        {linhas.map((linha, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    aria-label={`Descrição da linha ${index + 1}`}
                                    required
                                    placeholder="Ex.: Taxa de inscrição"
                                    className={inputClass}
                                    value={linha.descricao}
                                    onChange={(e) => setLinhas(linhas.map((l, i) => (i === index ? { ...l, descricao: e.target.value } : l)))}
                                />
                                <input
                                    aria-label={`Valor da linha ${index + 1}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="0,00"
                                    className={`${inputClass} w-28 shrink-0 text-right`}
                                    value={linha.valor}
                                    onChange={(e) => setLinhas(linhas.map((l, i) => (i === index ? { ...l, valor: e.target.value } : l)))}
                                />
                                <button
                                    type="button"
                                    className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-30"
                                    aria-label={`Remover linha ${index + 1}`}
                                    disabled={linhas.length === 1}
                                    onClick={() => setLinhas(linhas.filter((_, i) => i !== index))}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={`${btnGhost} mt-2`}
                        onClick={() => setLinhas([...linhas, { descricao: '', valor: '' }])}
                    >
                        <Plus size={13} aria-hidden="true" />
                        Adicionar linha
                    </button>
                </div>

                <div>
                    <label className={labelClass} htmlFor="nova-obs">Observações</label>
                    <input
                        id="nova-obs"
                        className={inputClass}
                        placeholder="Opcional"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                    />
                </div>
            </form>
        </Modal>
    );
}
