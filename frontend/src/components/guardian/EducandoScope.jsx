import { AlertCircle, UserRound, Users } from 'lucide-react';
import { useEducandos } from './useEducandos';

export function EducandoSelector({ educandos, selected, onChange }) {
    if (!selected) return null;

    if (educandos.length === 1) {
        return (
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                <UserRound size={16} className="text-slate-400" />
                {selected.nome}
            </span>
        );
    }

    return (
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
            <Users size={16} className="text-slate-400" />
            <span className="sr-only">Educando</span>
            <select
                value={selected.idAluno}
                onChange={(event) => onChange(Number(event.target.value))}
                className="bg-transparent py-0.5 pr-1 font-semibold text-slate-700 outline-none"
            >
                {educandos.map((item) => (
                    <option key={item.idAluno} value={item.idAluno}>
                        {item.nome}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function EducandosEmpty({ error }) {
    return (
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                {error ? <AlertCircle size={24} /> : <Users size={24} />}
            </span>
            <h1 className="mt-4 text-lg font-semibold text-slate-900">
                {error ? 'Não foi possível carregar os educandos' : 'Sem educandos associados'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
                {error ||
                    'Ainda não há alunos associados à sua conta. Se isto não estiver certo, contacte o centro.'}
            </p>
        </div>
    );
}

/**
 * Carrega os educandos e chama `children(educando, seletor)` com o educando
 * selecionado. Trata os estados de carregamento, erro e lista vazia.
 */
export default function EducandoScope({ children }) {
    const { loading, error, educandos, selected, setSelectedId } = useEducandos();

    if (loading) {
        return <p className="text-sm text-slate-500">A carregar…</p>;
    }

    if (error || !selected) {
        return <EducandosEmpty error={error} />;
    }

    const selector = (
        <EducandoSelector
            educandos={educandos}
            selected={selected}
            onChange={setSelectedId}
        />
    );

    return children(selected, selector);
}
