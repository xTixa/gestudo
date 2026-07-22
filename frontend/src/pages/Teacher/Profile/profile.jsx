import { useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
    Briefcase,
    Edit3,
    Mail,
    MapPin,
    Phone,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../../utils/api';
import defaultAvatar from '../../../assets/img/default-avatar.svg';
import UsersPageHeader from '../../../components/layout/UsersPageHeader';

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

function formatDateLabel(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(String(value).slice(0, 10));
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function buildProfileSnapshot(profile, storedUser) {
    const pessoa = profile?.pessoa || {};
    const user = pessoa?.user || {};

    return {
        nome:
            profile?.nome ||
            pessoa?.nome ||
            storedUser?.nome ||
            storedUser?.name ||
            '-',
        email: profile?.email || user?.email || storedUser?.email || '-',
        data_nasc:
            profile?.data_nascimento ||
            profile?.data_nasc ||
            pessoa?.data_nasc ||
            '',
        cc: profile?.cc || pessoa?.cc || '-',
        nif: profile?.nif || pessoa?.nif || '-',
        telemovel: profile?.telemovel || pessoa?.telemovel || '-',
        telefone: profile?.telefone || pessoa?.telefone || '-',
        morada: profile?.morada || pessoa?.morada || '-',
        localidade: profile?.localidade || pessoa?.localidade || '-',
        cod_postal:
            profile?.codigo_postal ||
            profile?.cod_postal ||
            pessoa?.cod_postal ||
            '-',
        habilitacao: profile?.habilitacao || profile?.habilitacoes || '-',
        area_ensino: profile?.area_ensino || profile?.area || '-',
        nivel: profile?.nivel || profile?.grau || '-',
        imagem_perfil_url:
            profile?.imagem_perfil_url ||
            pessoa?.imagem_perfil_url ||
            user?.imagem_perfil_url ||
            storedUser?.imagem_perfil_url ||
            '',
        disciplinas: Array.isArray(profile?.disciplinas)
            ? profile.disciplinas
            : [],
    };
}

function SectionCard({ title, children }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-700">
                    {title}
                </div>
            </div>
            <div className="px-5 py-4">{children}</div>
        </section>
    );
}

function Field({ label, value }) {
    return (
        <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {label}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
                {value || '-'}
            </p>
        </div>
    );
}

function TeacherDisciplineCard({ discipline }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-700">
                        {discipline.nome ||
                            discipline.disciplina ||
                            'Disciplina'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {discipline.nivel || discipline.area || 'Sem detalhe'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function PerfilProfessorPage() {
    const navigate = useNavigate();
    const storedUser = useMemo(() => getStoredUser(), []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadProfile() {
            try {
                const response = await apiGet('/api/professor/perfil');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Erro ao carregar perfil.'
                    );
                }

                if (isMounted) {
                    setProfile(data?.professor || null);
                    setError('');
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError?.message ||
                            'Não foi possível carregar os dados do perfil.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, []);

    const data = useMemo(
        () => buildProfileSnapshot(profile, storedUser),
        [profile, storedUser]
    );

    const avatarSrc = data.imagem_perfil_url || defaultAvatar;

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Perfil"
                title="O Meu Perfil"
                subtitle="Consulte os seus dados pessoais e profissionais num único painel."
                icon={UserRound}
            />
            <button
                type="button"
                onClick={() => navigate('/professor/perfil/editar')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#14ad81] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f8d69]"
            >
                <Edit3 size={16} />
                Editar perfil
            </button>

            <div className="w-full space-y-5">
                {loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
                        A carregar perfil...
                    </div>
                ) : null}

                {!loading && error ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
                        {error}
                    </div>
                ) : null}

                {!loading ? (
                    <div className="space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-2xl font-semibold text-slate-400">
                                        <img
                                            src={avatarSrc}
                                            alt="Foto de perfil"
                                            className="h-full w-full rounded-full object-cover"
                                            onError={(event) => {
                                                const image =
                                                    event.currentTarget;
                                                if (
                                                    image.dataset
                                                        .fallbackApplied === '1'
                                                ) {
                                                    return;
                                                }

                                                image.dataset.fallbackApplied =
                                                    '1';
                                                image.src = defaultAvatar;
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            Nome Completo
                                        </p>
                                        <h2 className="mt-1 text-2xl font-semibold text-slate-800">
                                            {data.nome}
                                        </h2>
                                        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Mail size={14} />
                                                {data.email}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <UserRound size={14} />
                                                {data.nivel}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            Habilitação
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {data.habilitacao}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            Área
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {data.area_ensino}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            NIF
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {data.nif}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                            Telemóvel
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {data.telemovel}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <SectionCard title="Informações Pessoais">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Nome" value={data.nome} />
                                    <Field
                                        label="Data de Nascimento"
                                        value={formatDateLabel(data.data_nasc)}
                                    />
                                    <Field
                                        label="Cartão de Cidadão"
                                        value={data.cc}
                                    />
                                    <Field label="NIF" value={data.nif} />
                                    <Field label="Email" value={data.email} />
                                </div>
                            </SectionCard>

                            <SectionCard title="Morada">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Morada" value={data.morada} />
                                    <Field
                                        label="Localidade"
                                        value={data.localidade}
                                    />
                                    <Field
                                        label="Código Postal"
                                        value={data.cod_postal}
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Informações Profissionais">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Habilitação"
                                        value={data.habilitacao}
                                    />
                                    <Field label="Grau" value={data.nivel} />
                                    <Field
                                        label="Área"
                                        value={data.area_ensino}
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Contactos">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Telemóvel"
                                        value={data.telemovel}
                                    />
                                    <Field
                                        label="Telefone"
                                        value={data.telefone}
                                    />
                                </div>
                            </SectionCard>
                        </div>

                        {data.disciplinas.length > 0 ? (
                            <SectionCard title="Disciplinas Lecionadas">
                                <div className="grid gap-3">
                                    {data.disciplinas.map((disciplina) => (
                                        <TeacherDisciplineCard
                                            key={
                                                disciplina.id_disciplina ||
                                                disciplina.nome
                                            }
                                            discipline={disciplina}
                                        />
                                    ))}
                                </div>
                            </SectionCard>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
