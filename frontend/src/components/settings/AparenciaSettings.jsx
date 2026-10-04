import { useState } from 'react';
import { Bell, Check, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPatch } from '../../utils/api';
import { TEMAS_CENTRO } from '../../theme/temasCentro';
import {
    definirTemaCentroLocal,
    useTemaCentro,
} from '../../theme/aparenciaCentro';

// Amostra de botões, badges e links com a cor escolhida. O atributo
// data-tema aplica a paleta só a este bloco (ver tailwind/coresTema.js).
function PreVisualizacao({ tema }) {
    return (
        <div
            data-tema={tema}
            className="rounded-xl border border-slate-200 bg-slate-50 p-5"
        >
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                Pré-visualização
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
                    Botão principal
                </span>
                <span className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700">
                    Secundário
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Ativo
                </span>
                <span className="text-sm font-medium text-emerald-600 underline underline-offset-2">
                    Ver detalhes
                </span>
                <span className="relative inline-flex rounded-lg bg-white p-2 text-slate-500 ring-1 ring-slate-200">
                    <Bell size={18} aria-hidden="true" />
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-2/3 rounded-full bg-emerald-500" />
            </div>
        </div>
    );
}

export default function AparenciaSettings() {
    const temaGuardado = useTemaCentro();
    // null = sem alterações; a seleção mostrada é derivada do tema guardado.
    const [escolha, setEscolha] = useState(null);
    const [aGuardar, setAGuardar] = useState(false);

    const selecionado = escolha ?? temaGuardado;
    const alterado = selecionado !== temaGuardado;

    function guardar() {
        setAGuardar(true);
        apiPatch('/api/gestor/aparencia', { tema: selecionado })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao guardar a cor.');
                }
                definirTemaCentroLocal(data.tema);
                setEscolha(null);
                toast.success('Cor do centro atualizada.');
            })
            .catch((error) => {
                toast.error(error.message || 'Erro ao guardar a cor.');
            })
            .finally(() => setAGuardar(false));
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="mb-2 text-2xl font-semibold text-slate-800">
                    Aparência
                </h2>
                <p className="text-base text-slate-600">
                    Escolha a cor do centro. Aplica-se a todos os utilizadores:
                    gestores, professores, alunos e encarregados.
                </p>
            </div>

            <fieldset>
                <legend className="mb-3 text-sm font-medium text-slate-700">
                    Cor do tema
                </legend>
                <div
                    role="radiogroup"
                    aria-label="Cor do tema"
                    className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
                >
                    {TEMAS_CENTRO.map((tema) => {
                        const ativo = selecionado === tema.id;
                        return (
                            <button
                                key={tema.id}
                                type="button"
                                role="radio"
                                aria-checked={ativo}
                                onClick={() => setEscolha(tema.id)}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                                    ativo
                                        ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800'
                                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <span
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                    style={{ backgroundColor: tema.amostra }}
                                    aria-hidden="true"
                                >
                                    {ativo ? (
                                        <Check size={15} className="text-white" />
                                    ) : null}
                                </span>
                                {tema.nome}
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            <PreVisualizacao tema={selecionado} />

            <div className="flex flex-wrap items-center justify-end gap-3">
                {alterado ? (
                    <button
                        type="button"
                        onClick={() => setEscolha(null)}
                        disabled={aGuardar}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                        Repor
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={guardar}
                    disabled={!alterado || aGuardar}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {aGuardar ? (
                        <Loader size={16} className="animate-spin" />
                    ) : null}
                    Guardar cor
                </button>
            </div>
        </div>
    );
}
