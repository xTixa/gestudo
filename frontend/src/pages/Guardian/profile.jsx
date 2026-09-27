import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, UserRound, Users } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';
import { useEducandos } from '../../components/guardian/useEducandos';

const INPUT_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:bg-slate-50 disabled:text-slate-500';
const LABEL_CLS = 'block text-sm font-medium text-slate-700';
const CARD_CLS = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';

const EMPTY_CONTACTS = { telemovel: '', telefone: '', morada: '', localidade: '', codPostal: '' };
const EMPTY_PASSWORD = { atual: '', nova: '', confirmar: '' };

function Feedback({ state }) {
    if (!state) return null;
    const ok = state.type === 'success';
    return (
        <p
            role={ok ? 'status' : 'alert'}
            className={`rounded-lg px-3.5 py-2.5 text-sm ${
                ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
        >
            {state.message}
        </p>
    );
}

async function readResponse(request) {
    const response = await request;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Ocorreu um erro.');
    return data;
}

function ContactosCard() {
    const [perfil, setPerfil] = useState(null);
    const [form, setForm] = useState(EMPTY_CONTACTS);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        let active = true;
        readResponse(apiGet('/api/encarregado/perfil'))
            .then((data) => {
                if (!active) return;
                setPerfil(data);
                setForm({
                    telemovel: data.telemovel || '',
                    telefone: data.telefone || '',
                    morada: data.morada || '',
                    localidade: data.localidade || '',
                    codPostal: data.codPostal || '',
                });
            })
            .catch((error) => active && setFeedback({ type: 'error', message: error.message }));
        return () => {
            active = false;
        };
    }, []);

    function update(field) {
        return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSaving(true);
        setFeedback(null);
        try {
            const data = await readResponse(apiPatch('/api/encarregado/perfil', form));
            setPerfil(data.perfil);
            setFeedback({ type: 'success', message: 'Contactos atualizados.' });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className={CARD_CLS}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <UserRound size={18} className="text-slate-400" /> Os meus dados
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                    <span className={LABEL_CLS}>Nome</span>
                    <input className={INPUT_CLS} value={perfil?.nome || ''} disabled />
                </label>
                <label>
                    <span className={LABEL_CLS}>Email de acesso</span>
                    <input className={INPUT_CLS} value={perfil?.email || ''} disabled />
                </label>
                <label>
                    <span className={LABEL_CLS}>Telemóvel</span>
                    <input
                        className={INPUT_CLS}
                        value={form.telemovel}
                        onChange={update('telemovel')}
                        inputMode="numeric"
                        maxLength={9}
                        required
                    />
                </label>
                <label>
                    <span className={LABEL_CLS}>Telefone (opcional)</span>
                    <input
                        className={INPUT_CLS}
                        value={form.telefone}
                        onChange={update('telefone')}
                        inputMode="numeric"
                        maxLength={9}
                    />
                </label>
                <label className="sm:col-span-2">
                    <span className={LABEL_CLS}>Morada</span>
                    <input className={INPUT_CLS} value={form.morada} onChange={update('morada')} />
                </label>
                <label>
                    <span className={LABEL_CLS}>Localidade</span>
                    <input className={INPUT_CLS} value={form.localidade} onChange={update('localidade')} />
                </label>
                <label>
                    <span className={LABEL_CLS}>Código postal</span>
                    <input
                        className={INPUT_CLS}
                        value={form.codPostal}
                        onChange={update('codPostal')}
                        placeholder="0000-000"
                        maxLength={8}
                    />
                </label>
            </div>

            <p className="mt-4 text-xs text-slate-500">
                Para alterar o nome ou o email de acesso, contacte a secretaria do centro.
            </p>

            <div className="mt-5 space-y-3">
                <Feedback state={feedback} />
                <button
                    type="submit"
                    disabled={saving || !perfil}
                    className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                    {saving ? 'A guardar…' : 'Guardar contactos'}
                </button>
            </div>
        </form>
    );
}

function PasswordCard() {
    const [form, setForm] = useState(EMPTY_PASSWORD);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    function update(field) {
        return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setFeedback(null);

        if (form.nova.length < 8) {
            setFeedback({ type: 'error', message: 'A nova password deve ter pelo menos 8 caracteres.' });
            return;
        }
        if (form.nova !== form.confirmar) {
            setFeedback({ type: 'error', message: 'As passwords novas não coincidem.' });
            return;
        }

        setSaving(true);
        try {
            await readResponse(
                apiPost('/api/auth/alterar-password', {
                    passwordAtual: form.atual,
                    passwordNova: form.nova,
                    passwordNovaConfirm: form.confirmar,
                })
            );
            setForm(EMPTY_PASSWORD);
            setFeedback({ type: 'success', message: 'Password alterada.' });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className={CARD_CLS}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <KeyRound size={18} className="text-slate-400" /> Alterar password
            </h2>
            <div className="mt-5 space-y-4">
                <label className="block">
                    <span className={LABEL_CLS}>Password atual</span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        className={INPUT_CLS}
                        value={form.atual}
                        onChange={update('atual')}
                        required
                    />
                </label>
                <label className="block">
                    <span className={LABEL_CLS}>Nova password</span>
                    <input
                        type="password"
                        autoComplete="new-password"
                        className={INPUT_CLS}
                        value={form.nova}
                        onChange={update('nova')}
                        placeholder="Mínimo 8 caracteres"
                        required
                    />
                </label>
                <label className="block">
                    <span className={LABEL_CLS}>Confirmar nova password</span>
                    <input
                        type="password"
                        autoComplete="new-password"
                        className={INPUT_CLS}
                        value={form.confirmar}
                        onChange={update('confirmar')}
                        required
                    />
                </label>
                <Feedback state={feedback} />
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                >
                    {saving ? 'A alterar…' : 'Alterar password'}
                </button>
            </div>
        </form>
    );
}

function EducandosCard() {
    const { loading, educandos } = useEducandos();

    return (
        <section className={CARD_CLS}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Users size={18} className="text-slate-400" /> Educandos
            </h2>
            {loading ? (
                <p className="mt-4 text-sm text-slate-500">A carregar…</p>
            ) : educandos.length ? (
                <ul className="mt-4 space-y-2">
                    {educandos.map((educando) => (
                        <li
                            key={educando.idAluno}
                            className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5"
                        >
                            <CheckCircle2
                                size={18}
                                className={educando.ativo ? 'text-emerald-600' : 'text-slate-300'}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-800">
                                    {educando.nome}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                    {[educando.parentesco, educando.escola].filter(Boolean).join(' · ') ||
                                        'Aluno'}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 text-sm text-slate-500">Sem educandos associados.</p>
            )}
        </section>
    );
}

export default function PerfilEncarregadoPage() {
    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Área do encarregado"
                title="Perfil"
                subtitle="Os seus contactos, educandos e acesso à plataforma."
                icon={UserRound}
            />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <ContactosCard />
                <div className="space-y-5">
                    <EducandosCard />
                    <PasswordCard />
                </div>
            </div>
        </section>
    );
}
