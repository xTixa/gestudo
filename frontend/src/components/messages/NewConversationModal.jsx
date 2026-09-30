import { useEffect, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { Modal } from '../finance/Overlay';
import { criarConversa, iniciais, papelLabel, procurarContactos } from '../../utils/messages';

const LIMITE_CORPO = 5000;

/**
 * Nova mensagem: escolher destinatários (entre os contactos permitidos),
 * assunto opcional e primeira mensagem. Montado só quando está aberto,
 * por isso o estado recomeça em cada abertura.
 */
export default function NewConversationModal({ onClose, onCreated }) {
    const [q, setQ] = useState('');
    const [contactos, setContactos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selecionados, setSelecionados] = useState([]);
    const [assunto, setAssunto] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    // Pesquisa com atraso para não pedir a cada tecla.
    useEffect(() => {
        let ativo = true;
        const id = setTimeout(
            () => {
                procurarContactos(q.trim())
                    .then((lista) => {
                        if (ativo) setContactos(lista);
                    })
                    .catch((err) => {
                        if (ativo) setError(err.message);
                    })
                    .finally(() => {
                        if (ativo) setLoading(false);
                    });
            },
            q ? 250 : 0
        );
        return () => {
            ativo = false;
            clearTimeout(id);
        };
    }, [q]);

    function alternar(contacto) {
        setSelecionados((atuais) =>
            atuais.some((c) => c.id === contacto.id)
                ? atuais.filter((c) => c.id !== contacto.id)
                : [...atuais, contacto]
        );
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!selecionados.length || !mensagem.trim()) return;
        setSending(true);
        setError('');
        try {
            const resultado = await criarConversa({
                participantes: selecionados.map((c) => c.id),
                assunto: assunto.trim() || undefined,
                mensagem: mensagem.trim(),
            });
            onCreated(resultado.idConversa);
        } catch (err) {
            setError(err.message);
            setSending(false);
        }
    }

    const selecionadoIds = new Set(selecionados.map((c) => c.id));

    return (
        <Modal
            open
            onClose={onClose}
            title="Nova mensagem"
            description="Só aparecem as pessoas a quem pode escrever."
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="pesquisa-contactos" className="mb-1 block text-sm font-medium text-slate-700">
                        Para
                    </label>
                    {selecionados.length ? (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                            {selecionados.map((contacto) => (
                                <span
                                    key={contacto.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-cyan-800"
                                >
                                    {contacto.nome}
                                    <button
                                        type="button"
                                        onClick={() => alternar(contacto)}
                                        className="rounded-full p-0.5 hover:bg-cyan-100"
                                        aria-label={`Remover ${contacto.nome}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : null}
                    <div className="relative">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            id="pesquisa-contactos"
                            type="search"
                            value={q}
                            onChange={(event) => setQ(event.target.value)}
                            placeholder="Procurar por nome…"
                            autoComplete="off"
                            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>
                    <ul
                        className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200"
                        aria-label="Contactos"
                    >
                        {loading ? (
                            <li className="flex justify-center py-6 text-slate-400">
                                <Loader2 size={18} className="animate-spin" />
                            </li>
                        ) : contactos.length === 0 ? (
                            <li className="px-3 py-6 text-center text-sm text-slate-500">
                                {q ? 'Nenhum contacto encontrado.' : 'Ainda não tem contactos disponíveis.'}
                            </li>
                        ) : (
                            contactos.map((contacto) => {
                                const ativo = selecionadoIds.has(contacto.id);
                                return (
                                    <li key={contacto.id}>
                                        <button
                                            type="button"
                                            onClick={() => alternar(contacto)}
                                            aria-pressed={ativo}
                                            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                                                ativo ? 'bg-cyan-50' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                                                {iniciais(contacto.nome)}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-slate-800">
                                                    {contacto.nome}
                                                </span>
                                                <span className="block truncate text-xs text-slate-500">
                                                    {contacto.contexto || papelLabel(contacto.papel)}
                                                </span>
                                            </span>
                                            {ativo ? <Check size={16} className="shrink-0 text-cyan-600" /> : null}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>

                <div>
                    <label htmlFor="assunto" className="mb-1 block text-sm font-medium text-slate-700">
                        Assunto <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                        id="assunto"
                        type="text"
                        value={assunto}
                        onChange={(event) => setAssunto(event.target.value)}
                        maxLength={150}
                        placeholder={selecionados.length > 1 ? 'Ex.: Teste de sexta-feira' : ''}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                        Sem assunto, a mensagem continua a conversa que já tiver com essa pessoa.
                    </p>
                </div>

                <div>
                    <label htmlFor="mensagem" className="mb-1 block text-sm font-medium text-slate-700">
                        Mensagem
                    </label>
                    <textarea
                        id="mensagem"
                        value={mensagem}
                        onChange={(event) => setMensagem(event.target.value)}
                        rows={4}
                        maxLength={LIMITE_CORPO}
                        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                    />
                </div>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex justify-end gap-2 pb-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!selecionados.length || !mensagem.trim() || sending}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : null}
                        Enviar
                    </button>
                </div>
            </form>
        </Modal>
    );
}
