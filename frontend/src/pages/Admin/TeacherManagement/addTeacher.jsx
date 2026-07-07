import { useMemo, useState } from 'react';
import { Save, UserCircle2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiPost } from '../../../utils/api';

const INITIAL_FORM = {
    email: '',
    nome_completo: '',
    cartao_cidadao: '',
    nif: '',
    morada: '',
    localidade: '',
    codigo_postal: '',
    grau: '',
    habilitacoes: '',
    area: '',
    data_inicio: '',
    data_nascimento: '',
    telemovel: '',
    telefone: '',
    imagem_perfil_url: '',
};

export default function AddProfPage() {
    const navigate = useNavigate();
    const [touched, setTouched] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [form, setForm] = useState(INITIAL_FORM);
    const [photoName, setPhotoName] = useState('');

    const completionPercent = useMemo(() => {
        const requiredFields = [
            'email',
            'nome_completo',
            'cartao_cidadao',
            'nif',
            'morada',
            'localidade',
            'codigo_postal',
            'habilitacoes',
            'grau',
            'area',
            'telemovel',
        ];

        const completed = requiredFields.filter(
            (field) => String(form[field]).trim() !== ''
        ).length;
        return Math.round((completed / requiredFields.length) * 100);
    }, [form]);

    const validationErrors = useMemo(() => {
        const errors = {};
        const nifRegex = /^\d{9}$/;
        const postalCodeRegex = /^\d{4}-\d{3}$/;
        const phoneRegex = /^\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (form.email && !emailRegex.test(form.email.trim())) {
            errors.email = 'Email inválido.';
        }

        if (form.nif && !nifRegex.test(form.nif.trim())) {
            errors.nif = 'NIF inválido. Deve conter 9 dígitos.';
        }

        if (
            form.codigo_postal &&
            !postalCodeRegex.test(form.codigo_postal.trim())
        ) {
            errors.codigo_postal =
                'Código postal inválido. Use o formato 0000-000.';
        }

        if (form.telemovel && !phoneRegex.test(form.telemovel.trim())) {
            errors.telemovel = 'Telemóvel inválido. Deve conter 9 dígitos.';
        }

        if (form.telefone && !phoneRegex.test(form.telefone.trim())) {
            errors.telefone = 'Telefone inválido. Deve conter 9 dígitos.';
        }

        return errors;
    }, [form]);

    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleBlur(event) {
        const { name } = event.target;
        setTouched((prev) => ({ ...prev, [name]: true }));
    }

    function handlePhotoChange(event) {
        const file = event.target.files?.[0];

        if (!file) {
            setPhotoName('');
            setForm((prev) => ({ ...prev, imagem_perfil_url: '' }));
            return;
        }

        if (!file.type.startsWith('image/')) {
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            setSubmitError('A foto não pode exceder 3MB.');
            return;
        }

        setPhotoName(file.name);

        const reader = new FileReader();
        reader.onload = () => {
            setForm((prev) => ({
                ...prev,
                imagem_perfil_url: String(reader.result || ''),
            }));
        };
        reader.readAsDataURL(file);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitAttempted(true);
        setSubmitError('');

        if (hasValidationErrors) {
            return;
        }

        try {
            setSubmitting(true);
            const response = await apiPost('/api/gestor/professores', form);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Nao foi possivel criar o professor.'
                );
            }

            navigate('/gestor/professores', { replace: true });
        } catch (error) {
            setSubmitError(error.message || 'Erro ao criar professor.');
        } finally {
            setSubmitting(false);
        }
    }

    function handleCancel() {
        const hasData = Object.values(form).some(
            (value) => String(value).trim() !== ''
        );

        if (
            !hasData ||
            window.confirm(
                'Pretende cancelar? Os dados preenchidos serão perdidos.'
            )
        ) {
            navigate('/gestor/professores');
        }
    }

    const showError = (fieldName) =>
        (touched[fieldName] || submitAttempted) &&
        Boolean(validationErrors[fieldName]);

    return (
        <section className="w-full space-y-4 bg-slate-50 p-4 sm:p-6">
            <AdminPageHeader
                eyebrow="Professores"
                title="Registar Professor"
                subtitle="Criar uma nova ficha de professor."
                icon={UserCircle2}
            />

            <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                {submitAttempted && hasValidationErrors ? (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Corrija os campos assinalados antes de guardar.
                    </div>
                ) : null}

                {submitError ? (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {submitError}
                    </div>
                ) : null}

                <div className="mb-5 flex items-center gap-4">
                    <div className="relative">
                        {form.imagem_perfil_url ? (
                            <img
                                src={form.imagem_perfil_url}
                                alt="Pré-visualização do professor"
                                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                                <UserCircle2 size={36} />
                            </div>
                        )}
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-york-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-york-200">
                        <Upload size={16} />
                        Carregar Foto
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                    </label>

                    {photoName ? (
                        <span className="text-xs text-slate-500">
                            {photoName}
                        </span>
                    ) : null}
                </div>

                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                        <p>Progresso do preenchimento</p>
                        <p className="font-semibold">{completionPercent}%</p>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                        <div
                            className="h-2 rounded-full bg-emerald-400 transition-all"
                            style={{ width: `${completionPercent}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Informações de início de sessão
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-1">
                                Email *
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="ex.: professor@bloconotas.pt"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('email')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('email') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.email}
                                    </p>
                                ) : null}
                            </label>

                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 lg:col-span-1 lg:self-end">
                                O sistema gera automaticamente uma password
                                temporaria e obriga a troca no primeiro login.
                            </p>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Informações pessoais
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Nome Completo *
                                <input
                                    type="text"
                                    name="nome_completo"
                                    value={form.nome_completo}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Ana Martins"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Cartão de Cidadão *
                                <input
                                    type="text"
                                    name="cartao_cidadao"
                                    value={form.cartao_cidadao}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="00000000 0 ZZ0"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                NIF *
                                <input
                                    type="text"
                                    name="nif"
                                    value={form.nif}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="000000000"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('nif')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('nif') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.nif}
                                    </p>
                                ) : null}
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Morada
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Morada *
                                <input
                                    type="text"
                                    name="morada"
                                    value={form.morada}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Rua, número, andar"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Localidade *
                                <input
                                    type="text"
                                    name="localidade"
                                    value={form.localidade}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Viseu"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Código Postal *
                                <input
                                    type="text"
                                    name="codigo_postal"
                                    value={form.codigo_postal}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="0000-000"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('codigo_postal')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('codigo_postal') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.codigo_postal}
                                    </p>
                                ) : null}
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Informações profissionais
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700">
                                Habilitações *
                                <input
                                    type="text"
                                    name="habilitacoes"
                                    value={form.habilitacoes}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Licenciatura em Matemática"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Grau *
                                <input
                                    type="text"
                                    name="grau"
                                    value={form.grau}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Licenciado/Mestre/Doutor"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Área *
                                <input
                                    type="text"
                                    name="area"
                                    value={form.area}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Matemática, Física, Inglês"
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Data de Início
                                <input
                                    type="date"
                                    name="data_inicio"
                                    value={form.data_inicio}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Data de Nascimento
                                <input
                                    type="date"
                                    name="data_nascimento"
                                    value={form.data_nascimento}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Contactos
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700">
                                Telemóvel *
                                <input
                                    type="text"
                                    name="telemovel"
                                    value={form.telemovel}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="900 000 000"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('telemovel')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('telemovel') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.telemovel}
                                    </p>
                                ) : null}
                            </label>

                            <label className="block text-sm text-slate-700">
                                Telefone
                                <input
                                    type="text"
                                    name="telefone"
                                    value={form.telefone}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="200 000 000"
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('telefone')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('telefone') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.telefone}
                                    </p>
                                ) : null}
                            </label>
                        </div>
                    </fieldset>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-start">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 px-10 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={hasValidationErrors || submitting}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-york-400 px-12 py-2.5 text-sm font-medium text-white hover:bg-york-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Save size={16} />
                        {submitting ? 'A guardar...' : 'Guardar'}
                    </button>
                </div>
            </form>
        </section>
    );
}
