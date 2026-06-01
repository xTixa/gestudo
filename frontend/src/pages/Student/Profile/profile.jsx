import { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    GraduationCap,
    Mail,
    Pencil,
    School2,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../../utils/api';
import defaultAvatar from '../../../assets/img/default-avatar.svg';
import RenewalStatus from '../../../components/RenewalStatus';
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

function formatYearLabel(value) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        return '-';
    }

    if (/\d+\s*º\s*ano/i.test(raw)) {
        return raw.replace(/\s+/g, ' ').trim();
    }

    return /\d+/.test(raw) ? `${raw}º ano` : raw;
}

function formatPhone(value) {
    const raw = String(value || '').trim();
    return raw || '-';
}

function buildProfileSnapshot(profile, storedUser) {
    const pessoa = profile?.pessoa || {};
    const user = pessoa?.user || {};
    const encarregado = profile?.encarregado || {};
    const encarregadoPessoa = encarregado?.pessoa || {};

    return {
        nome: pessoa?.nome || storedUser?.nome || storedUser?.name || '-',
        email: user?.email || storedUser?.email || '-',
        data_nasc: pessoa?.data_nasc || '',
        cc: pessoa?.cc || '-',
        nif: pessoa?.nif || '-',
        telemovel: pessoa?.telemovel || '-',
        telefone: pessoa?.telefone || '-',
        morada: pessoa?.morada || '-',
        localidade: pessoa?.localidade || '-',
        cod_postal: pessoa?.cod_postal || '-',
        escola: profile?.escola || '-',
        ano: formatYearLabel(profile?.ano),
        turma: profile?.turma || '-',
        imagem_perfil_url:
            pessoa?.imagem_perfil_url ||
            user?.imagem_perfil_url ||
            storedUser?.imagem_perfil_url ||
            '',
        encarregadoNome: encarregadoPessoa?.nome || '-',
        encarregadoParentesco: encarregado?.parentesco || '-',
        encarregadoEmail: encarregadoPessoa?.user?.email || '-',
        encarregadoTelemovel: encarregadoPessoa?.telemovel || '-',
        encarregadoTelefone: encarregadoPessoa?.telefone || '-',
        encarregadoMorada: encarregadoPessoa?.morada || '-',
        encarregadoLocalidade: encarregadoPessoa?.localidade || '-',
        encarregadoCodPostal: encarregadoPessoa?.cod_postal || '-',
        servicosSubscritos: Array.isArray(profile?.servicosSubscritos)
            ? profile.servicosSubscritos
            : [],
    };
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start gap-3">
                    {Icon ? (
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                            <Icon size={17} />
                        </span>
                    ) : null}
                    <div>
                        <div className="text-sm font-semibold text-slate-700">
                            {title}
                        </div>
                        {subtitle ? (
                            <p className="mt-1 text-xs text-slate-500">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="px-5 py-4">{children}</div>
        </section>
    );
}

function FieldGroup({ title, children }) {
    return (
        <div className="rounded-2xl bg-slate-50 p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {title}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {children}
            </div>
        </div>
    );
}

function Field({ label, value, className = '' }) {
    return (
        <div className={className}>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {label}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
                {value || '-'}
            </p>
        </div>
    );
}

function ServiceCard({ service }) {
    const serviceTitle =
        service.disciplina || service.area || service.tipoServico || 'Serviço';
    const serviceSubtitle = [service.modalidade, service.area]
        .filter(Boolean)
        .join(' • ');

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <div>
                    <p className="text-sm font-semibold text-slate-700">
                        {serviceTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {serviceSubtitle || 'Sem modalidade'}
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
                <Field
                    label="Valor"
                    value={service.valor == null ? '-' : `${service.valor} €`}
                />
                <Field label="Pacote" value={service.pacoteDescricao || '-'} />
            </div>
        </div>
    );
}

export default function PerfilAlunoPage() {
    const navigate = useNavigate();
    const storedUser = useMemo(() => getStoredUser(), []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadProfile() {
            try {
                const response = await apiGet('/api/aluno/perfil');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Erro ao carregar perfil.'
                    );
                }

                if (isMounted) {
                    setProfile(data?.aluno || null);
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
                eyebrow="Perfil do Aluno"
                title="O Meu Perfil"
                subtitle="Gerencia as tuas informações pessoais e escolares"
                icon={UserRound}
            />

            <button
                type="button"
                onClick={() => navigate('/aluno/perfil/editar')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-york-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-york-200"
            >
                <Pencil size={16} />
                Editar perfil
            </button>

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
                    {/* Renewal Status Card */}
                    <RenewalStatus />

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-2xl font-semibold text-slate-400">
                                    <img
                                        src={avatarSrc}
                                        alt="Foto de perfil"
                                        className="h-full w-full rounded-full object-cover"
                                        onError={(event) => {
                                            const image = event.currentTarget;
                                            if (
                                                image.dataset
                                                    .fallbackApplied === '1'
                                            ) {
                                                return;
                                            }

                                            image.dataset.fallbackApplied = '1';
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
                                            <School2 size={14} />
                                            {data.escola}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Ano
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                        {data.ano}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Turma
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                        {data.turma}
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
                                        Telefone
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                        {formatPhone(data.telemovel)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                        <SectionCard
                            icon={ShieldCheck}
                            title="Informações Pessoais"
                            subtitle="Identificação, contactos e morada do aluno."
                        >
                            <div className="space-y-4">
                                <FieldGroup title="Identificação">
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
                                </FieldGroup>

                                <FieldGroup title="Contactos">
                                    <Field label="Email" value={data.email} />
                                    <Field
                                        label="Telemóvel"
                                        value={formatPhone(data.telemovel)}
                                    />
                                    <Field
                                        label="Telefone"
                                        value={formatPhone(data.telefone)}
                                    />
                                </FieldGroup>

                                <FieldGroup title="Morada">
                                    <Field
                                        label="Morada"
                                        value={data.morada}
                                        className="sm:col-span-2"
                                    />
                                    <Field
                                        label="Localidade"
                                        value={data.localidade}
                                    />
                                    <Field
                                        label="Código Postal"
                                        value={data.cod_postal}
                                    />
                                </FieldGroup>
                            </div>
                        </SectionCard>

                        <SectionCard
                            icon={GraduationCap}
                            title="Informações Escolares"
                            subtitle="Dados académicos principais."
                        >
                            <div className="space-y-3">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <Field label="Escola" value={data.escola} />
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <Field label="Ano" value={data.ano} />
                                    </div>
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <Field
                                            label="Turma"
                                            value={data.turma}
                                        />
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    <SectionCard
                        icon={CalendarDays}
                        title="Serviços Subscritos"
                    >
                        {data.servicosSubscritos.length ? (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {data.servicosSubscritos.map((service) => (
                                    <ServiceCard
                                        key={service.id_servico}
                                        service={service}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                Não existem serviços subscritos para apresentar.
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        icon={UserRound}
                        title="Encarregado de Educação"
                        subtitle="Dados de contacto e morada do responsável."
                    >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <FieldGroup title="Identificação">
                                <Field
                                    label="Nome Completo"
                                    value={data.encarregadoNome}
                                    className="sm:col-span-2 lg:col-span-1"
                                />
                                <Field
                                    label="Parentesco"
                                    value={data.encarregadoParentesco}
                                />
                            </FieldGroup>

                            <FieldGroup title="Contactos">
                                <Field
                                    label="Email"
                                    value={data.encarregadoEmail}
                                />
                                <Field
                                    label="Telemóvel"
                                    value={formatPhone(
                                        data.encarregadoTelemovel
                                    )}
                                />
                                <Field
                                    label="Telefone"
                                    value={formatPhone(
                                        data.encarregadoTelefone
                                    )}
                                />
                            </FieldGroup>

                            <FieldGroup title="Morada">
                                <Field
                                    label="Morada"
                                    value={data.encarregadoMorada}
                                    className="sm:col-span-2"
                                />
                                <Field
                                    label="Localidade"
                                    value={data.encarregadoLocalidade}
                                />
                                <Field
                                    label="Código Postal"
                                    value={data.encarregadoCodPostal}
                                />
                            </FieldGroup>
                        </div>
                    </SectionCard>
                </div>
            ) : null}
        </section>
    );
}
