/**
 * Confirmação de desativar/reativar ou eliminar um aluno ou professor.
 * Eliminar exige escrever ELIMINAR.
 *
 * modo: 'delete' | 'status'; ativo: estado atual da pessoa (no modo status
 * decide entre "stand by" e "reativar"); entidade: 'aluno' | 'professor'.
 */
export default function ConfirmRowActionModal({
    modo,
    ativo,
    entidade,
    keyword,
    onKeywordChange,
    onCancelar,
    onConfirmar,
    aProcessar,
}) {
    const eliminar = modo === 'delete';
    const idCampo = `confirmar-eliminar-${entidade}-linha`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-950/45"
                onClick={onCancelar}
                aria-label="Fechar confirmação"
            />

            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-200 px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Confirmação
                    </p>
                    <h3
                        className={`mt-1 text-lg font-semibold ${
                            eliminar ? 'text-red-700' : 'text-slate-800'
                        }`}
                    >
                        {eliminar
                            ? `Eliminar ${entidade} definitivamente?`
                            : ativo
                              ? `Colocar ${entidade} em stand by?`
                              : `Reativar ${entidade}?`}
                    </h3>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <p className="text-sm text-slate-600">
                        {eliminar
                            ? `Esta ação é irreversível e remove os dados do ${entidade}. Para continuar, confirma explicitamente abaixo.`
                            : ativo
                              ? `O ${entidade} ficará inativo e deixará de aceder à plataforma até ser reativado.`
                              : `O ${entidade} volta a ter acesso à plataforma.`}
                    </p>

                    {eliminar ? (
                        <div className="space-y-2">
                            <label
                                htmlFor={idCampo}
                                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                            >
                                Escreve ELIMINAR para confirmar
                            </label>
                            <input
                                id={idCampo}
                                type="text"
                                value={keyword}
                                onChange={(event) =>
                                    onKeywordChange(event.target.value || '')
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                placeholder="ELIMINAR"
                                autoComplete="off"
                            />
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                    <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={onCancelar}
                        disabled={aProcessar}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                            eliminar
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-amber-600 hover:bg-amber-700'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        onClick={onConfirmar}
                        disabled={
                            aProcessar || (eliminar && keyword !== 'ELIMINAR')
                        }
                    >
                        {aProcessar
                            ? 'A processar...'
                            : eliminar
                              ? 'Eliminar definitivamente'
                              : ativo
                                ? 'Confirmar stand by'
                                : 'Confirmar reativação'}
                    </button>
                </div>
            </div>
        </div>
    );
}
