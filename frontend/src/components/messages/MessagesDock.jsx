import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronDown,
    ChevronUp,
    Maximize2,
    MessageSquarePlus,
    MessagesSquare,
    Minus,
    X,
} from 'lucide-react';
import ConversationList from './ConversationList';
import ConversationView from './ConversationView';
import NewConversationModal from './NewConversationModal';
import { listarConversas, useUnreadMessages } from '../../utils/messages';

const POLL_MS = 20 * 1000;

// Quantas janelas de conversa cabem ao lado da doca.
function maxJanelas() {
    if (typeof window === 'undefined') return 1;
    if (window.innerWidth >= 1440) return 3;
    if (window.innerWidth >= 1100) return 2;
    return 1;
}

function chaveStorage(userId) {
    return `mc_msg_dock:${userId}`;
}

// Preferência do próprio browser (lista aberta e janelas); falha em silêncio.
function lerEstado(userId) {
    try {
        const raw = localStorage.getItem(chaveStorage(userId));
        const data = raw ? JSON.parse(raw) : null;
        return {
            aberta: Boolean(data?.aberta),
            janelas: Array.isArray(data?.janelas)
                ? data.janelas
                      .filter((j) => Number.isInteger(j?.id))
                      .slice(0, maxJanelas())
                      .map((j) => ({ id: j.id, minimizada: Boolean(j.minimizada), titulo: j.titulo || '' }))
                : [],
        };
    } catch {
        return { aberta: false, janelas: [] };
    }
}

function BotaoCabecalho({ onClick, label, children }) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label={label}
            title={label}
        >
            {children}
        </button>
    );
}

function JanelaConversa({ janela, onMinimizar, onFechar, onAbrirPagina, onTitulo, onChanged }) {
    const { id, minimizada, titulo } = janela;
    const definirTitulo = useCallback((novo) => onTitulo(id, novo), [id, onTitulo]);

    const acoes = (
        <div className="flex shrink-0 items-center">
            <BotaoCabecalho onClick={() => onMinimizar(id, !minimizada)} label={minimizada ? 'Expandir' : 'Minimizar'}>
                {minimizada ? <ChevronUp size={16} /> : <Minus size={16} />}
            </BotaoCabecalho>
            <BotaoCabecalho onClick={() => onAbrirPagina(id)} label="Abrir na página de mensagens">
                <Maximize2 size={14} />
            </BotaoCabecalho>
            <BotaoCabecalho onClick={() => onFechar(id)} label="Fechar conversa">
                <X size={16} />
            </BotaoCabecalho>
        </div>
    );

    if (minimizada) {
        return (
            <section className="w-72 overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-lg">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onMinimizar(id, false)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') onMinimizar(id, false);
                    }}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2"
                >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                        {titulo || 'Conversa'}
                    </span>
                    {acoes}
                </div>
            </section>
        );
    }

    return (
        <section
            className="flex h-[440px] w-80 flex-col overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-xl"
            aria-label={titulo || 'Conversa'}
        >
            <ConversationView
                key={id}
                idConversa={id}
                arquivada={false}
                onChanged={onChanged}
                onTitle={definirTitulo}
                compact
                headerActions={acoes}
            />
        </section>
    );
}

/**
 * Doca de mensagens no canto inferior direito (estilo Messenger/LinkedIn):
 * barra com o contador de não lidas, lista de conversas e até 3 janelas de
 * conversa abertas. Só em ecrãs grandes; no telemóvel usa-se a página.
 */
export default function MessagesDock({ role, userId }) {
    const navigate = useNavigate();
    const naoLidas = useUnreadMessages(true);
    const [estadoInicial] = useState(() => lerEstado(userId));
    const [aberta, setAberta] = useState(estadoInicial.aberta);
    const [janelas, setJanelas] = useState(estadoInicial.janelas);
    const [conversas, setConversas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [novaAberta, setNovaAberta] = useState(false);
    const [versao, setVersao] = useState(0);

    const recarregar = useCallback(() => setVersao((v) => v + 1), []);

    useEffect(() => {
        try {
            localStorage.setItem(chaveStorage(userId), JSON.stringify({ aberta, janelas }));
        } catch {
            // Sem storage (modo privado): a doca funciona na mesma.
        }
    }, [userId, aberta, janelas]);

    // A lista só é carregada (e atualizada) enquanto está aberta.
    useEffect(() => {
        if (!aberta) return undefined;
        let ativo = true;
        const carregar = () =>
            listarConversas()
                .then((lista) => {
                    if (!ativo) return;
                    setConversas(lista);
                    setError('');
                })
                .catch((err) => {
                    if (ativo) setError(err.message);
                })
                .finally(() => {
                    if (ativo) setLoading(false);
                });
        void carregar();
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') void carregar();
        }, POLL_MS);
        return () => {
            ativo = false;
            clearInterval(id);
        };
    }, [aberta, versao]);

    const abrirJanela = useCallback((id, titulo = '') => {
        setJanelas((atuais) => {
            const existente = atuais.find((j) => j.id === id);
            if (existente) {
                return atuais.map((j) => (j.id === id ? { ...j, minimizada: false } : j));
            }
            // A mais recente fica junto à doca; as mais antigas saem quando não cabem.
            return [{ id, minimizada: false, titulo }, ...atuais].slice(0, maxJanelas());
        });
    }, []);

    const minimizar = useCallback((id, minimizada) => {
        setJanelas((atuais) => atuais.map((j) => (j.id === id ? { ...j, minimizada } : j)));
    }, []);

    const fechar = useCallback((id) => {
        setJanelas((atuais) => atuais.filter((j) => j.id !== id));
    }, []);

    const definirTitulo = useCallback((id, titulo) => {
        setJanelas((atuais) =>
            atuais.map((j) => (j.id === id && j.titulo !== titulo ? { ...j, titulo } : j))
        );
    }, []);

    const abrirPagina = useCallback(
        (id) => {
            setJanelas((atuais) => atuais.filter((j) => j.id !== id));
            navigate(`/${role}/mensagens${id ? `?conversa=${id}` : ''}`);
        },
        [navigate, role]
    );

    const fecharNova = useCallback(() => setNovaAberta(false), []);
    const aoCriar = useCallback(
        (id) => {
            setNovaAberta(false);
            abrirJanela(id);
            recarregar();
        },
        [abrirJanela, recarregar]
    );

    function alternarLista() {
        if (!aberta) setLoading(conversas.length === 0);
        setAberta((v) => !v);
    }

    return (
        <>
            <div className="pointer-events-none fixed bottom-0 right-4 z-40 hidden flex-row-reverse items-end gap-3 lg:flex">
                {/* Doca: barra + lista */}
                <section
                    className="pointer-events-auto flex w-80 flex-col overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-xl"
                    aria-label="Mensagens"
                >
                    <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={aberta}
                        onClick={alternarLista}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                alternarLista();
                            }
                        }}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50"
                    >
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-white">
                            <MessagesSquare size={16} />
                            {naoLidas > 0 ? (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                                    {naoLidas > 99 ? '99+' : naoLidas}
                                </span>
                            ) : null}
                        </span>
                        <span className="flex-1 text-sm font-semibold text-slate-800">
                            Mensagens
                            {naoLidas > 0 ? <span className="sr-only"> ({naoLidas} por ler)</span> : null}
                        </span>
                        <BotaoCabecalho onClick={() => setNovaAberta(true)} label="Nova mensagem">
                            <MessageSquarePlus size={16} />
                        </BotaoCabecalho>
                        <BotaoCabecalho onClick={() => abrirPagina(null)} label="Abrir página de mensagens">
                            <Maximize2 size={14} />
                        </BotaoCabecalho>
                        <span className="p-1 text-slate-500" aria-hidden="true">
                            {aberta ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </span>
                    </div>

                    {aberta ? (
                        <div className="max-h-[min(420px,60vh)] overflow-y-auto border-t border-slate-200">
                            <ConversationList
                                conversas={conversas}
                                loading={loading}
                                error={error}
                                idAtiva={janelas.find((j) => !j.minimizada)?.id ?? null}
                                onSelect={(conversa) => abrirJanela(conversa.id)}
                                emptyMessage="Ainda não tem conversas."
                                compact
                            />
                        </div>
                    ) : null}
                </section>

                {/* Janelas de conversa */}
                {janelas.map((janela) => (
                    <div key={janela.id} className="pointer-events-auto">
                        <JanelaConversa
                            janela={janela}
                            onMinimizar={minimizar}
                            onFechar={fechar}
                            onAbrirPagina={abrirPagina}
                            onTitulo={definirTitulo}
                            onChanged={recarregar}
                        />
                    </div>
                ))}
            </div>

            {novaAberta ? <NewConversationModal onClose={fecharNova} onCreated={aoCriar} /> : null}
        </>
    );
}
