import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
} from 'lucide-react';
import markLogo from '../../assets/img/gestudo-mark.png';

const DEFAULT_ASIDE = {
    title: 'A gestão do seu centro de estudos, num só lugar.',
    text: 'Agenda, presenças, serviços e mensalidades acessíveis a gestores, professores e alunos.',
    points: [
        'Agenda sempre atualizada',
        'Presenças registadas em segundos',
        'Notificações sobre o que importa',
    ],
};

function BrandMark({ dark = false }) {
    return (
        <Link to="/" className="inline-flex items-center gap-2.5">
            <img src={markLogo} alt="" className="h-9 w-9 object-contain" />
            <span
                className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-800'}`}
            >
                Gestudo
            </span>
        </Link>
    );
}

export default function AuthLayout({
    title,
    subtitle,
    aside = DEFAULT_ASIDE,
    topRight,
    footer,
    children,
}) {
    return (
        <div className="flex min-h-screen bg-white font-sans text-slate-800">
            {/* Painel da marca */}
            <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white lg:flex xl:p-12">
                <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-york-400/15 blur-3xl" />

                <div className="relative">
                    <BrandMark dark />
                </div>

                <div className="relative">
                    {aside.eyebrow && (
                        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                            {aside.eyebrow}
                        </p>
                    )}
                    <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
                        {aside.title}
                    </h2>
                    {aside.text && (
                        <p className="mt-4 max-w-md leading-relaxed text-slate-300">
                            {aside.text}
                        </p>
                    )}
                    {aside.points?.length > 0 && (
                        <ul className="mt-8 space-y-3 text-sm text-slate-200">
                            {aside.points.map((point) => (
                                <li key={point} className="flex items-center gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                                        <Check size={14} />
                                    </span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <p className="relative text-xs text-slate-500">
                    © {new Date().getFullYear()} Gestudo · Plataforma de Gestão
                    de Estudos
                </p>
            </aside>

            {/* Formulário */}
            <main className="flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                        <ArrowLeft size={16} />
                        Página inicial
                    </Link>
                    {topRight}
                </div>

                <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
                    <div className="w-full max-w-sm">
                        <div className="mb-8 lg:hidden">
                            <BrandMark />
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                {subtitle}
                            </p>
                        )}

                        <div className="mt-8">{children}</div>

                        {footer && (
                            <div className="mt-8 text-center text-sm text-slate-500">
                                {footer}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

const INPUT_CLS =
    'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50';

export function AuthField({ id, label, action, children }) {
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                    htmlFor={id}
                    className="block text-sm font-medium text-slate-700"
                >
                    {label}
                </label>
                {action}
            </div>
            {children}
        </div>
    );
}

export function AuthInput(props) {
    return <input {...props} className={INPUT_CLS} />;
}

export function PasswordInput(props) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <input
                {...props}
                type={visible ? 'text' : 'password'}
                className={`${INPUT_CLS} pr-11`}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:text-slate-700"
                aria-label={visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
            >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
}

export function AuthButton({ loading, loadingText, children, ...props }) {
    return (
        <button
            type="submit"
            disabled={loading}
            {...props}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? loadingText : children}
        </button>
    );
}

export function AuthAlert({ type = 'error', children }) {
    const isError = type === 'error';
    const Icon = isError ? AlertCircle : CheckCircle2;

    return (
        <div
            role={isError ? 'alert' : 'status'}
            className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
                isError
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
        >
            <Icon size={18} className="mt-px shrink-0" />
            <span>{children}</span>
        </div>
    );
}

export const authLinkCls =
    'font-semibold text-slate-700 underline-offset-4 transition hover:text-slate-900 hover:underline';
