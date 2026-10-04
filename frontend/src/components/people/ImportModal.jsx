import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { getFileAcceptByFormat } from '../../utils/ficheiros';

/**
 * Modal de importação (alunos ou professores).
 * - entidade: 'alunos' | 'professores';
 * - formatos: [{ id, label }];
 * - onImportar(ficheiro, formato): faz a importação; pode devolver
 *   { preview } para mostrar a pré-validação. A página fecha o modal quando
 *   corre bem;
 * - preverImportacao (opcional): (ficheiro, formato) => preview, chamada ao
 *   escolher o ficheiro;
 * - onDescarregarModelo(formato).
 */
export default function ImportModal({
    entidade,
    formatos,
    onImportar,
    preverImportacao = null,
    onDescarregarModelo,
    onFechar,
}) {
    const [formato, setFormato] = useState('csv');
    const [ficheiro, setFicheiro] = useState(null);
    const [preview, setPreview] = useState(null);
    const [aImportar, setAImportar] = useState(false);

    function escolherFicheiro(novo) {
        setFicheiro(novo);
        setPreview(null);
        if (novo && preverImportacao) {
            preverImportacao(novo, formato).then(setPreview);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        setAImportar(true);
        onImportar(ficheiro, formato)
            .then((resultado) => {
                if (resultado?.preview) setPreview(resultado.preview);
            })
            .finally(() => setAImportar(false));
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            {`Importar ${entidade}`}
                        </h2>
                        <p className="text-sm text-slate-500">
                            Escolha formato e ficheiro.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onFechar}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Fechar importacao"
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
                                        name="import-format"
                                        value={option.id}
                                        checked={formato === option.id}
                                        onChange={(event) => {
                                            setFormato(event.target.value);
                                            setFicheiro(null);
                                            setPreview(null);
                                        }}
                                        className="sr-only"
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Ficheiro
                        </label>
                        <input
                            type="file"
                            accept={getFileAcceptByFormat(formato)}
                            onChange={(event) =>
                                escolherFicheiro(event.target.files?.[0] || null)
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                        />
                        {ficheiro ? (
                            <p className="mt-2 text-xs text-slate-500">
                                Selecionado: {ficheiro.name}
                            </p>
                        ) : null}
                        {preview ? (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-xs font-medium text-slate-700">
                                    Pré-validação: {preview.total}{' '}
                                    linha(s), {preview.valid}{' '}
                                    válida(s), {preview.invalid}{' '}
                                    inválida(s)
                                </p>
                                {preview.errors?.length ? (
                                    <ul className="mt-1 space-y-1 text-xs text-rose-700">
                                        {preview.errors.map((item, idx) => (
                                            <li key={`${item.line}-${idx}`}>
                                                Linha {item.line}: {item.reason}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-600">
                                Precisa de ajuda? Descarregue o modelo de
                                importacao.
                            </p>
                            <button
                                type="button"
                                onClick={() => onDescarregarModelo(formato)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                                <Download size={13} /> Modelo
                            </button>
                        </div>
                    </div>

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
                            disabled={aImportar}
                            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                            {aImportar ? 'A importar...' : 'Confirmar importacao'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
