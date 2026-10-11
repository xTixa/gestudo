import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../utils/api';
import AuthLayout, {
    AuthAlert,
    AuthButton,
    AuthField,
    PasswordInput,
    PasswordStrength,
} from '../../components/auth/AuthLayout';

const ASIDE = {
    eyebrow: 'Segurança da conta',
    title: 'Primeiro acesso: defina a sua palavra-passe',
    text: 'Este passo é obrigatório e protege os seus dados e os dos seus alunos.',
    points: [
        'Pelo menos 8 caracteres',
        'Misture maiúsculas, minúsculas e números',
        'Não reutilize palavras-passe de outros serviços',
    ],
};

export default function AlterarPasswordObrigatorio() {
    const navigate = useNavigate();
    const [passwordAtual, setPasswordAtual] = useState('');
    const [passwordNova, setPasswordNova] = useState('');
    const [passwordNovaConfirm, setPasswordNovaConfirm] = useState('');
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
        <AuthLayout
            aside={ASIDE}
            title="Definir nova palavra-passe"
            subtitle="Por segurança, altere a palavra-passe temporária para concluir o primeiro acesso."
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <AuthField id="pw-atual" label="Palavra-passe temporária">
                    <PasswordInput
                        id="pw-atual"
                        autoComplete="current-password"
                        value={passwordAtual}
                        onChange={(e) => setPasswordAtual(e.target.value)}
                        placeholder="A que recebeu por email"
                        disabled={loading}
                        required
                    />
                </AuthField>

                <AuthField id="pw-nova" label="Nova palavra-passe">
                    <PasswordInput
                        id="pw-nova"
                        autoComplete="new-password"
                        value={passwordNova}
                        onChange={(e) => setPasswordNova(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        disabled={loading}
                        required
                    />
                    <PasswordStrength value={passwordNova} />
                </AuthField>

                <AuthField id="pw-confirm" label="Confirmar nova palavra-passe">
                    <PasswordInput
                        id="pw-confirm"
                        autoComplete="new-password"
                        value={passwordNovaConfirm}
                        onChange={(e) => setPasswordNovaConfirm(e.target.value)}
                        placeholder="Repita a nova palavra-passe"
                        disabled={loading}
                        required
                    />
                </AuthField>

                {error && <AuthAlert>{error}</AuthAlert>}
                {success && <AuthAlert type="success">{success}</AuthAlert>}

                <AuthButton loading={loading} loadingText="A guardar...">
                    Guardar e continuar
                </AuthButton>
            </form>
        </AuthLayout>
    );
}
