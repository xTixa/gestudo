import { useState } from 'react';
import { UserRound, X } from 'lucide-react';

// Foto de perfil com o ícone de pessoa quando não há foto ou ela falha.
function FotoPerfil({ imagem, alt }) {
    const [falhou, setFalhou] = useState(false);
    const mostrarFoto = Boolean(imagem) && !falhou;

    return (
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400">
            {mostrarFoto ? (
                <img
                    src={imagem}
                    alt={alt}
                    className="h-full w-full object-cover"
                    onError={() => setFalhou(true)}
                />
            ) : (
                <div>
                    <UserRound size={36} strokeWidth={1.8} />
                </div>
            )}
        </div>
    );
}

/**
 * Foto e nome no topo da ficha. entidade: 'aluno' | 'professor'.
 */
export function PreviewIdentidade({ imagem, nome, entidade, className = '' }) {
    return (
        <div className={`flex items-center gap-4 ${className} pb-2`}>
            <FotoPerfil
                key={imagem}
                imagem={imagem}
                alt={`Foto de perfil do ${entidade}`}
            />

            <div>
                <p className="text-sm font-semibold text-slate-800">{nome}</p>
                <p className="text-xs text-slate-500">
                    {`Preview rápida do ${entidade}`}
                </p>
            </div>
        </div>
    );
}

/**
 * Moldura da ficha rápida (alunos e professores): título, conteúdo e botão
 * Fechar.
 */
export default function PreviewModal({ titulo, onFechar, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            {titulo}
                        </h2>
                        <p className="text-sm text-slate-500">
                            Preview rápida dos dados.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onFechar}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Fechar ficha"
                    >
                        <X size={18} />
                    </button>
                </div>

                {children}

                <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                    <button
                        type="button"
                        onClick={onFechar}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
