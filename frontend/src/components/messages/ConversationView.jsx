import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Loader2, SendHorizontal } from 'lucide-react';
import {
    arquivarConversa,
    enviarMensagem,
    hora,
    iniciais,
    listarMensagens,
    marcarConversaLida,
    papelLabel,
    separadorDia,
    tituloConversa,
} from '../../utils/messages';

const POLL_MS = 10 * 1000;
const LIMITE_CORPO = 5000;

function juntarSemDuplicados(atuais, novas) {
    const vistos = new Set(atuais.map((m) => m.id));
    return [...atuais, ...novas.filter((m) => !vistos.has(m.id))];
}

function chaveDia(valor) {
    const data = new Date(valor);
    return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

/**
 * Uma conversa aberta: histórico (com "carregar anteriores"), atualização
 * periódica e caixa de resposta. O pai usa `key={idConversa}` para que o
 * estado recomece ao mudar de conversa.
 */
export default function ConversationView({ idConversa, arquivada, onBack, onChanged }) {
    const [conversa, setConversa] = useState(null);
    const [mensagens, setMensagens] = useState([]);
    const [temMais, setTemMais] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingAnteriores, setLoadingAnteriores] = useState(false);
    const [error, setError] = useState('');
    const [texto, setTexto] = useState('');
    const [sending, setSending] = useState(false);

    const scrollRef = useRef(null);
    const textareaRef = useRef(null);
    // Como ajustar o scroll depois do próximo render: 'fundo' ou manter posição.
    const scrollPendente = useRef({ tipo: 'fundo' });

    const pertoDoFundo = () => {
        const el = scrollRef.current;
        return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    useLayoutEffect(() => {
        const el = scrollRef.current;
        const pendente = scrollPendente.current;
        if (!el || !pendente) return;
        if (pendente.tipo === 'fundo') {
            el.scrollTop = el.scrollHeight;
        } else if (pendente.tipo === 'manter') {
            el.scrollTop = el.scrollHeight - pendente.alturaAntes + pendente.scrollAntes;
        }
        scrollPendente.current = null;
    }, [mensagens]);

    // Carga inicial + marcar como lida.
    useEffect(() => {
        let ativo = true;
        listarMensagens(idConversa)
            .then((data) => {
                if (!ativo) return;
                scrollPendente.current = { tipo: 'fundo' };
                setConversa(data.conversa);
                setMensagens(data.mensagens);
                setTemMais(data.temMais);
                return marcarConversaLida(idConversa).then(() => onChanged?.());
            })
            .catch((err) => {
                if (ativo) setError(err.message);
            })
            .finally(() => {
                if (ativo) setLoading(false);
            });
        return () => {
            ativo = false;
        };
    }, [idConversa, onChanged]);

    // Atualização periódica: acrescenta mensagens novas no fim.
    useEffect(() => {
        const id = setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const data = await listarMensagens(idConversa, { limit: 30 });
                let chegaramNovas = false;
                setMensagens((atuais) => {
                    const juntas = juntarSemDuplicados(atuais, data.mensagens);
                    chegaramNovas = juntas.length !== atuais.length;
                    if (chegaramNovas && pertoDoFundo()) {
                        scrollPendente.current = { tipo: 'fundo' };
                    }
                    return chegaramNovas ? juntas : atuais;
                });
                if (chegaramNovas) {
                    await marcarConversaLida(idConversa);
                    onChanged?.();
                }
            } catch {
                // Falha temporária: tenta de novo no próximo ciclo.
            }
        }, POLL_MS);
        return () => clearInterval(id);
    }, [idConversa, onChanged]);

    async function carregarAnteriores() {
        if (!mensagens.length) return;
        setLoadingAnteriores(true);
        try {
            const data = await listarMensagens(idConversa, { antes: mensagens[0].id });
            const el = scrollRef.current;
            scrollPendente.current = {
                tipo: 'manter',
                alturaAntes: el?.scrollHeight || 0,
                scrollAntes: el?.scrollTop || 0,
            };
            setMensagens((atuais) => [...data.mensagens, ...atuais]);
            setTemMais(data.temMais);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingAnteriores(false);
        }
    }

    const enviar = useCallback(async () => {
        const corpo = texto.trim();
        if (!corpo || sending) return;
        setSending(true);
        setError('');
        try {
            const mensagem = await enviarMensagem(idConversa, corpo);
            scrollPendente.current = { tipo: 'fundo' };
            setMensagens((atuais) => juntarSemDuplicados(atuais, [mensagem]));
            setTexto('');
            onChanged?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
            textareaRef.current?.focus();
        }
    }, [idConversa, onChanged, sending, texto]);

    function handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void enviar();
        }
    }

    async function alternarArquivo() {
        try {
            await arquivarConversa(idConversa, !arquivada);
            onChanged?.({ fechar: true });
        } catch (err) {
            setError(err.message);
        }
    }

    const participantes = conversa?.participantes || [];
    const emGrupo = participantes.length > 1;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
                    aria-label="Voltar às conversas"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-slate-900">
                        {conversa ? tituloConversa(conversa) : ' '}
                    </h2>
                    <p className="truncate text-xs text-slate-500">
                        {participantes
                            .map((p) => (emGrupo || conversa?.assunto ? p.nome : papelLabel(p.papel)))
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={alternarArquivo}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    title={arquivada ? 'Voltar a mostrar na caixa de entrada' : 'Arquivar conversa'}
                >
                    {arquivada ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    <span className="hidden sm:inline">{arquivada ? 'Desarquivar' : 'Arquivar'}</span>
                </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-slate-400">
                        <Loader2 size={20} className="animate-spin" />
                    </div>
                ) : (
                    <>
                        {temMais ? (
                            <div className="mb-4 text-center">
                                <button
                                    type="button"
                                    onClick={carregarAnteriores}
                                    disabled={loadingAnteriores}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                                >
                                    {loadingAnteriores ? 'A carregar...' : 'Carregar mensagens anteriores'}
                                </button>
                            </div>
                        ) : null}

                        <ol className="space-y-1.5">
                            {mensagens.map((mensagem, index) => {
                                const anterior = mensagens[index - 1];
                                const novoDia =
                                    !anterior || chaveDia(anterior.criadaEm) !== chaveDia(mensagem.criadaEm);
                                const mostrarAutor =
                                    emGrupo &&
                                    !mensagem.minha &&
                                    (novoDia || anterior?.autor?.id !== mensagem.autor?.id);

                                return (
                                    <li key={mensagem.id}>
                                        {novoDia ? (
                                            <div className="my-4 text-center text-xs font-medium text-slate-400 first:mt-0">
                                                {separadorDia(mensagem.criadaEm)}
                                            </div>
                                        ) : null}
                                        <div
                                            className={`flex items-end gap-2 ${
                                                mensagem.minha ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            {!mensagem.minha && emGrupo ? (
                                                <span
                                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ${
                                                        mostrarAutor ? '' : 'invisible'
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    {iniciais(mensagem.autor?.nome)}
                                                </span>
                                            ) : null}
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                                                    mensagem.minha
                                                        ? 'rounded-br-md bg-cyan-600 text-white'
                                                        : 'rounded-bl-md bg-white text-slate-800'
                                                }`}
                                            >
                                                {mostrarAutor ? (
                                                    <p className="mb-0.5 text-xs font-semibold text-cyan-700">
                                                        {mensagem.autor?.nome || 'Utilizador removido'}
                                                    </p>
                                                ) : null}
                                                <p className="whitespace-pre-wrap break-words">{mensagem.corpo}</p>
                                                <p
                                                    className={`mt-1 text-right text-[10px] ${
                                                        mensagem.minha ? 'text-cyan-100' : 'text-slate-400'
                                                    }`}
                                                >
                                                    {hora(mensagem.criadaEm)}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                )}
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void enviar();
                }}
                className="border-t border-slate-200 bg-white p-3"
            >
                {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
                <div className="flex items-end gap-2">
                    <label htmlFor="resposta" className="sr-only">
                        Escrever mensagem
                    </label>
                    <textarea
                        id="resposta"
                        ref={textareaRef}
                        value={texto}
                        onChange={(event) => setTexto(event.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={Math.min(5, Math.max(1, texto.split('\n').length))}
                        maxLength={LIMITE_CORPO}
                        placeholder="Escreva uma mensagem…"
                        className="min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <button
                        type="submit"
                        disabled={!texto.trim() || sending}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Enviar mensagem"
                    >
                        {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
                    </button>
                </div>
                <p className="mt-1.5 hidden text-[11px] text-slate-400 sm:block">
                    Enter para enviar · Shift+Enter para mudar de linha
                </p>
            </form>
        </div>
    );
}
