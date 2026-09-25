import { useMemo, useState } from 'react';
import { Save, UserCircle2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiPost } from '../../../utils/api';

// estado inicial do formulário, com todos os campos definidos como strings vazias, o que facilita a manipulação dos dados do formulário e evita erros de campos indefinidos
const INITIAL_FORM = {
    data_inicio: '',
    nome_completo: '',
    cartao_cidadao: '',
    nif: '',
    morada: '',
    localidade: '',
    codigo_postal: '',
    data_nascimento: '',
    telemovel: '',
    telefone: '',
    email: '',
    nivel_ensino: '',
    ano_escolar: '',
    turma: '',
    escola: '',
    ee_nome_completo: '',
    ee_parentesco: '',
    ee_cartao_cidadao: '',
    ee_morada: '',
    ee_localidade: '',
    ee_codigo_postal: '',
    ee_telemovel: '',
    ee_email: '',
    imagem_perfil_url: '',
};

// lista de campos obrigatórios para o formulário, usada para calcular o progresso do preenchimento e para validar os dados antes de enviar ao servidor
const REQUIRED_FIELDS = [
    'email',
    'nome_completo',
    'data_nascimento',
    'cartao_cidadao',
    'nif',
    'morada',
    'localidade',
    'codigo_postal',
    'escola',
    'nivel_ensino',
    'ano_escolar',
    'telemovel',
    'ee_nome_completo',
    'ee_parentesco',
    'ee_morada',
    'ee_localidade',
    'ee_codigo_postal',
    'ee_email',
    'ee_telemovel',
];

// classe base para os inputs do formulário, garantindo consistência visual e facilitando a manutenção do código, com estilos para borda, preenchimento, tamanho da fonte e foco
const inputBaseClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200';

const EDUCATION_LEVELS = [
    {
        value: 'pre-escolar',
        label: 'Pre-escolar',
        years: [{ value: '0', label: 'Pre-escolar' }],
    },
    {
        value: '1-ciclo',
        label: '1.º Ciclo',
        years: [
            { value: '1', label: '1.º ano' },
            { value: '2', label: '2.º ano' },
            { value: '3', label: '3.º ano' },
            { value: '4', label: '4.º ano' },
        ],
    },
    {
        value: '2-ciclo',
        label: '2.º Ciclo',
        years: [
            { value: '5', label: '5.º ano' },
            { value: '6', label: '6.º ano' },
        ],
    },
    {
        value: '3-ciclo',
        label: '3.º Ciclo',
        years: [
            { value: '7', label: '7.º ano' },
            { value: '8', label: '8.º ano' },
            { value: '9', label: '9.º ano' },
        ],
    },
    {
        value: 'secundario',
        label: 'Secundário',
        years: [
            { value: '10', label: '10.º ano' },
            { value: '11', label: '11.º ano' },
            { value: '12', label: '12.º ano' },
        ],
    },
];

export default function AddAlunoPage() {
    const navigate = useNavigate();
    const [touched, setTouched] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [form, setForm] = useState(INITIAL_FORM);
    const [photoName, setPhotoName] = useState('');
    const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const completedFields = useMemo(
        () =>
            REQUIRED_FIELDS.filter((field) => String(form[field]).trim() !== '')
                .length,
        [form]
    );
    const completionPercent = Math.round(
        (completedFields / REQUIRED_FIELDS.length) * 100
    );

    const validationErrors = useMemo(() => {
        const errors = {};

        const nifRegex = /^\d{9}$/;
        const postalCodeRegex = /^\d{4}-\d{3}$/;
        const phoneRegex = /^\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

        if (
            form.ee_codigo_postal &&
            !postalCodeRegex.test(form.ee_codigo_postal.trim())
        ) {
            errors.ee_codigo_postal =
                'Código postal inválido. Use o formato 0000-000.';
        }

        if (form.ee_email && !emailRegex.test(form.ee_email.trim())) {
            errors.ee_email = 'Email inválido.';
        }

        if (form.email && !emailRegex.test(form.email.trim())) {
            errors.email = 'Email do aluno inválido.';
        }

        if (form.data_nascimento && form.data_nascimento > todayIso) {
            errors.data_nascimento =
                'Data de nascimento não pode ser no futuro.';
        }

        if (form.telemovel && !phoneRegex.test(form.telemovel.trim())) {
            errors.telemovel = 'Telemóvel inválido. Deve conter 9 dígitos.';
        }

        if (form.ee_telemovel && !phoneRegex.test(form.ee_telemovel.trim())) {
            errors.ee_telemovel = 'Telemóvel inválido. Deve conter 9 dígitos.';
        }

        if (form.telefone && !phoneRegex.test(form.telefone.trim())) {
            errors.telefone = 'Telefone inválido. Deve conter 9 dígitos.';
        }

        return errors;
    }, [form, todayIso]);

    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    const showError = (fieldName) =>
        (touched[fieldName] || submitAttempted) &&
        Boolean(validationErrors[fieldName]);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
            ...(name === 'nivel_ensino' ? { ano_escolar: '' } : {}),
        }));
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

            const response = await apiPost('/api/gestor/alunos', form);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Não foi possível criar o aluno.'
                );
            }

            navigate('/gestor/alunos', { replace: true });
        } catch (error) {
            setSubmitError(error.message || 'Erro ao criar aluno.');
        } finally {
            setSubmitting(false);
        }
    }

    function handleCopyAlunoAddressToEncarregado() {
        setForm((prev) => ({
            ...prev,
            ee_morada: prev.morada,
            ee_localidade: prev.localidade,
            ee_codigo_postal: prev.codigo_postal,
        }));
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
            navigate('/gestor/alunos');
        }
    }

    const selectedEducationLevel = EDUCATION_LEVELS.find(
        (level) => level.value === form.nivel_ensino
    );
    const yearOptions = selectedEducationLevel?.years || [];

    return (
        <section className="w-full space-y-4 bg-slate-50 p-4 sm:p-6">
            <AdminPageHeader
                eyebrow="Alunos"
                title="Registar Aluno"
                subtitle="Criar uma nova ficha de aluno."
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
                                alt="Pré-visualização do aluno"
                                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                                <UserCircle2 size={36} />
                            </div>
                        )}
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#06b6d4] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#06b6d4]">
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
                            className="h-2 rounded-full bg-[#06b6d4] transition-all"
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
                                    placeholder="ex.: aluno@bloconotas.pt"
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
                                temporária e obriga a troca no primeiro login.
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
                                    className={inputBaseClass}
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Data de Nascimento *
                                <input
                                    type="date"
                                    name="data_nascimento"
                                    value={form.data_nascimento}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    max={todayIso}
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('data_nascimento')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('data_nascimento') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.data_nascimento}
                                    </p>
                                ) : null}
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
                                    className={inputBaseClass}
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
                                    className={inputBaseClass}
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
                                    className={inputBaseClass}
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
                            Informações escolares
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Escola *
                                <input
                                    type="text"
                                    name="escola"
                                    value={form.escola}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Nome da escola"
                                    required
                                    className={inputBaseClass}
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Nivel de Ensino *
                                <select
                                    name="nivel_ensino"
                                    value={form.nivel_ensino}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    className={inputBaseClass}
                                >
                                    <option value="">Selecionar nível</option>
                                    {EDUCATION_LEVELS.map((level) => (
                                        <option
                                            key={level.value}
                                            value={level.value}
                                        >
                                            {level.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block text-sm text-slate-700">
                                Ano *
                                <select
                                    name="ano_escolar"
                                    value={form.ano_escolar}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                    disabled={!form.nivel_ensino}
                                    className={inputBaseClass}
                                >
                                    <option value="">Selecionar ano</option>
                                    {yearOptions.map((year) => (
                                        <option
                                            key={year.value}
                                            value={year.value}
                                        >
                                            {year.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block text-sm text-slate-700">
                                Turma
                                <input
                                    type="text"
                                    name="turma"
                                    value={form.turma}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex: A, B, C"
                                    className={inputBaseClass}
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

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Informações do encarregado
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Nome Completo *
                                <input
                                    type="text"
                                    name="ee_nome_completo"
                                    value={form.ee_nome_completo}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Carla Martins"
                                    required
                                    className={inputBaseClass}
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Parentesco *
                                <input
                                    type="text"
                                    name="ee_parentesco"
                                    value={form.ee_parentesco}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Mãe, Pai"
                                    required
                                    className={inputBaseClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Morada do encarregado
                        </legend>
                        <button
                            type="button"
                            onClick={handleCopyAlunoAddressToEncarregado}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                            Copiar morada do aluno
                        </button>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Morada *
                                <input
                                    type="text"
                                    name="ee_morada"
                                    value={form.ee_morada}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Rua, número, andar"
                                    required
                                    className={inputBaseClass}
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Localidade *
                                <input
                                    type="text"
                                    name="ee_localidade"
                                    value={form.ee_localidade}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Ex.: Viseu"
                                    required
                                    className={inputBaseClass}
                                />
                            </label>

                            <label className="block text-sm text-slate-700">
                                Código Postal *
                                <input
                                    type="text"
                                    name="ee_codigo_postal"
                                    value={form.ee_codigo_postal}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="0000-000"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('ee_codigo_postal')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('ee_codigo_postal') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.ee_codigo_postal}
                                    </p>
                                ) : null}
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                            Contactos do encarregado
                        </legend>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="block text-sm text-slate-700 lg:col-span-2">
                                Email *
                                <input
                                    type="email"
                                    name="ee_email"
                                    value={form.ee_email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="encarregado@email.com"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('ee_email')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('ee_email') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.ee_email}
                                    </p>
                                ) : null}
                            </label>

                            <label className="block text-sm text-slate-700">
                                Telemóvel *
                                <input
                                    type="text"
                                    name="ee_telemovel"
                                    value={form.ee_telemovel}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="900 000 000"
                                    required
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                                        showError('ee_telemovel')
                                            ? 'border-red-300 focus:ring-red-200'
                                            : 'border-slate-300 focus:ring-emerald-200'
                                    }`}
                                />
                                {showError('ee_telemovel') ? (
                                    <p className="mt-1 text-xs text-red-600">
                                        {validationErrors.ee_telemovel}
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
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#06b6d4] px-12 py-2.5 text-sm font-medium text-white hover:bg-[#0891b2] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Save size={16} />
                        {submitting ? 'A guardar...' : 'Guardar'}
                    </button>
                </div>
            </form>
        </section>
    );
}
