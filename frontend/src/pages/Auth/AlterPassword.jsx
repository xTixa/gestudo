import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiPost } from '../../utils/api';
import logo from '../../assets/img/Asset-31.svg';

export default function AlterarPasswordObrigatorio() {
    const navigate = useNavigate();
    const [passwordAtual, setPasswordAtual] = useState('');
    const [passwordNova, setPasswordNova] = useState('');
    const [passwordNovaConfirm, setPasswordNovaConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordNova, setShowPasswordNova] = useState(false);
    const [showPasswordNovaConfirm, setShowPasswordNovaConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        // Verificar se utilizador está autenticado e é primeira login
        const user = JSON.parse(
            localStorage.getItem('mc_user') ||
                localStorage.getItem('user') ||
                '{}'
        );
        if (!user.id || !user.primeiraLogin) {
            navigate('/');
        }
    }, [navigate]);

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        setSuccess('');

        // Validações básicas
        if (!passwordAtual || !passwordNova || !passwordNovaConfirm) {
            setError('Preencha todos os campos.');
            return;
        }

        if (passwordNova.length < 8) {
            setError('A password deve ter pelo menos 8 caracteres.');
            return;
        }

        if (passwordNova !== passwordNovaConfirm) {
            setError('As passwords não coincidem.');
            return;
        }

        if (passwordNova === passwordAtual) {
            setError('A nova password não pode ser igual à password temporária.');
            return;
        }

        setLoading(true);

        try {
            const response = await apiPost('/api/auth/alterar-password', {
                passwordAtual,
                passwordNova,
                passwordNovaConfirm,
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || 'Erro ao alterar password.');
                return;
            }

            // Sucesso: atualizar localStorage e redirecionar
            const user = JSON.parse(
                localStorage.getItem('mc_user') ||
                    localStorage.getItem('user') ||
                    '{}'
            );
            user.primeiraLogin = false;
            localStorage.setItem('mc_user', JSON.stringify(user));
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.removeItem('mc_token');

            setSuccess('Password alterada com sucesso! Faça login novamente.');

            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 1500);
        } catch (err) {
            setError(err.message || 'Erro ao processar pedido.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-brand-cream p-4 font-sans text-brand-grey">
            <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center">
                <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
                    <div className="hidden bg-brand-navy p-10 text-white md:flex md:items-center md:justify-center">
                        <div className="max-w-sm">
                            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-100">
                                Segurança de Conta
                            </span>
                            <h2 className="mt-5 text-3xl font-bold leading-tight">
                                Primeiro acesso: atualize a sua palavra-passe
                            </h2>
                            <p className="mt-3 text-sm text-slate-200">
                                Esta etapa é obrigatória para proteger os seus
                                dados e garantir acesso seguro à plataforma.
                            </p>

                            <div className="mt-8 rounded-xl border border-white/20 bg-white/10 p-4">
                                <p className="text-xs uppercase tracking-widest text-emerald-100">
                                    Boas práticas
                                </p>
                                <p className="mt-1 text-sm text-slate-100">
                                    Use uma password forte com letras
                                    maiúsculas, minúsculas, números e símbolos.
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
                            <h1 className="text-2xl font-bold text-brand-navy">
                                Alterar palavra-passe
                            </h1>
                            <p className="mt-1 text-sm text-brand-grey">
                                Defina uma nova palavra-passe para concluir o
                                primeiro acesso
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-brand-navy">
                                    Password Atual
                                </label>
                                <div className="relative">
                                    <input
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        value={passwordAtual}
                                        onChange={(e) =>
                                            setPasswordAtual(e.target.value)
                                        }
                                        placeholder="Digite a password temporária"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-brand-blue-dark outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-emerald-100"
                                        disabled={loading}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey transition hover:text-brand-navy"
                                        aria-label="Mostrar ou ocultar password atual"
                                    >
                                        {showPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-brand-navy">
                                    Nova Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={
                                            showPasswordNova
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={passwordNova}
                                        onChange={(e) =>
                                            setPasswordNova(e.target.value)
                                        }
                                        placeholder="Mínimo 8 caracteres"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-brand-blue-dark outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-emerald-100"
                                        disabled={loading}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPasswordNova(
                                                !showPasswordNova
                                            )
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey transition hover:text-brand-navy"
                                        aria-label="Mostrar ou ocultar nova password"
                                    >
                                        {showPasswordNova ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-brand-navy">
                                    Confirmar Nova Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={
                                            showPasswordNovaConfirm
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={passwordNovaConfirm}
                                        onChange={(e) =>
                                            setPasswordNovaConfirm(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Repita a nova password"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-brand-blue-dark outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-emerald-100"
                                        disabled={loading}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPasswordNovaConfirm(
                                                !showPasswordNovaConfirm
                                            )
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey transition hover:text-brand-navy"
                                        aria-label="Mostrar ou ocultar confirmação da nova password"
                                    >
                                        {showPasswordNovaConfirm ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center rounded-xl bg-brand-navy py-3.5 font-bold text-white shadow-lg shadow-brand-blue-dark/20 transition hover:bg-brand-blue-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loading
                                    ? 'A processar...'
                                    : 'Guardar nova password'}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                                <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-red-600">
                                    <AlertCircle size={16} />
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

                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-brand-cream p-4">
                            <p className="text-xs text-brand-grey">
                                Dica de segurança: evite reutilizar passwords de
                                outros serviços.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
