import { useEffect, useState } from 'react';
import { Save, UserCircle2, Upload } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiGet, apiPatch } from '../../../utils/api';

export default function UpdateProfPage() {
    const navigate = useNavigate();
    const { id: profId } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
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
        habilitacao: '',
        area_ensino: '',
        nivel: '',
        imagem_perfil_url: '',
    });
    const [photoName, setPhotoName] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadProfessor() {
            if (!profId) {
                if (isMounted) {
                    setError('ID do professor não especificado.');
                    setLoading(false);
                }
                return;
            }

            try {
                const response = await apiGet(
                    `/api/gestor/professores/${profId}`
                );
                const data = await response.json();

                if (response.ok && isMounted) {
                    setForm({
                        nome: data?.professor?.pessoa?.nome || '',
                        data_nasc: data?.professor?.pessoa?.data_nasc
                            ? String(data.professor.pessoa.data_nasc).slice(
                                  0,
                                  10
                              )
                            : '',
                        cc: data?.professor?.pessoa?.cc || '',
                        nif: data?.professor?.pessoa?.nif || '',
                        email: data?.professor?.pessoa?.user?.email || '',
                        telemovel: data?.professor?.pessoa?.telemovel || '',
                        telefone: data?.professor?.pessoa?.telefone || '',
                        morada: data?.professor?.pessoa?.morada || '',
                        localidade: data?.professor?.pessoa?.localidade || '',
                        cod_postal: data?.professor?.pessoa?.cod_postal || '',
                        habilitacao: data?.professor?.habilitacao || '',
                        area_ensino: data?.professor?.area_ensino || '',
                        nivel: data?.professor?.nivel || '',
                        imagem_perfil_url:
                            data?.professor?.pessoa?.user
                                ?.imagem_perfil_url || '',
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
                    const listResponse = await apiGet(
                        `/api/gestor/professores`
                    );
                    const listData = await listResponse.json();

                    if (!listResponse.ok) {
                        throw new Error(
                            listData?.message ||
                                'Erro ao carregar lista de professores.'
                        );
                    }

                    const profResumo = Array.isArray(listData?.professores)
                        ? listData.professores.find(
                              (item) =>
                                  Number(item.id_professor) === Number(profId)
                          )
                        : null;

                    if (!profResumo) {
                        throw new Error('Professor não encontrado.');
                    }

                    if (isMounted) {
                        setForm({
                            nome: profResumo.nome || '',
                            data_nasc: '',
                            cc: '',
                            nif: profResumo.nif || '',
                            email: profResumo.email || '',
                            telemovel: profResumo.contacto || '',
                            telefone: '',
                            morada: '',
                            localidade: '',
                            cod_postal: '',
                            habilitacao: profResumo.habilitacao || '',
                            area_ensino: profResumo.area_ensino || '',
                            nivel: profResumo.nivel || '',
                        });
                        setError('');
                    }
                    return;
                }

                throw new Error(
                    data?.message || 'Erro ao carregar dados do professor.'
                );
            } catch (fetchError) {
                if (isMounted) {
                    setError(
                        fetchError?.message || 'Erro ao carregar professor.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadProfessor();

        return () => {
            isMounted = false;
        };
    }, [profId]);

    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
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
        setSubmitting(true);
        setError('');
        setSuccessMessage('');

        try {
            const response = await apiPatch(
                `/api/gestor/professores/${profId}`,
                {
                    nome: form.nome.trim(),
                    data_nasc: form.data_nasc || null,
                    cc: form.cc.trim(),
                    nif: form.nif.trim(),
                    email: form.email.trim(),
                    telemovel: form.telemovel.trim(),
                    telefone: form.telefone.trim() || null,
                    morada: form.morada.trim(),
                    localidade: form.localidade.trim(),
                    cod_postal: form.cod_postal.trim(),
                    habilitacao: form.habilitacao.trim(),
                    area_ensino: form.area_ensino.trim(),
                    nivel: form.nivel.trim(),
                    imagem_perfil_url: form.imagem_perfil_url || undefined,
                }
            );

            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data?.message || 'Não foi possível atualizar o professor.'
                );
            }

            setSuccessMessage('Professor atualizado com sucesso.');
            setTimeout(
                () => navigate(`/gestor/professores/ficha/${profId}`),
                600
            );
        } catch (submitError) {
            setError(submitError?.message || 'Erro ao atualizar professor.');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="text-sm text-slate-500">
                    A carregar professor da base de dados...
                </p>
            </section>
        );
    }

    if (error && !form.nome && !form.nif && !form.habilitacao) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
                <p className="text-sm text-slate-500">{error}</p>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => navigate('/gestor/professores')}
                >
                    Voltar à lista de professores
                </button>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-5xl space-y-5">
            <AdminPageHeader
                eyebrow="Professores"
                title="Atualizar Professor"
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
                                alt="Pré-visualização do professor"
                                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                                <UserCircle2 size={36} />
                            </div>
                        )}
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-york-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500">
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
                                onChange={(e) =>
                                    updateField('nome', e.target.value)
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
                                onChange={(e) =>
                                    updateField('data_nasc', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            Cartão de cidadão
                            <input
                                type="text"
                                value={form.cc}
                                onChange={(e) =>
                                    updateField('cc', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="text-sm text-slate-700">
                            NIF
                            <input
                                type="text"
                                value={form.nif}
                                onChange={(e) =>
                                    updateField('nif', e.target.value)
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
                                onChange={(e) =>
                                    updateField('email', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
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
                                onChange={(e) =>
                                    updateField('morada', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="text-sm text-slate-700">
                            Localidade
                            <input
                                type="text"
                                value={form.localidade}
                                onChange={(e) =>
                                    updateField('localidade', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="text-sm text-slate-700">
                            Código postal
                            <input
                                type="text"
                                value={form.cod_postal}
                                onChange={(e) =>
                                    updateField('cod_postal', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="text-sm text-slate-700">
                            Telemóvel
                            <input
                                type="text"
                                value={form.telemovel}
                                onChange={(e) =>
                                    updateField('telemovel', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="text-sm text-slate-700">
                            Telefone
                            <input
                                type="text"
                                value={form.telefone}
                                onChange={(e) =>
                                    updateField('telefone', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                    </div>
                </fieldset>

                <fieldset className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-slate-700">
                        Informações profissionais
                    </legend>
                    <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="text-sm text-slate-700">
                            Habilitação
                            <input
                                type="text"
                                value={form.habilitacao}
                                onChange={(e) =>
                                    updateField('habilitacao', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="text-sm text-slate-700">
                            Área de ensino
                            <input
                                type="text"
                                value={form.area_ensino}
                                onChange={(e) =>
                                    updateField('area_ensino', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="text-sm text-slate-700 md:col-span-2">
                            Nível
                            <input
                                type="text"
                                value={form.nivel}
                                onChange={(e) =>
                                    updateField('nivel', e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </label>
                    </div>
                </fieldset>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(`/gestor/professores/ficha/${profId}`)
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
