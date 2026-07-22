import { useState } from 'react';
import logo from '../../assets/img/Asset-31.svg';
import { apiPost } from '../../utils/api';

export default function RecoverPassword() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            setLoading(true);
            setError('');

            const response = await apiPost('/api/auth/recuperar-password', {
                email,
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        'Não foi possível enviar as instruções de recuperação.'
                );
            }

            setSubmitted(true);
        } catch (requestError) {
            setError(
                requestError?.message ||
                    'Não foi possível enviar as instruções de recuperação.'
            );
            setSubmitted(false);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-brand-cream p-4 font-sans text-brand-grey">
            <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
                <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                    <div className="mb-7 text-center">
                        <img
                            src={logo}
                            alt="Bloco de Notas"
                            className="mx-auto mb-3 h-14 object-contain"
                        />
                        <h1 className="text-2xl font-bold text-brand-navy">
                            Recuperar palavra-passe
                        </h1>
                        <p className="mt-1 text-sm text-brand-grey">
                            Indica o teu email para receber instruções de
                            recuperação
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-brand-navy">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-brand-blue-dark outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-emerald-100"
                                placeholder="exemplo@email.com"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-brand-navy py-3.5 font-bold text-white transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'A enviar...' : 'Enviar instruções'}
                        </button>

                        <a
                            href="/"
                            className="block text-center text-sm font-semibold text-brand-grey underline-offset-4 transition hover:text-brand-navy hover:underline"
                        >
                            Voltar ao login
                        </a>
                    </form>

                    {submitted && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-center text-sm font-medium text-emerald-700">
                                Se existir uma conta associada a este email,
                                vais receber instruções para redefinir a
                                palavra-passe.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-center text-sm font-medium text-rose-700">
                                {error}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
