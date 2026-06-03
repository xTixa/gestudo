import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/img/logo.png';

const API_URL = import.meta.env.VITE_API_URL; /*|| 'http://localhost:5000'*/
const LOGIN_EMAIL_KEY = 'mc_login_email';

export default function Login({ onLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberCredentials, setRememberCredentials] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedCredentials = localStorage.getItem(LOGIN_EMAIL_KEY);

        if (!storedCredentials) {
            return;
        }

        try {
            const parsedCredentials = JSON.parse(storedCredentials);
            if (parsedCredentials?.email) {
                setEmail(parsedCredentials.email);
                setRememberCredentials(true);
            }
        } catch {
            localStorage.removeItem(LOGIN_EMAIL_KEY);
        }
    }, []);

    useEffect(() => {
        async function fetchCsrfToken() {
            try {
                const res = await fetch(`${API_URL}/api/auth/csrf-token`, {
                    credentials: 'include', // necessário para receber cookie mc_csrf
                });
                const data = await res.json();
                if (data.csrfToken) {
                    window.csrfToken = data.csrfToken; // ou guarda num state
                }
            } catch (err) {
                console.error('Falha ao obter CSRF token', err);
            }
        }

        fetchCsrfToken();
    }, []);

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });

            const data = await response.json();

            if (!response.ok) {
                setUser(null);
                setError(data.message || 'Não foi possível efetuar login.');
                return;
            }

            setUser(data.user);
            setSuccess(data.message || 'Login efetuado com sucesso.');

            if (rememberCredentials) {
                localStorage.setItem(
                    LOGIN_EMAIL_KEY,
                    JSON.stringify({ email })
                );
            } else {
                localStorage.removeItem(LOGIN_EMAIL_KEY);
            }

            // Armazenar utilizador no localStorage (chave canónica + retrocompatibilidade)
            localStorage.setItem('mc_user', JSON.stringify(data.user));
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.removeItem('mc_token');

            // Se é primeira login, redirecionar para alterar password obrigatoriamente
            if (data.user.primeiraLogin === true) {
                setTimeout(() => {
                    navigate('/auth/alterar-password-obrigatorio');
                }, 500);
            } else {
                // Senão, fazer login normal
                onLogin?.(data.user);
            }
        } catch {
            setUser(null);
            setError('Erro de ligação ao servidor.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-lime-50 p-4 font-sans">
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 20% 20%, rgba(132, 204, 22, 0.18) 0%, transparent 30%), radial-gradient(circle at 80% 10%, rgba(15, 23, 42, 0.14) 0%, transparent 30%), radial-gradient(circle at 50% 80%, rgba(148, 163, 184, 0.16) 0%, transparent 35%)',
                }}
            />
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-lime-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-slate-300/30 blur-3xl" />

            <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center">
                <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-2xl backdrop-blur-sm md:grid-cols-2">
                    <div className="hidden bg-slate-800 p-10 text-white md:flex md:items-center md:justify-center">
                        <div className="max-w-sm">
                            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-200">
                                Bloco de Notas
                            </span>
                            <h2 className="mt-5 text-3xl font-bold leading-tight">
                                Bem-vindo ao portal Bloco de Notas
                            </h2>
                            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-4">
                                <p className="text-xs uppercase tracking-widest text-lime-200">
                                    Acesso rápido
                                </p>
                                <p className="mt-1 text-sm text-slate-100">
                                    Consulta agenda, serviços e presenças em
                                    poucos cliques.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-7 sm:p-10">
                        <div className="mb-8 text-center md:text-left">
                            <img
                                src={logo}
                                alt="Bloco de Notas"
                                className="mx-auto mb-4 h-16 object-contain md:mx-0"
                            />
                            <h1 className="text-2xl font-bold text-slate-800">
                                Iniciar sessão
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">
                                Insere os teus dados para entrar na plataforma
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-200"
                                    placeholder="exemplo@email.com"
                                    required
                                />
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Palavra-passe
                                    </label>
                                    <a
                                        href="/recuperar-password"
                                        className="text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline"
                                    >
                                        Recuperar password
                                    </a>
                                </div>

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-200"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={rememberCredentials}
                                    onChange={(event) =>
                                        setRememberCredentials(
                                            event.target.checked
                                        )
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-lime-600 focus:ring-lime-500"
                                />
                                Lembrar email neste dispositivo
                            </label>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center rounded-xl bg-slate-800 py-3.5 font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg
                                            className="h-5 w-5 animate-spin text-white"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        A validar...
                                    </span>
                                ) : (
                                    'Entrar no Bloco'
                                )}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                                <p className="text-center text-sm font-medium text-red-600">
                                    {error}
                                </p>
                            </div>
                        )}

                        {success && (
                            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-center text-sm font-medium text-emerald-700">
                                    {success}
                                </p>
                            </div>
                        )}

                        {user && (
                            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lime-500 font-bold text-white">
                                        {user.nome?.[0] ||
                                            user.email?.[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {user.nome || user.email}
                                        </p>
                                        <p className="text-xs uppercase tracking-wider text-slate-500">
                                            {user.role || 'Utilizador'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
