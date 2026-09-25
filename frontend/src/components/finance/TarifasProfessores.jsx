import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiGet, apiPatch } from '../../utils/api';
import { cardClass } from './financeUi';

function keyOf(idProfessor, idModalidade) {
    return `${idProfessor ?? 0}:${idModalidade}`;
}

/**
 * Grelha de valores por hora: linha "Valor geral" (vale para todos os
 * professores) e uma linha por professor para exceções. Célula vazia na
 * linha de um professor = usa o valor geral. Guarda ao sair do campo.
 */
export default function TarifasProfessores({ onChanged }) {
    const [data, setData] = useState(null);
    const [values, setValues] = useState({});
    const [saved, setSaved] = useState({});
    const [status, setStatus] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        apiGet('/api/gestor/financeiro/professores/tarifas')
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || 'Erro ao carregar os valores por hora.');
                return json;
            })
            .then((json) => {
                if (!active) return;
                const initial = {};
                json.tarifas.forEach((t) => {
                    initial[keyOf(t.idProfessor, t.idModalidade)] = t.valorHora.toFixed(2);
                });
                setData(json);
                setValues(initial);
                setSaved(initial);
            })
            .catch((err) => active && setError(err.message));
        return () => {
            active = false;
        };
    }, []);

    async function save(idProfessor, idModalidade) {
        const key = keyOf(idProfessor, idModalidade);
        const raw = String(values[key] ?? '').trim().replace(',', '.');
        if (raw === String(saved[key] ?? '')) return;

        if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
            setStatus((s) => ({ ...s, [key]: 'erro' }));
            return;
        }

        setStatus((s) => ({ ...s, [key]: 'a-guardar' }));
        try {
            const res = await apiPatch('/api/gestor/financeiro/professores/tarifas', {
                id_professor: idProfessor,
                id_modalidade: idModalidade,
                valor_hora: raw === '' ? null : Number(raw),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.message || 'Erro ao guardar.');
            const normalized = raw === '' ? '' : Number(raw).toFixed(2);
            setValues((v) => ({ ...v, [key]: normalized }));
            setSaved((v) => ({ ...v, [key]: normalized }));
            setStatus((s) => ({ ...s, [key]: 'ok' }));
            onChanged?.();
        } catch (err) {
            setError(err.message);
            setStatus((s) => ({ ...s, [key]: 'erro' }));
        }
    }

    if (error && !data) return <p className="text-sm text-rose-600">{error}</p>;
    if (!data) return <p className="text-sm text-slate-500">A carregar...</p>;

    if (data.modalidades.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Crie primeiro as modalidades (ex.: Individual, Grupo) em Catálogo › Modalidades.
            </p>
        );
    }

    const rows = [{ id: null, nome: 'Valor geral', geral: true }, ...data.professores];

    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-500">
                Valor pago ao professor por hora de aula, por modalidade. A linha <strong className="font-medium text-slate-700">Valor geral</strong> aplica-se a todos; preencha a linha de um professor só se ele tiver um valor diferente. As alterações não afetam meses já fechados.
            </p>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <div className={`${cardClass} overflow-x-auto`}>
                <table className="w-full min-w-[560px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                        <tr>
                            <th className="px-4 py-2.5">Professor</th>
                            {data.modalidades.map((m) => (
                                <th key={m.id} className="px-4 py-2.5 text-right">{m.nome} (€/h)</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row) => (
                            <tr key={row.id ?? 'geral'} className={row.geral ? 'bg-slate-50/60' : ''}>
                                <th scope="row" className={`px-4 py-2 text-left ${row.geral ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                    {row.nome}
                                </th>
                                {data.modalidades.map((m) => {
                                    const key = keyOf(row.id, m.id);
                                    const geral = values[keyOf(null, m.id)];
                                    const st = status[key];
                                    return (
                                        <td key={m.id} className="px-4 py-2">
                                            <div className="relative ml-auto w-28">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    aria-label={`${row.nome} — ${m.nome} (€/h)`}
                                                    className={`h-9 w-full rounded-lg border bg-white pl-3 pr-7 text-right text-sm tabular-nums text-slate-800 placeholder:text-slate-300 transition focus:outline-none focus:ring-4 ${
                                                        st === 'erro'
                                                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10'
                                                            : 'border-slate-200 hover:border-slate-300 focus:border-cyan-500 focus:ring-cyan-500/10'
                                                    }`}
                                                    placeholder={row.geral ? '—' : geral ? `${geral} (geral)` : '—'}
                                                    value={values[key] ?? ''}
                                                    onChange={(e) => {
                                                        setValues((v) => ({ ...v, [key]: e.target.value }));
                                                        setStatus((s) => ({ ...s, [key]: undefined }));
                                                    }}
                                                    onBlur={() => save(row.id, m.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') e.currentTarget.blur();
                                                    }}
                                                />
                                                {st === 'ok' ? (
                                                    <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600" aria-label="Guardado" />
                                                ) : null}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
