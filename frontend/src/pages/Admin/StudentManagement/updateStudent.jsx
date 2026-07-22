import { useEffect, useState } from 'react';
import { Save, UserCircle2, Upload } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiGet, apiPatch } from '../../../utils/api';

// função para normalizar um número de telefone, removendo todos os caracteres não numéricos e limitando a 9 dígitos, garantindo que os números de telefone sejam armazenados em um formato consistente e válido
function normalizePhone(value) {
    return String(value || '')
        .replace(/\D/g, '')
        .slice(0, 9);
}

// função para normalizar um código postal, removendo todos os caracteres não numéricos e limitando a 7 dígitos, e formatando como "0000-000" caso tenha mais de 4 dígitos, garantindo que os códigos postais sejam armazenados em um formato consistente e válido
function normalizePostalCode(value) {
    const digits = String(value || '')
        .replace(/\D/g, '')
        .slice(0, 7);

    if (digits.length <= 4) {
        return digits;
    }

    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

// função para validar um endereço de email, garantindo que tenha o formato correto de email, e retornando true caso o valor seja inválido ou ausente, garantindo que os emails sejam armazenados em um formato consistente e válido
function isValidEmail(value) {
    if (!String(value || '').trim()) {
        return true;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

// função para validar um código postal, garantindo que tenha o formato "0000-000", e retornando true caso o valor seja inválido ou ausente, garantindo que os códigos postais sejam armazenados em um formato consistente e válido
function isValidPostalCode(value) {
    if (!String(value || '').trim()) {
        return true;
    }

    return /^\d{4}-\d{3}$/.test(String(value).trim());
}

// função para validar um número de telefone, garantindo que tenha exatamente 9 dígitos numéricos, e retornando true caso o valor seja inválido ou ausente, garantindo que os números de telefone sejam armazenados em um formato consistente e válido
function isValidPhone(value) {
    if (!String(value || '').trim()) {
        return true;
    }

    return /^\d{9}$/.test(normalizePhone(value));
}

// função para validar os campos do formulário de atualização de aluno, verificando a validade dos campos de email, código postal e telefone, e retornando um objeto com mensagens de erro para cada campo inválido, garantindo que os dados do aluno sejam validados antes de serem enviados para o servidor
function validateForm(values) {
    const errors = {};

    if (!isValidEmail(values.email)) {
        errors.email = 'Introduza um email válido.';
    }

    if (!isValidEmail(values.encarregado_email)) {
        errors.encarregado_email = 'Introduza um email válido.';
    }

    if (!isValidPostalCode(values.cod_postal)) {
        errors.cod_postal = 'Formato inválido. Use 0000-000.';
    }

    if (!isValidPostalCode(values.encarregado_cod_postal)) {
        errors.encarregado_cod_postal = 'Formato inválido. Use 0000-000.';
    }

    if (!isValidPhone(values.telemovel)) {
        errors.telemovel = 'Número inválido. Use 9 dígitos.';
    }

    if (!isValidPhone(values.telefone)) {
        errors.telefone = 'Número inválido. Use 9 dígitos.';
    }

    if (!isValidPhone(values.encarregado_telemovel)) {
        errors.encarregado_telemovel = 'Número inválido. Use 9 dígitos.';
    }

    if (!isValidPhone(values.encarregado_telefone)) {
        errors.encarregado_telefone = 'Número inválido. Use 9 dígitos.';
    }

    return errors;
}

export default function UpdateAlunoPage() {
    const navigate = useNavigate();
    const { id: alunoId } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [form, setForm] = useState({
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
        encarregado_nome: '',
        encarregado_parentesco: '',
        encarregado_morada: '',
        encarregado_localidade: '',
        encarregado_cod_postal: '',
        encarregado_telemovel: '',
        encarregado_telefone: '',
        encarregado_email: '',
        imagem_perfil_url: '',
    });
    const [photoName, setPhotoName] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadAluno() {
            if (!alunoId) {
                if (isMounted) {
                    setError('ID do aluno não especificado.');
                    setLoading(false);
                }
                return;
            }

            try {
                const response = await apiGet(`/api/gestor/alunos/${alunoId}`);
                const data = await response.json();

                if (response.ok && isMounted) {
                    setForm({
                        nome: data?.aluno?.pessoa?.nome || '',
                        data_nasc: data?.aluno?.pessoa?.data_nasc
                            ? String(data.aluno.pessoa.data_nasc).slice(0, 10)
                            : '',
                        cc: data?.aluno?.pessoa?.cc || '',
                        nif: data?.aluno?.pessoa?.nif || '',
                        email: data?.aluno?.pessoa?.user?.email || '',
                        telemovel: data?.aluno?.pessoa?.telemovel || '',
                        telefone: data?.aluno?.pessoa?.telefone || '',
                        morada: data?.aluno?.pessoa?.morada || '',
                        localidade: data?.aluno?.pessoa?.localidade || '',
                        cod_postal: data?.aluno?.pessoa?.cod_postal || '',
                        escola: data?.aluno?.escola || '',
                        ano:
                            data?.aluno?.ano == null
                                ? ''
                                : String(data.aluno.ano),
                        turma: data?.aluno?.turma || '',
                        encarregado_nome:
                            data?.aluno?.encarregado?.pessoa?.nome || '',
                        encarregado_parentesco:
                            data?.aluno?.encarregado?.parentesco || '',
                        encarregado_morada:
                            data?.aluno?.encarregado?.pessoa?.morada || '',
                        encarregado_localidade:
                            data?.aluno?.encarregado?.pessoa?.localidade || '',
                        encarregado_cod_postal:
                            data?.aluno?.encarregado?.pessoa?.cod_postal || '',
                        encarregado_telemovel:
                            data?.aluno?.encarregado?.pessoa?.telemovel || '',
                        encarregado_telefone:
                            data?.aluno?.encarregado?.pessoa?.telefone || '',
                        encarregado_email:
                            data?.aluno?.encarregado?.pessoa?.user?.email || '',
                        imagem_perfil_url:
                            data?.aluno?.pessoa?.user?.imagem_perfil_url || '',
                    });
                    setError('');
                    return;
                }

                const endpointMissing =
                    response.status === 404 &&
                    String(data?.message || '').includes(
                        'não existe neste servidor'
                    );

                if (endpointMissing) {
                    const listResponse = await apiGet(`/api/gestor/alunos`);
                    const listData = await listResponse.json();

                    if (!listResponse.ok) {
                        throw new Error(
                            listData?.message ||
                                'Erro ao carregar lista de alunos.'
                        );
                    }

                    const alunoResumo = Array.isArray(listData?.alunos)
                        ? listData.alunos.find(
                              (item) =>
                                  Number(item.id_aluno) === Number(alunoId)
                          )
                        : null;

                    if (!alunoResumo) {
                        throw new Error('Aluno não encontrado.');
                    }

                    if (isMounted) {
                        setForm({
                            nome: alunoResumo.nome || '',
                            data_nasc: '',
                            cc: '',
                            nif: alunoResumo.nif || '',
                            email: alunoResumo.email || '',
                            telemovel: alunoResumo.contacto || '',
                            telefone: '',
                            morada: '',
                            localidade: '',
                            cod_postal: '',
                            escola: alunoResumo.escola || '',
                            ano:
                                alunoResumo.ano == null
                                    ? ''
                                    : String(alunoResumo.ano),
                            turma: alunoResumo.turma || '',
                            encarregado_nome:
                                typeof alunoResumo.encarregado === 'string'
                                    ? alunoResumo.encarregado
                                    : '',
                            encarregado_parentesco: '',
                            encarregado_morada: '',
                            encarregado_localidade: '',
                            encarregado_cod_postal: '',
                            encarregado_telemovel: '',
                            encarregado_telefone: '',
                            encarregado_email: '',
                        });
                        setError('');
                    }
                    return;
                }

                throw new Error(
                    data?.message || 'Erro ao carregar dados do aluno.'
                );
            } catch (fetchError) {
                if (isMounted) {
                    setError(fetchError?.message || 'Erro ao carregar aluno.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadAluno();

        return () => {
            isMounted = false;
        };
    }, [alunoId]);

    function updateField(field, value) {
        let nextValue = value;

        if (
            [
                'telemovel',
                'telefone',
                'encarregado_telemovel',
                'encarregado_telefone',
            ].includes(field)
        ) {
            nextValue = normalizePhone(value);
        }

        if (['cod_postal', 'encarregado_cod_postal'].includes(field)) {
            nextValue = normalizePostalCode(value);
        }

        setForm((prev) => ({ ...prev, [field]: nextValue }));
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    function handlePhotoChange(event) {
        const file = event.target.files?.[0];

        if (!file || !file.type.startsWith('image/')) {
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            setError('A foto não pode exceder 3MB.');
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
        setError('');
        setSuccessMessage('');

        const validationErrors = validateForm(form);
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            setError('Existem campos inválidos. Corrija antes de guardar.');
            return;
        }

        setFieldErrors({});
        setSubmitting(true);

        try {
            const payload = {
                nome: form.nome.trim(),
                data_nasc: form.data_nasc || undefined,
                cc: form.cc.trim() || undefined,
                nif: form.nif.trim() || undefined,
                email: form.email.trim() || undefined,
                telemovel: form.telemovel.trim() || undefined,
                telefone: form.telefone.trim() || undefined,
                morada: form.morada.trim() || undefined,
                localidade: form.localidade.trim() || undefined,
                cod_postal: form.cod_postal.trim() || undefined,
                escola: form.escola.trim() || undefined,
                ano: form.ano === '' ? undefined : String(form.ano).trim(),
                turma: form.turma.trim() || undefined,
                encarregado_nome: form.encarregado_nome.trim() || undefined,
                encarregado_parentesco:
                    form.encarregado_parentesco.trim() || undefined,
                encarregado_morada: form.encarregado_morada.trim() || undefined,
                encarregado_localidade:
                    form.encarregado_localidade.trim() || undefined,
                encarregado_cod_postal:
                    form.encarregado_cod_postal.trim() || undefined,
                encarregado_telemovel:
                    form.encarregado_telemovel.trim() || undefined,
                encarregado_telefone:
                    form.encarregado_telefone.trim() || undefined,
                encarregado_email: form.encarregado_email.trim() || undefined,
                imagem_perfil_url: form.imagem_perfil_url || undefined,
            };

            const response = await apiPatch(
                `/api/gestor/alunos/${alunoId}`,
                payload
            );

            const data = await response.json();
            if (!response.ok) {
                const details = Array.isArray(data?.details?.errors)
                    ? data.details.errors.join(' | ')
                    : '';
                throw new Error(
                    details
                        ? `${data?.message || 'Não foi possível atualizar o aluno.'} (${details})`
                        : data?.message || 'Não foi possível atualizar o aluno.'
                );
            }

            setSuccessMessage('Aluno atualizado com sucesso.');
            setTimeout(() => navigate(`/gestor/alunos/ficha/${alunoId}`), 600);
        } catch (submitError) {
            setError(submitError?.message || 'Erro ao atualizar aluno.');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="text-sm text-slate-500">
                    A carregar aluno da base de dados...
                </p>
            </section>
        );
    }

    if (error && !form.nome && !form.nif && !form.escola) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <p className="text-sm text-slate-500">{error}</p>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => navigate('/gestor/alunos')}
                >
                    Voltar à lista de alunos
                </button>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-5xl space-y-5">
            <AdminPageHeader
                eyebrow="Alunos"
                title="Atualizar Aluno"
                subtitle="Edite os dados e guarde as alterações."
            />

            <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
                {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {successMessage ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {successMessage}
                    </div>
                ) : null}

                <div className="flex items-center gap-4">
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

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#14ad81] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#14ad81]">
                        <Upload size={16} />
                        Alterar Foto
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

                <fieldset className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-slate-700">
                        Informações pessoais
                    </legend>
                    <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="text-sm text-slate-700">
                            Nome completo
                            <input
                                type="text"
                                value={form.nome}
                                onChange={(event) =>
                                    updateField('nome', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Data de nascimento
                            <input
                                type="date"
                                value={form.data_nasc}
                                onChange={(event) =>
                                    updateField('data_nasc', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Cartão de cidadão
                            <input
                                type="text"
                                value={form.cc}
                                onChange={(event) =>
                                    updateField('cc', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            NIF
                            <input
                                type="text"
                                value={form.nif}
                                onChange={(event) =>
                                    updateField('nif', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </label>

                        <label className="text-sm text-slate-700 md:col-span-2">
                            Email
                            <input
                                type="email"
                                value={form.email}
                                onChange={(event) =>
                                    updateField('email', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                            {fieldErrors.email ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.email}
                                </span>
                            ) : null}
                        </label>
                    </div>
                </fieldset>

                <fieldset className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-slate-700">
                        Morada e contactos
                    </legend>
                    <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="text-sm text-slate-700 md:col-span-2">
                            Morada
                            <input
                                type="text"
                                value={form.morada}
                                onChange={(event) =>
                                    updateField('morada', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Localidade
                            <input
                                type="text"
                                value={form.localidade}
                                onChange={(event) =>
                                    updateField(
                                        'localidade',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Código postal
                            <input
                                type="text"
                                value={form.cod_postal}
                                onChange={(event) =>
                                    updateField(
                                        'cod_postal',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="0000-000"
                                maxLength={8}
                            />
                            {fieldErrors.cod_postal ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.cod_postal}
                                </span>
                            ) : null}
                        </label>

                        <label className="text-sm text-slate-700">
                            Telemóvel
                            <input
                                type="text"
                                value={form.telemovel}
                                onChange={(event) =>
                                    updateField('telemovel', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                inputMode="numeric"
                                maxLength={9}
                            />
                            {fieldErrors.telemovel ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.telemovel}
                                </span>
                            ) : null}
                        </label>

                        <label className="text-sm text-slate-700">
                            Telefone
                            <input
                                type="text"
                                value={form.telefone}
                                onChange={(event) =>
                                    updateField('telefone', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                inputMode="numeric"
                                maxLength={9}
                            />
                            {fieldErrors.telefone ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.telefone}
                                </span>
                            ) : null}
                        </label>
                    </div>
                </fieldset>

                <fieldset className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-slate-700">
                        Informações escolares
                    </legend>
                    <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <label className="text-sm text-slate-700 md:col-span-3">
                            Escola
                            <input
                                type="text"
                                value={form.escola}
                                onChange={(event) =>
                                    updateField('escola', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Ano
                            <input
                                type="number"
                                min="1"
                                max="13"
                                value={form.ano}
                                onChange={(event) =>
                                    updateField('ano', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Turma
                            <input
                                type="text"
                                value={form.turma}
                                onChange={(event) =>
                                    updateField('turma', event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                    </div>
                </fieldset>

                <fieldset className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-slate-700">
                        Encarregado de educação
                    </legend>
                    <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="text-sm text-slate-700 md:col-span-2">
                            Nome do encarregado
                            <input
                                type="text"
                                value={form.encarregado_nome}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_nome',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Parentesco
                            <input
                                type="text"
                                value={form.encarregado_parentesco}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_parentesco',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Email do encarregado
                            <input
                                type="email"
                                value={form.encarregado_email}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_email',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {fieldErrors.encarregado_email ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.encarregado_email}
                                </span>
                            ) : null}
                        </label>

                        <label className="text-sm text-slate-700 md:col-span-2">
                            Morada do encarregado
                            <input
                                type="text"
                                value={form.encarregado_morada}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_morada',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Localidade
                            <input
                                type="text"
                                value={form.encarregado_localidade}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_localidade',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Código postal
                            <input
                                type="text"
                                value={form.encarregado_cod_postal}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_cod_postal',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="0000-000"
                                maxLength={8}
                            />
                            {fieldErrors.encarregado_cod_postal ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.encarregado_cod_postal}
                                </span>
                            ) : null}
                        </label>

                        <label className="text-sm text-slate-700">
                            Telemóvel
                            <input
                                type="text"
                                value={form.encarregado_telemovel}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_telemovel',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                inputMode="numeric"
                                maxLength={9}
                            />
                            {fieldErrors.encarregado_telemovel ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.encarregado_telemovel}
                                </span>
                            ) : null}
                        </label>

                        <label className="text-sm text-slate-700">
                            Telefone
                            <input
                                type="text"
                                value={form.encarregado_telefone}
                                onChange={(event) =>
                                    updateField(
                                        'encarregado_telefone',
                                        event.target.value
                                    )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                inputMode="numeric"
                                maxLength={9}
                            />
                            {fieldErrors.encarregado_telefone ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {fieldErrors.encarregado_telefone}
                                </span>
                            ) : null}
                        </label>
                    </div>
                </fieldset>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(`/gestor/alunos/ficha/${alunoId}`)
                        }
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                    >
                        <Save size={16} />
                        {submitting ? 'A guardar...' : 'Guardar alterações'}
                    </button>
                </div>
            </form>
        </section>
    );
}
