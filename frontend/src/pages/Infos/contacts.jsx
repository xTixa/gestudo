import { useState } from 'react';
import PublicNavbar from '../../components/infos/PublicNavbar';
import PublicFooter from '../../components/infos/PublicFooter';

export default function InfosContactsPage() {
    const [sent, setSent] = useState(false);

    function handleSubmit(event) {
        event.preventDefault();
        setSent(true);
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <PublicNavbar />

            <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
                <h1 className="text-3xl font-bold text-slate-800">Contactos</h1>

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <iframe
                        title="Mapa - Bloco de Notas"
                        src="https://www.google.com/maps?q=BLOCO%20DE%20NOTAS%20Centro%20de%20Estudos%20e%20Explica%C3%A7%C3%B5es%20Viseu&output=embed"
                        className="h-[360px] w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800">
                            Dados de Contacto
                        </h2>
                        <p className="mt-4 text-sm text-slate-700">
                            <span className="font-semibold">Morada:</span> Rua
                            Moinho de Vento, Lote 4, Loja B, 3510-085 Viseu
                        </p>
                        <p className="mt-3 text-sm text-slate-700">
                            <span className="font-semibold">Telefone:</span> 232
                            185 212
                        </p>
                        <p className="mt-3 text-sm text-slate-700">
                            <span className="font-semibold">Email:</span>{' '}
                            geral@blocodenotas.pt
                        </p>
                        <p className="mt-4 text-sm">
                            <a
                                href="https://www.google.com/maps/place/BLOCO+DE+NOTAS+-+Centro+de+Estudos+e+Explica%C3%A7%C3%B5es/@40.6550457,-7.9241309,17z"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-slate-700 underline-offset-4 hover:underline"
                            >
                                Encontrar no mapa
                            </a>
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800">
                            Formulário de Contacto
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Envia-nos a tua mensagem e responderemos com a maior
                            brevidade.
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            className="mt-5 space-y-4"
                        >
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    Nome
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="O teu nome"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        placeholder="exemplo@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                                        Telefone
                                    </label>
                                    <input
                                        type="tel"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        placeholder="912 345 678"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    Assunto
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="Assunto da mensagem"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    Mensagem
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="Escreve aqui a tua mensagem"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                            >
                                Enviar Mensagem
                            </button>

                            {sent ? (
                                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    Mensagem enviada com sucesso.
                                </p>
                            ) : null}
                        </form>
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}
