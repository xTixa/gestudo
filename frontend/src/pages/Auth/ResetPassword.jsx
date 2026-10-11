import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiPost } from '../../utils/api';
import AuthLayout, {
    AuthAlert,
    AuthButton,
    AuthField,
    PasswordInput,
    PasswordStrength,
    authLinkCls,
} from '../../components/auth/AuthLayout';

const ASIDE = {
    eyebrow: 'Recuperar acesso',
    title: 'Escolha uma nova palavra-passe',
    text: 'O link que recebeu por email só pode ser usado uma vez e expira ao fim de 30 minutos.',
    points: [
        'Pelo menos 8 caracteres',
        'Misture maiúsculas, minúsculas e números',
        'Não reutilize palavras-passe de outros serviços',
    ],
};

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Lido uma vez: a seguir o token sai do endereço (histórico, partilhas de ecrã).
    const [token] = useState(() => searchParams.get('token') || '');
    const [passwordNova, setPasswordNova] = useState('');
    const [passwordNovaConfirm, setPasswordNovaConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [linkInvalido, setLinkInvalido] = useState(!token);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (searchParams.has('token')) {
            navigate('/redefinir-password', { replace: true });
        }
    }, [searchParams, navigate]);

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');

        if (passwordNova.length < 8) {
            setError('A password deve ter pelo menos 8 caracteres.');
            return;
        }

        if (passwordNova !== passwordNovaConfirm) {
            setError('As passwords não coincidem.');
            return;
        }

        setLoading(true);

        try {
            const response = await apiPost('/api/auth/redefinir-password', {
                token,
                passwordNova,
                passwordNovaConfirm,
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (data?.code === 'RESET_TOKEN_INVALIDO') {
                    setLinkInvalido(true);
                    return;
                }
                setError(data?.message || 'Não foi possível redefinir a password.');
                return;
            }

            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 2000);
        } catch (requestError) {
            setError(requestError?.message || 'Erro ao processar pedido.');
        } finally {
            setLoading(false);
        }
    }

    const backToLogin = (
        <Link to="/login" className={`inline-flex items-center gap-1.5 ${authLinkCls}`}>
            <ArrowLeft size={15} />
            Voltar ao login
        </Link>
    );

    if (linkInvalido) {
        return (
            <AuthLayout aside={ASIDE} title="Link inválido ou expirado" footer={backToLogin}>
                <AuthAlert>
                    Este link de recuperação já foi usado ou expirou. Peça um novo
                    para voltar a entrar.
                </AuthAlert>
                <Link
                    to="/recuperar-password"
                    className="mt-5 flex w-full items-center justify-center rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                >
                    Pedir novo link
                </Link>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            aside={ASIDE}
            title="Redefinir palavra-passe"
            subtitle="Escolha a nova palavra-passe da sua conta."
            footer={backToLogin}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <AuthField id="reset-nova" label="Nova palavra-passe">
                    <PasswordInput
                        id="reset-nova"
                        autoComplete="new-password"
                        value={passwordNova}
                        onChange={(e) => setPasswordNova(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        disabled={loading || success}
                        required
                    />
                    <PasswordStrength value={passwordNova} />
                </AuthField>

                <AuthField id="reset-confirm" label="Confirmar nova palavra-passe">
                    <PasswordInput
                        id="reset-confirm"
                        autoComplete="new-password"
                        value={passwordNovaConfirm}
                        onChange={(e) => setPasswordNovaConfirm(e.target.value)}
                        placeholder="Repita a nova palavra-passe"
                        disabled={loading || success}
                        required
                    />
                </AuthField>

                {error && <AuthAlert>{error}</AuthAlert>}
                {success && (
                    <AuthAlert type="success">
                        Palavra-passe redefinida. A redirecionar para o login...
                    </AuthAlert>
                )}

                <AuthButton loading={loading} loadingText="A guardar..." disabled={loading || success}>
                    Guardar nova palavra-passe
                </AuthButton>
            </form>
        </AuthLayout>
    );
}
