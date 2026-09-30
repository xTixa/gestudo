import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquarePlus, MessagesSquare, Search } from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import ConversationList from '../../components/messages/ConversationList';
import ConversationView from '../../components/messages/ConversationView';
import NewConversationModal from '../../components/messages/NewConversationModal';
import { listarConversas } from '../../utils/messages';

const POLL_MS = 20 * 1000;

/**
 * Mensagens internas, comum a todos os papéis. A conversa aberta fica no
 * URL (?conversa=ID), para os links das notificações push abrirem direto.
 */
export default function MessagesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const idAberta = Number(searchParams.get('conversa')) || null;

    const [vista, setVista] = useState('entrada'); // 'entrada' | 'arquivo'
    const [conversas, setConversas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filtro, setFiltro] = useState('');
    const [novaAberta, setNovaAberta] = useState(false);
    const [versao, setVersao] = useState(0);

    const recarregar = useCallback(() => setVersao((v) => v + 1), []);

    useEffect(() => {
        let ativo = true;
        const carregar = () =>
            listarConversas({ arquivadas: vista === 'arquivo' })
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
    }, [vista, versao]);

    const abrir = useCallback(
        (id) => {
            setSearchParams(id ? { conversa: String(id) } : {});
        },
        [setSearchParams]
    );

    const fecharNova = useCallback(() => setNovaAberta(false), []);
    const aoCriar = useCallback(
        (id) => {
            setNovaAberta(false);
            setVista('entrada');
            abrir(id);
            recarregar();
        },
        [abrir, recarregar]
    );

    const aoMudarConversa = useCallback(
        (opcoes) => {
            if (opcoes?.fechar) abrir(null);
            recarregar();
        },
        [abrir, recarregar]
    );
    const voltar = useCallback(() => abrir(null), [abrir]);

    function mudarVista(proxima) {
        if (proxima === vista) return;
        setLoading(true);
        setConversas([]);
        setVista(proxima);
    }

    const filtradas = useMemo(() => {
        const termo = filtro.trim().toLowerCase();
        if (!termo) return conversas;
        return conversas.filter((conversa) =>
            [conversa.assunto, ...conversa.participantes.map((p) => p.nome)]
                .filter(Boolean)
                .some((texto) => texto.toLowerCase().includes(termo))
        );
    }, [conversas, filtro]);

    const conversaAberta = conversas.find((c) => c.id === idAberta);

    return (
        <section className="space-y-4">
            <AdminPageHeader
                title="Mensagens"
                subtitle="Converse com a gestão, professores e famílias."
                actions={
                    <button
                        type="button"
                        onClick={() => setNovaAberta(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                    >
                        <MessageSquarePlus size={16} />
                        Nova mensagem
                    </button>
                }
            />

            <div className="grid h-[calc(100vh-13rem)] min-h-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[340px_1fr]">
                {/* Lista de conversas */}
                <aside
                    className={`min-h-0 flex-col border-slate-200 lg:flex lg:border-r ${
                        idAberta ? 'hidden' : 'flex'
                    }`}
                >
                    <div className="space-y-3 border-b border-slate-200 p-3">
                        <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist">
                            {[
                                { id: 'entrada', label: 'Caixa de entrada' },
                                { id: 'arquivo', label: 'Arquivadas' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={vista === tab.id}
                                    onClick={() => mudarVista(tab.id)}
                                    className={`flex-1 rounded-md px-3 py-1.5 transition ${
                                        vista === tab.id
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="search"
                                value={filtro}
                                onChange={(event) => setFiltro(event.target.value)}
                                placeholder="Filtrar conversas…"
                                aria-label="Filtrar conversas"
                                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                            />
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <ConversationList
                            conversas={filtradas}
                            loading={loading}
                            error={error}
                            idAtiva={idAberta}
                            onSelect={(conversa) => abrir(conversa.id)}
                            emptyMessage={
                                filtro
                                    ? 'Nenhuma conversa corresponde ao filtro.'
                                    : vista === 'arquivo'
                                      ? 'Não tem conversas arquivadas.'
                                      : 'Ainda não tem conversas.'
                            }
                        />
                    </div>
                </aside>

                {/* Conversa aberta */}
                <div className={`min-h-0 ${idAberta ? 'block' : 'hidden lg:block'}`}>
                    {idAberta ? (
                        <ConversationView
                            key={idAberta}
                            idConversa={idAberta}
                            arquivada={conversaAberta?.arquivada ?? vista === 'arquivo'}
                            onBack={voltar}
                            onChanged={aoMudarConversa}
                        />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
                            <MessagesSquare size={36} className="mb-3 text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">Escolha uma conversa</p>
                            <p className="mt-1 text-sm">ou comece uma nova mensagem.</p>
                        </div>
                    )}
                </div>
            </div>

            {novaAberta ? <NewConversationModal onClose={fecharNova} onCreated={aoCriar} /> : null}
        </section>
    );
}
