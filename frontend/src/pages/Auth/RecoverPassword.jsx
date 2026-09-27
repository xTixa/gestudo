import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { apiPost } from '../../utils/api';
import AuthLayout, {
    AuthAlert,
    AuthButton,
    AuthField,
    AuthInput,
    authLinkCls,
} from '../../components/auth/AuthLayout';

const ASIDE = {
    eyebrow: 'Recuperar acesso',
    title: 'Esqueceu-se da palavra-passe? Acontece.',
    text: 'Indique o email associado à sua conta e enviamos-lhe as instruções para voltar a entrar na plataforma.',
};

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

    const backToLogin = (
        <Link to="/login" className={`inline-flex items-center gap-1.5 ${authLinkCls}`}>
            <ArrowLeft size={15} />
            Voltar ao login
        </Link>
    );

    if (submitted) {
        return (
            <AuthLayout
                aside={ASIDE}
                title="Verifique o seu email"
                footer={backToLogin}
            >
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <MailCheck size={22} />
                    </span>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">
                        Se existir uma conta associada a{' '}
                        <span className="font-semibold text-slate-800">
                            {email}
                        </span>
                        , vai receber instruções para redefinir a
                        palavra-passe. Verifique também a pasta de spam.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                    Usar outro email
                </button>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            aside={ASIDE}
            title="Recuperar palavra-passe"
            subtitle="Indique o seu email para receber as instruções de recuperação."
            footer={backToLogin}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <AuthField id="recover-email" label="Email">
                    <AuthInput
                        id="recover-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@email.com"
                        required
                    />
                </AuthField>

                {error && <AuthAlert>{error}</AuthAlert>}

                <AuthButton loading={loading} loadingText="A enviar...">
                    Enviar instruções
                </AuthButton>
            </form>
        </AuthLayout>
    );
}
