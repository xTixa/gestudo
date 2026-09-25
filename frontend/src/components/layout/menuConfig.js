import {
    LayoutDashboard,
    Calendar,
    BookOpen,
    BookOpenCheck,
    BookMarked,
    Users,
    GraduationCap,
    Inbox,
    ScrollText,
    Bell,
    Settings,
    RefreshCcw,
    Layers,
    DoorOpen,
    Package,
    ClipboardCheck,
    BarChart3,
    ClipboardEdit,
    ListChecks,
    Wallet,
    Receipt,
    Banknote,
} from 'lucide-react';

export function isPathActive(currentPath, itemPath, exact = false) {
    if (!itemPath) {
        return false;
    }

    if (exact) {
        return currentPath === itemPath;
    }

    return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

// Menu organizado por grupos. Cada grupo tem um título opcional e uma lista
// de itens; os URLs são os mesmos das rotas em App.jsx.
export const menuByRole = {
    gestor: [
        {
            items: [
                { key: 'dashboard', label: 'Dashboard', path: '/gestor/dashboard', icon: LayoutDashboard },
                { key: 'agenda', label: 'Agenda', path: '/gestor/agenda', icon: Calendar },
                { key: 'presencas', label: 'Presenças', path: '/gestor/presencas', icon: ClipboardCheck },
            ],
        },
        {
            title: 'Pessoas',
            items: [
                { key: 'alunos', label: 'Alunos', path: '/gestor/alunos', icon: Users },
                { key: 'professores', label: 'Professores', path: '/gestor/professores', icon: GraduationCap },
            ],
        },
        {
            title: 'Serviços',
            items: [
                { key: 'curriculares', label: 'Curriculares', path: '/gestor/servicos/curriculares', icon: BookOpenCheck },
                { key: 'extra-curriculares', label: 'Extra-curriculares', path: '/gestor/servicos/extra-curriculares', icon: BookOpen },
            ],
        },
        {
            title: 'Inscrições',
            items: [
                { key: 'inscricoes-publicas', label: 'Inscrições públicas', path: '/gestor/inscricoes-publicas', icon: Inbox },
                { key: 'renovacoes', label: 'Renovações', path: '/gestor/renovacoes', icon: RefreshCcw },
            ],
        },
        {
            title: 'Financeiro',
            items: [
                { key: 'financeiro', label: 'Visão geral', path: '/gestor/financeiro', icon: Wallet, exact: true },
                { key: 'mensalidades', label: 'Mensalidades', path: '/gestor/financeiro/mensalidades', icon: Receipt },
                { key: 'pagamentos', label: 'Pagamentos', path: '/gestor/financeiro/pagamentos', icon: Banknote },
            ],
        },
        {
            title: 'Catálogo',
            items: [
                { key: 'disciplinas', label: 'Disciplinas', path: '/gestor/disciplinas', icon: BookMarked },
                { key: 'modalidade', label: 'Modalidades', path: '/gestor/modalidade', icon: Layers },
                { key: 'tipos-servico', label: 'Tipos de serviço', path: '/gestor/tipos-servico', icon: ListChecks },
                { key: 'pacotes', label: 'Pacotes', path: '/gestor/pacotes', icon: Package },
                { key: 'salas', label: 'Salas', path: '/gestor/salas', icon: DoorOpen },
            ],
        },
        {
            title: 'Sistema',
            items: [
                { key: 'relatorios', label: 'Relatórios', path: '/gestor/relatorios', icon: BarChart3 },
                { key: 'auditoria-logs', label: 'Auditoria', path: '/gestor/logs', icon: ScrollText },
                { key: 'configuracoes', label: 'Configurações', path: '/gestor/configuracoes', icon: Settings },
            ],
        },
    ],
    aluno: [
        {
            items: [
                { key: 'dashboard', label: 'Dashboard', path: '/aluno/dashboard', icon: LayoutDashboard },
                { key: 'agenda', label: 'Agenda', path: '/aluno/agenda', icon: Calendar },
                { key: 'meus-servicos', label: 'Os meus serviços', path: '/aluno/servicos', icon: BookOpen },
                { key: 'subscricao-servicos', label: 'Subscrição de serviços', path: '/aluno/subscricao-servicos', icon: BookOpenCheck },
                { key: 'reinscricao', label: 'Reinscrição', path: '/aluno/reinscricao', icon: ClipboardEdit },
                { key: 'presencas', label: 'Presenças', path: '/aluno/presencas', icon: ClipboardCheck },
            ],
        },
    ],
    professor: [
        {
            items: [
                { key: 'dashboard', label: 'Dashboard', path: '/professor/dashboard', icon: LayoutDashboard },
                { key: 'agenda', label: 'Agenda', path: '/professor/agenda', icon: Calendar },
                { key: 'meus-servicos', label: 'Os meus serviços', path: '/professor/servicos', icon: BookOpen },
                { key: 'presencas', label: 'Presenças', path: '/professor/presencas', icon: ClipboardCheck },
                { key: 'assiduidade', label: 'Assiduidade', path: '/professor/assiduidade', icon: BarChart3 },
                { key: 'notificacoes', label: 'Notificações', path: '/professor/notificacoes', icon: Bell },
            ],
        },
    ],
};

export const ROLE_LABEL = {
    gestor: 'Painel de gestão',
    professor: 'Área do professor',
    aluno: 'Área do aluno',
};

// Páginas que não aparecem no menu lateral mas precisam de breadcrumb.
const EXTRA_TRAILS = [
    { suffix: '/notificacoes', label: 'Notificações' },
    { suffix: '/perfil', label: 'Perfil' },
];

/**
 * Devolve o grupo e o item de menu correspondentes a um caminho, para
 * construir breadcrumbs (ex.: { group: 'Pessoas', label: 'Alunos' }).
 */
export function getMenuTrail(role, currentPath) {
    const extra = EXTRA_TRAILS.find((entry) =>
        isPathActive(currentPath, `/${role}${entry.suffix}`)
    );
    if (extra) {
        return { group: null, label: extra.label, path: `/${role}${extra.suffix}` };
    }

    const groups = menuByRole[role] || [];
    let best = null;

    groups.forEach((group) => {
        group.items.forEach((item) => {
            if (
                isPathActive(currentPath, item.path, item.exact) &&
                (!best || item.path.length > best.item.path.length)
            ) {
                best = { group: group.title || null, item };
            }
        });
    });

    return best
        ? { group: best.group, label: best.item.label, path: best.item.path }
        : null;
}
