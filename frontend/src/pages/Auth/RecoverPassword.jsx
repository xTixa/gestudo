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
        <div className="auth-notebook-bg relative min-h-screen overflow-hidden p-4 font-sans text-[#63738c]">
            <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
                <div className="w-full overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-[#1c293d]/15 backdrop-blur">
                    <div className="h-2 bg-[linear-gradient(90deg,#1c293d_0%,#1e3a5f_55%,#14ad81_100%)]" />
                    <div className="p-8">
                    <div className="mb-7 text-center">
                        <img
                            src={logo}
                            alt="Bloco de Notas"
                            className="mx-auto mb-3 h-14 object-contain"
                        />
                        <h1 className="text-2xl font-bold text-[#1e3a5f]">
                            Recuperar palavra-passe
                        </h1>
                        <p className="mt-1 text-sm text-[#63738c]">
                            Indica o teu email para receber instruções de
                            recuperação
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-[#1e3a5f]">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[#1c293d] outline-none transition focus:border-[#14ad81] focus:ring-4 focus:ring-emerald-100"
                                placeholder="exemplo@email.com"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-[#1e3a5f] py-3.5 font-bold text-white shadow-lg shadow-[#1c293d]/20 transition hover:bg-[#1c293d] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'A enviar...' : 'Enviar instruções'}
                        </button>

                        <a
                            href="/login"
                            className="block text-center text-sm font-semibold text-[#63738c] underline-offset-4 transition hover:text-[#1e3a5f] hover:underline"
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
        </div>
    );
}
