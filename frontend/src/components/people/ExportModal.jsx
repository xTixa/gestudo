import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Modal de exportação (alunos ou professores).
 * - entidade: 'alunos' | 'professores' (título e nome de ficheiro por omissão);
 * - formatos: [{ id, label }];
 * - campos (opcional): [{ id, label }] para escolher as colunas a exportar;
 * - onExportar({ formato, nomeFicheiro, campos }): a página faz a exportação e
 *   fecha o modal quando corre bem.
 */
export default function ExportModal({
    entidade,
    formatos,
    campos = null,
    onExportar,
    onFechar,
}) {
    const [formato, setFormato] = useState('csv');
    const [nomeFicheiro, setNomeFicheiro] = useState(entidade);
    const [camposEscolhidos, setCamposEscolhidos] = useState(() =>
        (campos || []).map((campo) => campo.id)
    );

    function handleSubmit(event) {
        event.preventDefault();
        onExportar({ formato, nomeFicheiro, campos: camposEscolhidos });
    }

    function alternarCampo(id, ativo) {
        setCamposEscolhidos((atuais) =>
            ativo ? [...atuais, id] : atuais.filter((atual) => atual !== id)
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            {`Exportar ${entidade}`}
                        </h2>
                        <p className="text-sm text-slate-500">
                            Escolha o formato do ficheiro.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onFechar}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Fechar exportacao"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5"
                >
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">
                            Formato
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {formatos.map((option) => (
                                <label
                                    key={option.id}
                                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                                        formato === option.id
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="export-format"
                                        value={option.id}
                                        checked={formato === option.id}
                                        onChange={(event) =>
                                            setFormato(event.target.value)
                                        }
                                        className="sr-only"
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Nome do ficheiro
                        </label>
                        <input
                            type="text"
                            value={nomeFicheiro}
                            onChange={(event) =>
                                setNomeFicheiro(event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={entidade}
                        />
                    </div>

                    {campos ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">
                                Dados a exportar
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {campos.map((field) => (
                                    <label
                                        key={field.id}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={camposEscolhidos.includes(
                                                field.id
                                            )}
                                            onChange={(event) =>
                                                alternarCampo(
                                                    field.id,
                                                    event.target.checked
                                                )
                                            }
                                            className="h-4 w-4 rounded border-slate-300"
                                        />
                                        {field.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <p className="text-xs text-slate-500">
                        Nos browsers compatíveis, poderá escolher a pasta de
                        gravação. Caso contrário, o ficheiro será descarregado
                        automaticamente.
                    </p>

                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                        <button
                            type="button"
                            onClick={onFechar}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                            Confirmar exportacao
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
