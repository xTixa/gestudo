import { useState } from 'react';
import { CalendarPlus, Check, Copy, RefreshCw, X } from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';

const GUIAS = {
    google: {
        label: 'Google Calendar',
        passos: [
            'Abra o Google Calendar num computador (a opção não está disponível na app móvel).',
            'No painel esquerdo, ao lado de "Outros calendários", clique no + e escolha "A partir do URL".',
            'Cole o link copiado acima no campo apresentado.',
            'Clique em "Adicionar calendário".',
        ],
        nota: 'O Google Calendar atualiza o calendário periodicamente (pode demorar algumas horas a aparecer e a refletir alterações — não é instantâneo).',
    },
    outlook: {
        label: 'Outlook',
        passos: [
            'Abra o Outlook na web (outlook.com) e vá a "Calendário".',
            'No painel esquerdo, clique em "Adicionar calendário" e depois em "Subscrever a partir da web".',
            'Cole o link copiado acima no campo do URL e dê um nome ao calendário.',
            'Clique em "Importar". No Outlook para ambiente de trabalho, o calendário subscrito aparece automaticamente depois de sincronizar.',
        ],
        nota: 'O Outlook também atualiza periodicamente, não em tempo real.',
    },
    apple: {
        label: 'Apple Calendar',
        passos: [
            'No Mac, abra a app "Calendário" e escolha Ficheiro → "Nova Subscrição de Calendário".',
            'No iPhone/iPad, vá a Definições → Calendário → Contas → Adicionar Conta → "Outra" → "Adicionar Calendário Subscrito".',
            'Cole o link copiado acima e confirme.',
            'Escolha a frequência de atualização (por exemplo, a cada hora) e guarde.',
        ],
        nota: 'A frequência de atualização é definida por si nas definições da subscrição.',
    },
};

export default function CalendarSyncButton() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState('');
    const [url, setUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [guiaAtivo, setGuiaAtivo] = useState('google');

    async function abrirModal() {
        setOpen(true);
        setError('');
        setCopied(false);

        if (url) {
            return;
        }

        setLoading(true);
        try {
            const response = await apiGet('/api/agenda/calendar-token');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data?.message || 'Erro ao obter o link da agenda.'
                );
            }
            setUrl(data.url || '');
        } catch (err) {
            setError(err?.message || 'Erro ao obter o link da agenda.');
        } finally {
            setLoading(false);
        }
    }

    function fecharModal() {
        if (regenerating) return;
        setOpen(false);
    }

    async function handleRegenerar() {
        if (
            !window.confirm(
                'Gerar um novo link invalida o link atual — quem o tiver subscrito deixa de receber atualizações. Continuar?'
            )
        ) {
            return;
        }

        setRegenerating(true);
        setError('');
        setCopied(false);

        try {
            const response = await apiPost(
                '/api/agenda/calendar-token/regenerar',
                {}
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data?.message || 'Erro ao gerar novo link.'
                );
            }
            setUrl(data.url || '');
        } catch (err) {
            setError(err?.message || 'Erro ao gerar novo link.');
        } finally {
            setRegenerating(false);
        }
    }

    async function handleCopiar() {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Não foi possível copiar automaticamente. Copie manualmente o link.');
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={abrirModal}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
                <CalendarPlus size={16} />
                Sincronizar com calendário externo
            </button>

            {open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45"
                        onClick={fecharModal}
                        aria-label="Fechar"
                    />

                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Agenda
                                </p>
                                <h3 className="mt-1 text-lg font-semibold text-slate-800">
                                    Sincronizar com calendário externo
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={fecharModal}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            <p className="text-sm text-slate-600">
                                Copie este link e cole-o no Google Calendar,
                                Outlook ou Apple Calendar como
                                &quot;subscrever calendário por URL&quot;. A
                                sua agenda fica sincronizada automaticamente.
                            </p>

                            {error ? (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </p>
                            ) : null}

                            {loading ? (
                                <p className="text-sm text-slate-500">
                                    A gerar o seu link pessoal...
                                </p>
                            ) : url ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={url}
                                            onFocus={(event) =>
                                                event.target.select()
                                            }
                                            className="w-full truncate bg-transparent text-xs text-slate-700 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCopiar}
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                        >
                                            {copied ? (
                                                <Check size={13} />
                                            ) : (
                                                <Copy size={13} />
                                            )}
                                            {copied ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-amber-700">
                                        Este link é pessoal — não o partilhe,
                                        dá acesso à sua agenda.
                                    </p>
                                </div>
                            ) : null}

                            {url ? (
                                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex gap-1.5">
                                        {Object.entries(GUIAS).map(
                                            ([key, guia]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() =>
                                                        setGuiaAtivo(key)
                                                    }
                                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                                        guiaAtivo === key
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {guia.label}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Como adicionar no{' '}
                                            {GUIAS[guiaAtivo].label}
                                        </p>
                                        <ol className="mt-2 space-y-1.5 text-sm text-slate-700">
                                            {GUIAS[guiaAtivo].passos.map(
                                                (passo, index) => (
                                                    <li
                                                        key={index}
                                                        className="flex gap-2"
                                                    >
                                                        <span className="font-semibold text-blue-600">
                                                            {index + 1}.
                                                        </span>
                                                        <span>{passo}</span>
                                                    </li>
                                                )
                                            )}
                                        </ol>
                                        <p className="mt-2 text-xs text-slate-500">
                                            {GUIAS[guiaAtivo].nota}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
                            <button
                                type="button"
                                onClick={handleRegenerar}
                                disabled={regenerating || loading}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw
                                    size={13}
                                    className={
                                        regenerating ? 'animate-spin' : ''
                                    }
                                />
                                {regenerating
                                    ? 'A gerar...'
                                    : 'Gerar novo link'}
                            </button>
                            <button
                                type="button"
                                onClick={fecharModal}
                                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
