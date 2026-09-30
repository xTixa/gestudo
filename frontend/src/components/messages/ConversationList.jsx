import { Inbox, Loader2, MessagesSquare } from 'lucide-react';
import { dataCurta, iniciais, tituloConversa } from '../../utils/messages';

/**
 * Lista de conversas (página de mensagens e doca). `compact` reduz
 * espaçamentos para caber na doca do canto inferior direito.
 */
export default function ConversationList({
    conversas,
    loading,
    error,
    emptyMessage,
    idAtiva = null,
    onSelect,
    compact = false,
}) {
    if (loading) {
        return (
            <div className="flex justify-center py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    if (error) {
        return <p className="px-4 py-10 text-center text-sm text-red-600">{error}</p>;
    }

    if (!conversas.length) {
        return (
            <div className="flex flex-col items-center px-6 py-12 text-center text-slate-500">
                <Inbox size={28} className="mb-2 text-slate-300" />
                <p className="text-sm">{emptyMessage}</p>
            </div>
        );
    }

    const avatar = compact ? 'h-9 w-9' : 'h-10 w-10';

    return (
        <ul className="divide-y divide-slate-100">
            {conversas.map((conversa) => {
                const ativa = conversa.id === idAtiva;
                const naoLida = conversa.naoLidas > 0;
                return (
                    <li key={conversa.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(conversa)}
                            aria-current={ativa ? 'true' : undefined}
                            className={`flex w-full gap-3 text-left transition ${
                                compact ? 'px-3 py-2.5' : 'px-4 py-3'
                            } ${ativa ? 'bg-cyan-50' : 'hover:bg-slate-50'}`}
                        >
                            <span
                                className={`flex ${avatar} shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600`}
                            >
                                {conversa.participantes.length > 1 ? (
                                    <MessagesSquare size={16} />
                                ) : (
                                    iniciais(conversa.participantes[0]?.nome)
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                    <span
                                        className={`truncate text-sm ${
                                            naoLida ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                                        }`}
                                    >
                                        {tituloConversa(conversa)}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-slate-400">
                                        {dataCurta(conversa.ultimaMensagemEm)}
                                    </span>
                                </span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                    <span className={`truncate text-xs ${naoLida ? 'text-slate-700' : 'text-slate-500'}`}>
                                        {conversa.ultimaMensagem
                                            ? `${conversa.ultimaMensagem.minha ? 'Eu: ' : ''}${conversa.ultimaMensagem.preview}`
                                            : ''}
                                    </span>
                                    {naoLida ? (
                                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 px-1.5 text-[10px] font-semibold text-white">
                                            {conversa.naoLidas > 99 ? '99+' : conversa.naoLidas}
                                            <span className="sr-only"> por ler</span>
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
