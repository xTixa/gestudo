import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    Bell,
    BookOpenCheck,
    CalendarDays,
    CalendarPlus,
    Check,
    ChevronDown,
    ClipboardCheck,
    FileSpreadsheet,
    GraduationCap,
    Inbox,
    LayoutDashboard,
    Menu,
    RefreshCcw,
    ShieldCheck,
    Sparkles,
    UserCog,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import markLogo from '../../assets/img/gestudo-mark.png';
import PricingSection from '../../components/infos/PricingSection';
import { SALES_EMAIL } from '../../utils/plan';

const CONTACT_EMAIL = SALES_EMAIL;

const NAV_LINKS = [
    { href: '#funcionalidades', label: 'Funcionalidades' },
    { href: '#perfis', label: 'Para quem' },
    { href: '#como-funciona', label: 'Como funciona' },
    { href: '#precos', label: 'Preços' },
    { href: '#faq', label: 'FAQ' },
];

const FEATURES = [
    {
        icon: Users,
        title: 'Alunos e professores',
        text: 'Fichas completas, encarregados de educação, disciplinas e histórico — tudo num só registo, exportável em PDF e Excel.',
    },
    {
        icon: CalendarDays,
        title: 'Agenda e salas',
        text: 'Marque sessões, evite conflitos de salas e horários e veja a semana de todo o centro de relance.',
    },
    {
        icon: ClipboardCheck,
        title: 'Presenças e assiduidade',
        text: 'O professor regista presenças em segundos e o gestor acompanha faltas e horas dadas em tempo real.',
    },
    {
        icon: Inbox,
        title: 'Inscrições online',
        text: 'Formulário público de inscrição com plano por disciplina. As candidaturas chegam validadas ao backoffice.',
    },
    {
        icon: RefreshCcw,
        title: 'Renovações',
        text: 'Os alunos pedem a reinscrição pela própria área e o gestor aprova com um clique.',
    },
    {
        icon: Wallet,
        title: 'Gestão financeira',
        text: 'Mensalidades geradas automaticamente, registo de pagamentos, conta-corrente do aluno e custos por professor.',
    },
    {
        icon: BarChart3,
        title: 'Dashboard e relatórios',
        text: 'Indicadores do centro com filtros e relatórios prontos a exportar para apoiar cada decisão.',
    },
    {
        icon: Bell,
        title: 'Alertas e notificações',
        text: 'Notificações push e alertas configuráveis para que nada importante passe despercebido.',
    },
    {
        icon: CalendarPlus,
        title: 'Sincronização de calendário',
        text: 'Cada utilizador subscreve a sua agenda no Google Calendar, Outlook ou Apple Calendar.',
    },
];

const ROLES = {
    gestor: {
        icon: UserCog,
        label: 'Gestor',
        title: 'Controlo total do centro, sem folhas de cálculo',
        text: 'Um backoffice pensado para quem gere o dia a dia: pessoas, serviços, horários e contas no mesmo sítio.',
        points: [
            'Dashboard com métricas do centro e filtros de pesquisa',
            'Gestão de serviços curriculares e extracurriculares',
            'Disciplinas, modalidades, pacotes de horas e salas configuráveis',
            'Aprovação de inscrições públicas e renovações',
            'Mensalidades, pagamentos e custos de professores',
            'Registo de auditoria de todas as ações',
        ],
    },
    professor: {
        icon: GraduationCap,
        label: 'Professor',
        title: 'Menos burocracia, mais tempo para ensinar',
        text: 'O professor sabe sempre onde tem de estar, com quem e o que já foi registado.',
        points: [
            'Agenda pessoal sincronizada com o calendário do telemóvel',
            'Lista dos serviços e alunos atribuídos',
            'Registo rápido de presenças por sessão',
            'Resumo de assiduidade e horas lecionadas',
            'Notificações sobre alterações de horário',
        ],
    },
    aluno: {
        icon: BookOpenCheck,
        label: 'Aluno',
        title: 'Tudo o que o aluno precisa, sempre à mão',
        text: 'Alunos e famílias acompanham o percurso sem ter de ligar para o centro.',
        points: [
            'Agenda com as sessões contratadas',
            'Consulta dos serviços e subscrição de novos',
            'Histórico de presenças',
            'Reinscrição online no novo ano letivo',
            'Notificações e dados pessoais atualizados',
        ],
    },
};

const STEPS = [
    {
        title: 'Configure o centro',
        text: 'Defina disciplinas, modalidades, pacotes de horas, preços e salas.',
    },
    {
        title: 'Receba inscrições',
        text: 'Partilhe o formulário online e valide cada candidatura no backoffice.',
    },
    {
        title: 'Agende e registe',
        text: 'Crie os horários e deixe os professores marcar presenças.',
    },
    {
        title: 'Fature e acompanhe',
        text: 'Gere mensalidades, registe pagamentos e consulte os relatórios.',
    },
];

const FAQS = [
    {
        q: 'Preciso de instalar alguma coisa?',
        a: 'Não. O Gestudo funciona no browser, em computador, tablet ou telemóvel. Basta ter acesso à internet.',
    },
    {
        q: 'Os professores e alunos também têm acesso?',
        a: 'Sim. Cada perfil — gestor, professor e aluno — tem a sua própria área, com acesso apenas à informação que lhe diz respeito.',
    },
    {
        q: 'Os dados estão seguros?',
        a: 'O acesso é autenticado e separado por perfil, os pedidos são protegidos contra CSRF e todas as ações relevantes ficam registadas num histórico de auditoria.',
    },
    {
        q: 'Posso exportar a informação?',
        a: 'Sim. Listagens, fichas e relatórios podem ser exportados em PDF e Excel.',
    },
    {
        q: 'Posso mudar de pacote mais tarde?',
        a: 'Sim. Pode passar para um pacote superior sempre que o centro precisar, sem perder nenhum dado já registado.',
    },
    {
        q: 'O que acontece se ultrapassar o limite de alunos?',
        a: 'Os alunos já ativos mantêm o acesso. Só não é possível ativar novas contas até desativar alunos que já não frequentam o centro ou mudar para um pacote superior. A utilização atual está sempre visível nas configurações.',
    },
    {
        q: 'Como recebo inscrições de novos alunos?',
        a: 'O centro partilha o link do formulário público de inscrição. Os pedidos chegam ao backoffice, onde o gestor os revê e aprova.',
    },
];

function scrollToHash(event, href) {
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LandingHeader() {
    const [open, setOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
                <a href="#topo" className="flex items-center gap-2.5">
                    <img
                        src={markLogo}
                        alt=""
                        className="h-9 w-9 object-contain"
                    />
                    <span className="text-lg font-bold tracking-tight text-slate-800">
                        Gestudo
                    </span>
                </a>

                <nav className="hidden items-center gap-7 lg:flex">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            onClick={(e) => scrollToHash(e, link.href)}
                            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="hidden items-center gap-2 lg:flex">
                    <Link
                        to="/login"
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                        Entrar
                    </Link>
                    <a
                        href="#contacto"
                        onClick={(e) => scrollToHash(e, '#contacto')}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                        Pedir demonstração
                    </a>
                </div>

                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
                    aria-label={open ? 'Fechar menu' : 'Abrir menu'}
                    aria-expanded={open}
                >
                    {open ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {open && (
                <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 lg:hidden">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            onClick={(e) => {
                                scrollToHash(e, link.href);
                                setOpen(false);
                            }}
                            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            {link.label}
                        </a>
                    ))}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <Link
                            to="/login"
                            className="rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700"
                        >
                            Entrar
                        </Link>
                        <a
                            href="#contacto"
                            onClick={(e) => {
                                scrollToHash(e, '#contacto');
                                setOpen(false);
                            }}
                            className="rounded-lg bg-slate-800 px-3 py-2.5 text-center text-sm font-semibold text-white"
                        >
                            Demonstração
                        </a>
                    </div>
                </div>
            )}
        </header>
    );
}

// Pré-visualização ilustrativa do painel do gestor (dados fictícios).
function DashboardMockup() {
    const bars = [42, 58, 51, 67, 74, 63, 82];
    const sessions = [
        { time: '14:00', subject: 'Matemática · 9º ano', room: 'Sala 2', tone: 'bg-emerald-500' },
        { time: '15:30', subject: 'Inglês · 11º ano', room: 'Sala 1', tone: 'bg-york-400' },
        { time: '17:00', subject: 'Físico-Química · 10º', room: 'Sala 3', tone: 'bg-violet-500' },
    ];

    return (
        <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-emerald-400/30 via-transparent to-york-300/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="ml-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <LayoutDashboard size={13} /> Painel de gestão
                    </span>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { label: 'Alunos ativos', value: '128' },
                            { label: 'Sessões / semana', value: '214' },
                            { label: 'Presenças', value: '96%' },
                        ].map((kpi) => (
                            <div
                                key={kpi.label}
                                className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 sm:p-3"
                            >
                                <p className="text-[10px] font-medium text-slate-500 sm:text-xs">
                                    {kpi.label}
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-800 sm:text-xl">
                                    {kpi.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-xs font-semibold text-slate-600">
                            Horas lecionadas
                        </p>
                        <div className="mt-3 flex h-24 items-end gap-2">
                            {bars.map((h, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 rounded-t-md ${i === bars.length - 1 ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-xs font-semibold text-slate-600">
                            Hoje
                        </p>
                        <ul className="mt-2 space-y-2">
                            {sessions.map((s) => (
                                <li
                                    key={s.time}
                                    className="flex items-center gap-3 text-xs"
                                >
                                    <span className="w-10 font-semibold text-slate-700">
                                        {s.time}
                                    </span>
                                    <span className={`h-6 w-1 rounded-full ${s.tone}`} />
                                    <span className="flex-1 truncate text-slate-700">
                                        {s.subject}
                                    </span>
                                    <span className="text-slate-400">{s.room}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg sm:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Check size={16} />
                </span>
                <span className="text-xs font-semibold text-slate-700">
                    Nova inscrição aprovada
                </span>
            </div>
        </div>
    );
}

function FinanceMockup() {
    const rows = [
        { name: 'Beatriz S.', month: 'Setembro', value: '85,00 €', state: 'Pago', cls: 'bg-emerald-100 text-emerald-800' },
        { name: 'Tomás R.', month: 'Setembro', value: '120,00 €', state: 'Pendente', cls: 'bg-york-100 text-york-800' },
        { name: 'Inês M.', month: 'Setembro', value: '60,00 €', state: 'Pago', cls: 'bg-emerald-100 text-emerald-800' },
        { name: 'Rui C.', month: 'Agosto', value: '85,00 €', state: 'Em atraso', cls: 'bg-red-100 text-red-700' },
    ];

    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-sm font-semibold text-white">
                    Mensalidades
                </span>
                <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-medium text-emerald-300">
                    Geradas automaticamente
                </span>
            </div>
            <ul className="divide-y divide-white/10">
                {rows.map((r) => (
                    <li
                        key={r.name}
                        className="flex items-center gap-3 px-4 py-3 text-sm"
                    >
                        <span className="flex-1 truncate text-slate-100">
                            {r.name}
                        </span>
                        <span className="hidden text-slate-400 sm:inline">
                            {r.month}
                        </span>
                        <span className="w-20 text-right font-semibold text-white">
                            {r.value}
                        </span>
                        <span
                            className={`w-20 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${r.cls}`}
                        >
                            {r.state}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SectionHeading({ eyebrow, title, text, center = true }) {
    return (
        <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
                {eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {title}
            </h2>
            {text && (
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                    {text}
                </p>
            )}
        </div>
    );
}

function FaqItem({ q, a }) {
    return (
        <details className="group rounded-xl border border-slate-200 bg-white px-5 py-4 open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-800">
                {q}
                <ChevronDown
                    size={18}
                    className="shrink-0 text-slate-400 transition group-open:rotate-180"
                />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
        </details>
    );
}

export default function HomePage() {
    const [activeRole, setActiveRole] = useState('gestor');
    const role = ROLES[activeRole];
    const RoleIcon = role.icon;

    return (
        <div id="topo" className="min-h-screen scroll-smooth bg-white text-slate-800">
            <LandingHeader />

            <main>
                {/* Hero */}
                <section className="relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,theme(colors.emerald.50),transparent_60%)]" />
                    <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:pb-28 lg:pt-20">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                <Sparkles size={14} />
                                Feito para centros de explicações
                            </span>
                            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
                                A gestão do seu centro de estudos,{' '}
                                <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
                                    num só lugar.
                                </span>
                            </h1>
                            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                                Alunos, professores, agenda, presenças,
                                inscrições e mensalidades — sem papéis, sem
                                folhas de Excel dispersas e sem erros manuais.
                            </p>
                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <a
                                    href="#contacto"
                                    onClick={(e) => scrollToHash(e, '#contacto')}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700"
                                >
                                    Pedir demonstração
                                    <ArrowRight size={16} />
                                </a>
                                <a
                                    href="#precos"
                                    onClick={(e) => scrollToHash(e, '#precos')}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                >
                                    Ver pacotes e preços
                                </a>
                            </div>
                            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                                {['Acesso por perfil', '100% online', 'Exportação PDF e Excel'].map(
                                    (item) => (
                                        <li key={item} className="flex items-center gap-1.5">
                                            <Check size={16} className="text-emerald-600" />
                                            {item}
                                        </li>
                                    )
                                )}
                            </ul>
                        </div>

                        <DashboardMockup />
                    </div>
                </section>

                {/* Antes / depois */}
                <section className="border-y border-slate-100 bg-slate-50">
                    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
                        {[
                            {
                                big: '1',
                                label: 'plataforma',
                                text: 'em vez de agendas em papel, grupos de mensagens e várias folhas de cálculo.',
                            },
                            {
                                big: '3',
                                label: 'perfis',
                                text: 'gestor, professor e aluno — cada um vê exatamente o que precisa.',
                            },
                            {
                                big: '0',
                                label: 'instalações',
                                text: 'funciona no browser, no computador, tablet ou telemóvel.',
                            },
                        ].map((item) => (
                            <div key={item.label} className="flex gap-4">
                                <p className="text-5xl font-bold text-emerald-500">
                                    {item.big}
                                </p>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        {item.label}
                                    </p>
                                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                        {item.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Funcionalidades */}
                <section
                    id="funcionalidades"
                    className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28"
                >
                    <SectionHeading
                        eyebrow="Funcionalidades"
                        title="Tudo o que um centro de explicações precisa"
                        text="Do primeiro contacto com a família até ao último pagamento do ano letivo, o Gestudo acompanha cada passo."
                    />
                    <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map(({ icon, title, text }) => {
                            const Icon = icon;
                            return (
                                <article
                                    key={title}
                                    className="group rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-900/5"
                                >
                                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-500 group-hover:text-white">
                                        <Icon size={22} />
                                    </span>
                                    <h3 className="mt-5 text-lg font-semibold text-slate-900">
                                        {title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                        {text}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {/* Perfis */}
                <section id="perfis" className="scroll-mt-20 bg-slate-50 py-20 lg:py-28">
                    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                        <SectionHeading
                            eyebrow="Para quem"
                            title="Uma área à medida de cada utilizador"
                        />

                        <div
                            role="tablist"
                            className="mx-auto mt-10 flex w-full max-w-md rounded-xl border border-slate-200 bg-white p-1"
                        >
                            {Object.entries(ROLES).map(([key, r]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeRole === key}
                                    onClick={() => setActiveRole(key)}
                                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                                        activeRole === key
                                            ? 'bg-slate-800 text-white shadow'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-10 grid items-center gap-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 lg:grid-cols-2">
                            <div>
                                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-york-100 text-york-700">
                                    <RoleIcon size={24} />
                                </span>
                                <h3 className="mt-5 text-2xl font-bold text-slate-900">
                                    {role.title}
                                </h3>
                                <p className="mt-3 leading-relaxed text-slate-600">
                                    {role.text}
                                </p>
                            </div>
                            <ul className="space-y-3">
                                {role.points.map((point) => (
                                    <li
                                        key={point}
                                        className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                    >
                                        <Check
                                            size={18}
                                            className="mt-0.5 shrink-0 text-emerald-600"
                                        />
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Como funciona */}
                <section
                    id="como-funciona"
                    className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28"
                >
                    <SectionHeading
                        eyebrow="Como funciona"
                        title="Pronto a usar em quatro passos"
                    />
                    <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="relative">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                                    {i + 1}
                                </span>
                                {i < STEPS.length - 1 && (
                                    <span className="absolute left-12 right-0 top-5 hidden h-px bg-slate-200 lg:block" />
                                )}
                                <h3 className="mt-4 font-semibold text-slate-900">
                                    {step.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    {step.text}
                                </p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Destaque financeiro */}
                <section className="bg-slate-900 text-white">
                    <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                                Financeiro
                            </p>
                            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                                Saiba sempre quem pagou, quem falta e quanto
                                custa cada hora
                            </h2>
                            <p className="mt-4 leading-relaxed text-slate-300">
                                As mensalidades são geradas a partir dos
                                serviços contratados. Registe pagamentos,
                                consulte a conta-corrente de cada aluno e
                                calcule automaticamente o custo de cada
                                professor.
                            </p>
                            <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                                {[
                                    'Geração de mensalidades em lote',
                                    'Estados: pago, pendente e em atraso',
                                    'Tarifas e custos por professor',
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2">
                                        <Check size={16} className="text-emerald-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <FinanceMockup />
                    </div>
                </section>

                {/* Segurança */}
                <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
                    <div className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 sm:p-12 md:grid-cols-[auto,1fr]">
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-white">
                            <ShieldCheck size={32} />
                        </span>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                Os dados dos seus alunos estão protegidos
                            </h2>
                            <p className="mt-2 leading-relaxed text-slate-600">
                                Autenticação por perfil, recuperação segura de
                                palavra-passe, consentimento de dados na
                                inscrição e um registo de auditoria com todas
                                as ações relevantes.
                            </p>
                        </div>
                    </div>
                </section>

                <PricingSection contactEmail={CONTACT_EMAIL} />

                {/* FAQ */}
                <section id="faq" className="scroll-mt-20 py-20 lg:py-28">
                    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                        <SectionHeading
                            eyebrow="FAQ"
                            title="Perguntas frequentes"
                        />
                        <div className="mt-10 space-y-3">
                            {FAQS.map((faq) => (
                                <FaqItem key={faq.q} {...faq} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA final */}
                <section
                    id="contacto"
                    className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6"
                >
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-14 text-center text-white sm:px-12">
                        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-york-400/20 blur-3xl" />
                        <FileSpreadsheet
                            size={36}
                            className="relative mx-auto text-emerald-400"
                        />
                        <h2 className="relative mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                            Deixe as folhas de cálculo para trás
                        </h2>
                        <p className="relative mx-auto mt-4 max-w-xl text-slate-300">
                            Escolha o pacote certo para o seu centro ou fale
                            connosco e veja o Gestudo a funcionar com os seus
                            dados.
                        </p>
                        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <a
                                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Pedido de demonstração Gestudo')}`}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
                            >
                                Pedir demonstração
                                <ArrowRight size={16} />
                            </a>
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                            >
                                Já sou cliente — Entrar
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200">
                <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
                    <div className="flex items-center gap-2">
                        <img src={markLogo} alt="" className="h-6 w-6 object-contain" />
                        <span className="font-semibold text-slate-700">Gestudo</span>
                        <span>· Plataforma de Gestão de Estudos</span>
                    </div>
                    <div className="flex items-center gap-5">
                        <Link to="/login" className="hover:text-slate-800">
                            Entrar
                        </Link>
                        <span>© {new Date().getFullYear()}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
