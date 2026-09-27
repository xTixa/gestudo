import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, {
    AuthAlert,
    AuthButton,
    AuthField,
    AuthInput,
    PasswordInput,
    authLinkCls,
} from '../../components/auth/AuthLayout';
import { usePlan } from '../../utils/plan';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const LOGIN_EMAIL_KEY = 'mc_login_email';

function getStoredEmail() {
    try {
        const stored = JSON.parse(localStorage.getItem(LOGIN_EMAIL_KEY));
        return stored?.email || '';
    } catch {
        localStorage.removeItem(LOGIN_EMAIL_KEY);
        return '';
    }
}

export default function Login({ onLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState(getStoredEmail);
    const [password, setPassword] = useState('');
    const [rememberCredentials, setRememberCredentials] = useState(
        () => Boolean(getStoredEmail())
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const showEnrollment = usePlan().hasModule('inscricoes_online');

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
                setError(data.message || 'Não foi possível efetuar login.');
                return;
            }

            setSuccess(data.message || 'Login efetuado com sucesso.');

            if (rememberCredentials) {
                localStorage.setItem(
                    LOGIN_EMAIL_KEY,
                    JSON.stringify({ email })
                );
            } else {
                localStorage.removeItem(LOGIN_EMAIL_KEY);
            }

            if (data.token) {
                localStorage.setItem('mc_token', data.token);
            }

            if (data.csrfToken) {
                window.csrfToken = data.csrfToken;
                localStorage.setItem('mc_csrf_token', data.csrfToken);
            }

            // Armazenar utilizador no localStorage (chave canónica + retrocompatibilidade)
            localStorage.setItem('mc_user', JSON.stringify(data.user));
            localStorage.setItem('user', JSON.stringify(data.user));

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
            setError('Erro de ligação ao servidor.');
        } finally {
            setLoading(false);
        }
    }

    const enrollmentLink = showEnrollment ? (
        <>
            Novo aluno?{' '}
            <Link to="/inscricao" className={authLinkCls}>
                Fazer inscrição
            </Link>
        </>
    ) : null;

    return (
        <AuthLayout
            title="Iniciar sessão"
            subtitle="Bem-vindo de volta. Introduza os seus dados para aceder à plataforma."
            topRight={
                enrollmentLink && (
                    <p className="hidden text-sm text-slate-500 sm:block">
                        {enrollmentLink}
                    </p>
                )
            }
            footer={
                enrollmentLink && <p className="sm:hidden">{enrollmentLink}</p>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <AuthField id="login-email" label="Email">
                    <AuthInput
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@email.com"
                        required
                    />
                </AuthField>

                <AuthField
                    id="login-password"
                    label="Palavra-passe"
                    action={
                        <Link
                            to="/recuperar-password"
                            className="text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-800 hover:underline"
                        >
                            Esqueceu-se?
                        </Link>
                    }
                >
                    <PasswordInput
                        id="login-password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                </AuthField>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                        type="checkbox"
                        checked={rememberCredentials}
                        onChange={(event) =>
                            setRememberCredentials(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Lembrar email neste dispositivo
                </label>

                {error && <AuthAlert>{error}</AuthAlert>}
                {success && <AuthAlert type="success">{success}</AuthAlert>}

                <AuthButton loading={loading} loadingText="A validar...">
                    Entrar
                </AuthButton>
            </form>
        </AuthLayout>
    );
}
