import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Save, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost } from '../../../utils/api';
import defaultAvatar from '../../../assets/img/default-avatar.svg';
import UsersPageHeader from '../../../components/layout/UsersPageHeader';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET =
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const IS_CLOUDINARY_CONFIGURED =
    Boolean(CLOUDINARY_CLOUD_NAME) && Boolean(CLOUDINARY_UPLOAD_PRESET);

const EMPTY_FORM = {
    password_atual: '',
    password_nova: '',
    password_confirm: '',
    nome: '',
    data_nasc: '',
    cc: '',
    nif: '',
    email: '',
    telemovel: '',
    telefone: '',
    morada: '',
    localidade: '',
    cod_postal: '',
    escola: '',
    ano: '',
    turma: '',
    imagem_perfil_url: '',
    encarregado_nome: '',
    encarregado_parentesco: '',
    encarregado_morada: '',
    encarregado_localidade: '',
    encarregado_cod_postal: '',
    encarregado_email: '',
    encarregado_telemovel: '',
};

function getStoredUser() {
    try {
        return JSON.parse(
            localStorage.getItem('mc_user') ||
                localStorage.getItem('user') ||
                '{}'
        );
    } catch {
        return {};
    }
}

function toFormFromApi(alunoData) {
    const pessoa = alunoData?.pessoa || {};
    const user = pessoa?.user || {};

    return {
        password_atual: '',
        password_nova: '',
        password_confirm: '',
        nome: pessoa?.nome || '',
        data_nasc: pessoa?.data_nasc
            ? String(pessoa.data_nasc).slice(0, 10)
            : '',
        cc: pessoa?.cc || '',
        nif: pessoa?.nif || '',
        email: user?.email || '',
        telemovel: pessoa?.telemovel || '',
        telefone: pessoa?.telefone || '',
        morada: pessoa?.morada || '',
        localidade: pessoa?.localidade || '',
        cod_postal: pessoa?.cod_postal || '',
        escola: alunoData?.escola || '',
        ano: alunoData?.ano == null ? '' : String(alunoData.ano),
        turma: alunoData?.turma || '',
        imagem_perfil_url:
            pessoa?.imagem_perfil_url || user?.imagem_perfil_url || '',
        encarregado_nome: alunoData?.encarregado_nome || '',
        encarregado_parentesco: alunoData?.encarregado_parentesco || '',
        encarregado_morada: alunoData?.encarregado_morada || '',
        encarregado_localidade: alunoData?.encarregado_localidade || '',
        encarregado_cod_postal: alunoData?.encarregado_cod_postal || '',
        encarregado_email: alunoData?.encarregado_email || '',
        encarregado_telemovel: alunoData?.encarregado_telemovel || '',
    };
}

async function uploadImageToCloudinary(file) {
    if (!IS_CLOUDINARY_CONFIGURED) {
        throw new Error(
            'Cloudinary não configurado. Defina VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET.'
        );
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message || 'Não foi possível enviar a imagem.'
        );
    }

    return data?.secure_url || data?.url || '';
}

export default function UpdatePerfilAlunoPage() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [backendSupportMessage, setBackendSupportMessage] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [photoName, setPhotoName] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');

    const storedUser = useMemo(() => getStoredUser(), []);

    useEffect(() => {
        let isMounted = true;

        async function loadPerfil() {
            try {
                const response = await apiGet('/api/aluno/perfil');
                const data = await response.json();

                if (response.ok) {
                    if (isMounted) {
                        setForm((prev) => ({
                            ...prev,
                            ...toFormFromApi(data?.aluno),
                        }));
                        setError('');
                    }
                    return;
                }

                if (response.status === 404 || response.status === 403) {
                    if (isMounted) {
                        setBackendSupportMessage(
                            'O endpoint /api/aluno/perfil ainda não está disponível. Pode editar os campos e a UI já está pronta para integrar quando ativarmos o backend e o Cloudinary.'
                        );
                        // Carregar todo o formulário do localStorage como fallback
                        setForm((prev) => ({
                            ...prev,
                            nome:
                                storedUser?.nome ||
                                storedUser?.name ||
                                prev.nome,
                            email: storedUser?.email || prev.email,
                            telemovel:
                                storedUser?.telemovel ||
                                storedUser?.phone ||
                                prev.telemovel,
                            telefone:
                                storedUser?.telefone ||
                                storedUser?.tel ||
                                prev.telefone,
                            data_nasc: storedUser?.data_nasc || prev.data_nasc,
                            cc: storedUser?.cc || prev.cc,
                            nif: storedUser?.nif || prev.nif,
                            morada:
                                storedUser?.morada ||
                                storedUser?.address ||
                                prev.morada,
                            localidade:
                                storedUser?.localidade ||
                                storedUser?.city ||
                                prev.localidade,
                            cod_postal:
                                storedUser?.cod_postal ||
                                storedUser?.postal_code ||
                                prev.cod_postal,
                            escola:
                                storedUser?.escola ||
                                storedUser?.school ||
                                prev.escola,
                            ano:
                                storedUser?.ano || storedUser?.year || prev.ano,
                            turma:
                                storedUser?.turma ||
                                storedUser?.class ||
                                prev.turma,
                            imagem_perfil_url:
                                storedUser?.imagem_perfil_url ||
                                prev.imagem_perfil_url,
                        }));
                    }
                    return;
                }

                throw new Error(data?.message || 'Erro ao carregar perfil.');
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError?.message ||
                            'Não foi possível carregar os dados do perfil.'
                    );
                    setForm((prev) => ({
                        ...prev,
                        nome: storedUser?.nome || storedUser?.name || prev.nome,
                        email: storedUser?.email || prev.email,
                        imagem_perfil_url:
                            storedUser?.imagem_perfil_url ||
                            prev.imagem_perfil_url,
                    }));
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadPerfil();

        return () => {
            isMounted = false;
        };
    }, [storedUser]);

    useEffect(() => {
        if (!selectedImageFile) {
            setPreviewUrl('');
            return undefined;
        }

        const objectUrl = URL.createObjectURL(selectedImageFile);
        setPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [selectedImageFile]);

    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function handleImageSelection(event) {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedImageFile(null);
            setPhotoName('');
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError(
                'Selecione um ficheiro de imagem válido (PNG, JPG, WebP, etc.).'
            );
            setSelectedImageFile(null);
            setPhotoName('');
            return;
        }

        setError('');
        setSelectedImageFile(file);
        setPhotoName(file.name);
    }

    function copyStudentAddressToGuardian() {
        setForm((prev) => ({
            ...prev,
            encarregado_morada: prev.morada,
            encarregado_localidade: prev.localidade,
            encarregado_cod_postal: prev.cod_postal,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        setSuccess('');

        // Validar campos obrigatórios
        const missingFields = [];
        if (!form.nome.trim()) missingFields.push('nome');
        // Email pode vir do formulário ou do localStorage
        if (!form.email.trim() && !storedUser?.email)
            missingFields.push('email');
        if (!form.telemovel.trim()) missingFields.push('telemóvel');

        if (missingFields.length > 0) {
            setError(
                `Preencha os campos obrigatórios: ${missingFields.join(', ')}.`
            );
            return;
        }

        const passwordFieldsFilled =
            form.password_atual || form.password_nova || form.password_confirm;
        if (passwordFieldsFilled) {
            if (
                !form.password_atual ||
                !form.password_nova ||
                !form.password_confirm
            ) {
                setError('Para alterar a password, preencha os três campos.');
                return;
            }

            if (form.password_nova !== form.password_confirm) {
                setError('A nova password não coincide.');
                return;
            }

            if (form.password_nova === form.password_atual) {
                setError('A nova password não pode ser igual à password atual.');
                return;
            }
        }

        setSubmitting(true);

        try {
            let imageUrl = form.imagem_perfil_url.trim() || '';

            if (selectedImageFile) {
                if (IS_CLOUDINARY_CONFIGURED) {
                    imageUrl = await uploadImageToCloudinary(selectedImageFile);
                } else {
                    setBackendSupportMessage(
                        'Upload de foto indisponível: Cloudinary não configurado. Os restantes dados foram guardados sem alterar a foto.'
                    );
                }
            }

            // Garantir que o email é sempre fornecido (do formulário ou do localStorage)
            const emailToSave = form.email.trim() || storedUser?.email || '';

            const payload = {
                nome: form.nome.trim(),
                data_nasc: form.data_nasc || null,
                cc: form.cc.trim() || null,
                nif: form.nif.trim() || null,
                email: emailToSave,
                telemovel: form.telemovel.trim(),
                telefone: form.telefone.trim() || null,
                morada: form.morada.trim() || null,
                localidade: form.localidade.trim() || null,
                cod_postal: form.cod_postal.trim() || null,
                escola: form.escola.trim() || null,
                ano: form.ano === '' ? null : Number(form.ano),
                turma: form.turma.trim() || null,
                imagem_perfil_url: imageUrl || null,
                encarregado_nome: form.encarregado_nome.trim() || null,
                encarregado_parentesco:
                    form.encarregado_parentesco.trim() || null,
                encarregado_morada: form.encarregado_morada.trim() || null,
                encarregado_localidade:
                    form.encarregado_localidade.trim() || null,
                encarregado_cod_postal:
                    form.encarregado_cod_postal.trim() || null,
                encarregado_telemovel:
                    form.encarregado_telemovel.trim() || null,
                encarregado_telefone: form.encarregado_telemovel.trim() || null,
                encarregado_email: form.encarregado_email.trim() || null,
            };

            const response = await apiPatch('/api/aluno/perfil', payload);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404 || response.status === 403) {
                    throw new Error(
                        'Backend de perfil do aluno ainda não disponível. A página já está pronta; falta apenas ativar o endpoint e integrar upload Cloudinary.'
                    );
                }
                throw new Error(
                    data?.message || 'Não foi possível guardar as alterações.'
                );
            }

            if (passwordFieldsFilled) {
                const passwordResponse = await apiPost(
                    '/api/auth/alterar-password',
                    {
                        passwordAtual: form.password_atual,
                        passwordNova: form.password_nova,
                        passwordNovaConfirm: form.password_confirm,
                    }
                );

                const passwordData = await passwordResponse.json();
                if (!passwordResponse.ok) {
                    throw new Error(
                        passwordData?.message ||
                            'Não foi possível alterar a password.'
                    );
                }
            }

            setSuccess(
                data?.message ||
                    'As suas alterações foram submetidas e aguardam aprovação do gestor.'
            );
            setTimeout(() => navigate('/aluno/perfil'), 1200);
        } catch (submitError) {
            setError(submitError?.message || 'Erro ao guardar alterações.');
        } finally {
            setSubmitting(false);
        }
    }

    const avatarSrc = previewUrl || form.imagem_perfil_url || defaultAvatar;
    const fieldClass =
        'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#14ad81] focus:ring-4 focus:ring-[#d1f3ea]';
    const sectionClass =
        'rounded-xl border border-slate-200 bg-white p-4 sm:p-5';

    if (loading) {
        return (
            <section className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                <div className="w-full">
                    <div className="mb-4">
                        <div className="h-8 w-40 rounded bg-slate-200" />
                    </div>
                    <div className="w-full rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="animate-pulse space-y-5">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-full bg-slate-200" />
                                <div className="h-10 w-36 rounded-full bg-slate-200" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="h-24 rounded-2xl bg-slate-100" />
                                <div className="h-24 rounded-2xl bg-slate-100" />
                                <div className="h-24 rounded-2xl bg-slate-100 sm:col-span-2" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Perfil"
                title="Editar Perfil"
                subtitle="Atualize suas informações pessoais e profissionais."
                icon={UserRound}
            />

            <div className="w-full rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-50 text-slate-500">
                        <img
                            src={avatarSrc}
                            alt="Pré-visualização da imagem de perfil"
                            className="h-full w-full rounded-full object-cover"
                            onError={(event) => {
                                const image = event.currentTarget;
                                if (image.dataset.fallbackApplied === '1') {
                                    return;
                                }

                                image.dataset.fallbackApplied = '1';
                                image.src = defaultAvatar;
                            }}
                        />
                    </div>

                    <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-full bg-[#14ad81] px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-[#0f8d69]">
                        Carregar Foto
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelection}
                        />
                    </label>
                    {photoName ? (
                        <p className="text-xs text-slate-500">{photoName}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                        Se não carregar uma imagem, será usado o avatar por
                        defeito.
                    </p>
                </div>

                {backendSupportMessage ? (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {backendSupportMessage}
                    </div>
                ) : null}

                {error ? (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <p className="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </p>
                    </div>
                ) : null}

                {success ? (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {success}
                    </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Informações de início de sessão
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-3">
                            <label className="block text-sm text-slate-700">
                                Password Atual
                                <input
                                    type="password"
                                    value={form.password_atual}
                                    onChange={(event) =>
                                        updateField(
                                            'password_atual',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Digite a password temporária"
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Nova Password
                                <input
                                    type="password"
                                    value={form.password_nova}
                                    onChange={(event) =>
                                        updateField(
                                            'password_nova',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Mínimo 8 caracteres"
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Repetir Nova Password
                                <input
                                    type="password"
                                    value={form.password_confirm}
                                    onChange={(event) =>
                                        updateField(
                                            'password_confirm',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Repita a nova password"
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Informações pessoais
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <label className="block text-sm text-slate-700 md:col-span-2">
                                Nome Completo *
                                <input
                                    type="text"
                                    value={form.nome}
                                    onChange={(event) =>
                                        updateField('nome', event.target.value)
                                    }
                                    className={fieldClass}
                                    required
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Cartão de Cidadão *
                                <input
                                    type="text"
                                    value={form.cc}
                                    onChange={(event) =>
                                        updateField('cc', event.target.value)
                                    }
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                NIF
                                <input
                                    type="text"
                                    value={form.nif}
                                    readOnly
                                    className={`${fieldClass} cursor-not-allowed bg-slate-100 text-slate-500`}
                                    placeholder="Gerido internamente"
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Data de nascimento
                                <input
                                    type="date"
                                    value={form.data_nasc}
                                    onChange={(event) =>
                                        updateField(
                                            'data_nasc',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Morada
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <label className="block text-sm text-slate-700 md:col-span-2">
                                Morada *
                                <input
                                    type="text"
                                    value={form.morada}
                                    onChange={(event) =>
                                        updateField(
                                            'morada',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Rua, número, andar"
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Localidade *
                                <input
                                    type="text"
                                    value={form.localidade}
                                    onChange={(event) =>
                                        updateField(
                                            'localidade',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Código Postal *
                                <input
                                    type="text"
                                    value={form.cod_postal}
                                    onChange={(event) =>
                                        updateField(
                                            'cod_postal',
                                            event.target.value
                                        )
                                    }
                                    placeholder="0000-000"
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Informações escolares
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                            <label className="block text-sm text-slate-700 lg:col-span-1">
                                Escola *
                                <input
                                    type="text"
                                    value={form.escola}
                                    onChange={(event) =>
                                        updateField(
                                            'escola',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Ano *
                                <input
                                    type="number"
                                    min="1"
                                    max="13"
                                    value={form.ano}
                                    onChange={(event) =>
                                        updateField('ano', event.target.value)
                                    }
                                    placeholder="Ex: 10º ano"
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Turma *
                                <input
                                    type="text"
                                    value={form.turma}
                                    onChange={(event) =>
                                        updateField('turma', event.target.value)
                                    }
                                    placeholder="Ex: A, B, C"
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Contactos
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <label className="block text-sm text-slate-700">
                                Telemóvel *
                                <input
                                    type="text"
                                    value={form.telemovel}
                                    onChange={(event) =>
                                        updateField(
                                            'telemovel',
                                            event.target.value
                                        )
                                    }
                                    placeholder="900 000 000"
                                    className={fieldClass}
                                    required
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Telefone
                                <input
                                    type="text"
                                    value={form.telefone}
                                    onChange={(event) =>
                                        updateField(
                                            'telefone',
                                            event.target.value
                                        )
                                    }
                                    placeholder="200 000 000"
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Informações do encarregado
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <label className="block text-sm text-slate-700 md:col-span-2">
                                Nome Completo *
                                <input
                                    type="text"
                                    value={form.encarregado_nome}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_nome',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Parentesco *
                                <input
                                    type="text"
                                    value={form.encarregado_parentesco}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_parentesco',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Morada do encarregado
                        </legend>
                        <div className="mt-2">
                            <button
                                type="button"
                                onClick={copyStudentAddressToGuardian}
                                className="text-sm font-medium text-[#14ad81] hover:text-[#0f8d69]"
                            >
                                Copiar morada do aluno
                            </button>
                        </div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <label className="block text-sm text-slate-700 md:col-span-2">
                                Morada *
                                <input
                                    type="text"
                                    value={form.encarregado_morada}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_morada',
                                            event.target.value
                                        )
                                    }
                                    placeholder="Rua, número, andar"
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Localidade *
                                <input
                                    type="text"
                                    value={form.encarregado_localidade}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_localidade',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Código Postal *
                                <input
                                    type="text"
                                    value={form.encarregado_cod_postal}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_cod_postal',
                                            event.target.value
                                        )
                                    }
                                    placeholder="0000-000"
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                            Contactos do encarregado
                        </legend>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <label className="block text-sm text-slate-700">
                                Email *
                                <input
                                    type="email"
                                    value={form.encarregado_email}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_email',
                                            event.target.value
                                        )
                                    }
                                    className={fieldClass}
                                />
                            </label>
                            <label className="block text-sm text-slate-700">
                                Telemóvel *
                                <input
                                    type="text"
                                    value={form.encarregado_telemovel}
                                    onChange={(event) =>
                                        updateField(
                                            'encarregado_telemovel',
                                            event.target.value
                                        )
                                    }
                                    placeholder="900 000 000"
                                    className={fieldClass}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <div className="flex flex-col items-center justify-center gap-3 border-t border-slate-200 pt-4 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => navigate('/aluno/perfil')}
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#14ad81] px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f8d69] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Save size={16} />
                            {submitting ? 'A guardar...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
