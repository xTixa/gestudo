import {
    LayoutDashboard,
    Calendar,
    BookOpen,
    Users,
    GraduationCap,
    FileText,
    Shield,
    Bell,
    Settings,
    ChevronRight,
    ChevronDown,
    PanelLeftClose,
    PanelLeftOpen,
    SwitchCameraIcon,
    LucideSearchCheck,
    RefreshCcw,
    BookCheck,
    BookOpenCheckIcon,
    NotebookIcon,
    DoorClosedIcon,
    BoxIcon,
    ClipboardCheck,
    BarChart3,
    ClipboardEdit,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../utils/api';

function isPathActive(currentPath, itemPath) {
    if (!itemPath) {
        return false;
    }

    return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

const menuByRole = {
    gestor: [
        {
            key: 'dashboard',
            label: 'Dashboard',
            path: '/gestor/dashboard',
            icon: LayoutDashboard,
        },
        {
            key: 'agenda',
            label: 'Agenda',
            path: '/gestor/agenda',
            icon: Calendar,
        },
        {
            key: 'presencas',
            label: 'Presenças',
            path: '/gestor/presencas',
            icon: ClipboardCheck,
        },
        {
            key: 'reagendar',
            label: 'Reagendamentos',
            path: '/gestor/reagendar',
            icon: RefreshCcw,
        },
        { section: 'SERVIÇOS' },
        {
            key: 'curriculares',
            label: 'Curriculares',
            path: '/gestor/servicos/curriculares',
            icon: BookOpenCheckIcon,
        },
        {
            key: 'extra-curriculares',
            label: 'Extra-Curriculares',
            path: '/gestor/servicos/extra-curriculares',
            icon: BookOpen,
        },
        { section: 'ALUNOS' },
        {
            key: 'gestao-alunos',
            label: 'Gestão Alunos',
            path: '/gestor/alunos',
            icon: Users,
        },
        {
            key: 'alunos-por-disciplina',
            label: 'Por Disciplina',
            path: '/gestor/alunos-por-disciplina',
            icon: BookCheck,
        },
        { section: 'PROFESSORES' },
        {
            key: 'gestao-professores',
            label: 'Gestão Professores',
            path: '/gestor/professores',
            icon: GraduationCap,
        },
        { section: 'ADMINISTRAÇÃO' },
        {
            key: 'inscricoes-publicas',
            label: 'Inscrições Públicas',
            path: '/gestor/inscricoes-publicas',
            icon: FileText,
        },
        {
            key: 'alteracoes-pendentes',
            label: 'Alterações Pendentes',
            path: '/gestor/alteracoes-pendentes',
            icon: ClipboardEdit,
        },
        {
            key: 'relatorios',
            label: 'Relatórios',
            path: '/gestor/relatorios',
            icon: BarChart3,
        },
        {
            key: 'auditoria-logs',
            label: 'Auditoria/Logs',
            path: '/gestor/logs',
            icon: Shield,
        },
        {
            key: 'configuracoes',
            label: 'Configurações',
            path: '/gestor/configuracoes',
            icon: Settings,
        },
        { section: 'GESTÃO INTERNA' },
        {
            key: 'modalidade',
            label: 'Modalidade',
            path: '/gestor/modalidade',
            icon: NotebookIcon,
        },
        {
            key: 'salas',
            label: 'Salas',
            path: '/gestor/salas',
            icon: DoorClosedIcon,
        },
        {
            key: 'disciplinas',
            label: 'Disciplinas',
            path: '/gestor/disciplinas',
            icon: NotebookIcon,
        },
        {
            key: 'pacotes',
            label: 'Pacotes',
            path: '/gestor/pacotes',
            icon: BoxIcon,
        },
    ],
    aluno: [
        {
            key: 'dashboard',
            label: 'Dashboard',
            path: '/aluno/dashboard',
            icon: LayoutDashboard,
        },
        {
            key: 'agenda',
            label: 'Agenda',
            path: '/aluno/agenda',
            icon: Calendar,
        },
        {
            key: 'meus-servicos',
            label: 'Os Meus Serviços',
            path: '/aluno/servicos',
            icon: BookOpen,
        },
        {
            key: 'subscricao-servicos',
            label: 'Subscrição Serviços',
            path: '/aluno/subscricao-servicos',
            icon: BookOpenCheckIcon,
        },
        {
            key: 'reinscricao',
            label: 'Reinscrição',
            path: '/aluno/reinscricao',
            icon: ClipboardEdit,
        },
        {
            key: 'presencas',
            label: 'Presenças',
            path: '/aluno/presencas',
            icon: ClipboardCheck,
        },
    ],
    professor: [
        {
            key: 'dashboard',
            label: 'Dashboard',
            path: '/professor/dashboard',
            icon: LayoutDashboard,
        },
        {
            key: 'agenda',
            label: 'Agenda',
            path: '/professor/agenda',
            icon: Calendar,
        },
        {
            key: 'reagendamentos',
            label: 'Reagendamentos',
            path: '/professor/reagendamentos',
            icon: RefreshCcw,
        },
        {
            key: 'meus-servicos',
            label: 'Os Meus Serviços',
            path: '/professor/servicos',
            icon: BookOpen,
        },
        {
            key: 'presencas',
            label: 'Presenças',
            path: '/professor/presencas',
            icon: ClipboardCheck,
        },
        {
            key: 'assiduidade',
            label: 'Assiduidade',
            path: '/professor/assiduidade',
            icon: BarChart3,
        },
        {
            key: 'notificacoes',
            label: 'Notificações',
            path: '/professor/notificacoes',
            icon: Bell,
        },
    ],
};

export default function Sidebar({
    role,
    isOpen,
    currentPath,
    onNavigate,
    onToggle,
    onClose,
}) {
    const [reinscricaoAtiva, setReinscricaoAtiva] = useState(true);

    useEffect(() => {
        if (role !== 'aluno') return;

        let isMounted = true;

        async function carregarFeatureFlags() {
            try {
                const response = await apiGet('/api/public/feature-flags');
                const data = await response.json();
                if (!isMounted || !response.ok) return;

                if (data?.flags?.reinscricao_ativa === false) {
                    setReinscricaoAtiva(false);
                }
            } catch {
                // Falha silenciosa: mantém o item visível por omissão.
            }
        }

        carregarFeatureFlags();

        return () => {
            isMounted = false;
        };
    }, [role]);

    const menu = useMemo(() => {
        const items = menuByRole[role] || [];
        if (role === 'aluno' && !reinscricaoAtiva) {
            return items.filter((item) => item.key !== 'reinscricao');
        }
        return items;
    }, [role, reinscricaoAtiva]);
    const showLabels = isOpen;
    const [openGroups, setOpenGroups] = useState({});
    const isAdmin = role === 'gestor';
    const sidebarWidthClass = isAdmin
        ? isOpen
            ? 'w-60 lg:w-60'
            : 'w-60 lg:w-16'
        : isOpen
          ? 'w-64 lg:w-64'
          : 'w-64 lg:w-20';
    const innerPaddingClass = isAdmin ? 'px-2.5 py-3' : 'px-3 py-5';
    const navSpacingClass = isAdmin ? 'space-y-1 mt-3' : 'space-y-2 mt-5';
    const itemPaddingClass = isAdmin ? 'px-2.5 py-2' : 'px-3 py-2.5';
    const childPaddingClass = isAdmin ? 'px-2.5 py-1.5' : 'px-3 py-2';

    function handleSelect(item) {
        const isDesktop =
            typeof window !== 'undefined' && window.innerWidth >= 1024;

        if (!showLabels && isDesktop && item.children?.length) {
            return;
        }

        if (item.children?.length) {
            setOpenGroups((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
            return;
        }

        if (item.path) {
            onNavigate?.(item.path);
        }

        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            onClose?.();
        }
    }

    return (
        <>
            {!isOpen ? (
                <button
                    type="button"
                    onClick={onToggle}
                    className="fixed top-4 left-4 z-50 rounded-lg border border-slate-200 bg-white p-2 text-brand-navy shadow-sm lg:hidden"
                    aria-label="Abrir menu"
                >
                    <PanelLeftOpen size={18} />
                </button>
            ) : null}

            {isOpen ? (
                <button
                    type="button"
                    onClick={onClose}
                    className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
                    aria-label="Fechar menu"
                />
            ) : null}

            <aside
                className={`
					fixed inset-y-0 left-0 z-40 overflow-hidden
					pointer-events-auto
					bg-white border-r border-slate-200
					transform transition-transform duration-300 lg:duration-0
					${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
					lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
					${sidebarWidthClass}
				`}
            >
                <div
                    className={`h-full w-full overflow-y-auto ${innerPaddingClass}`}
                >
                    <div
                        className={`${showLabels ? 'flex justify-end' : 'flex justify-center'}`}
                    >
                        <button
                            type="button"
                            onClick={onToggle}
                            className="rounded-lg p-2 text-brand-grey hover:bg-brand-cream hover:text-brand-navy"
                            aria-label={
                                showLabels
                                    ? 'Recolher sidebar'
                                    : 'Expandir sidebar'
                            }
                        >
                            {showLabels ? (
                                <PanelLeftClose size={18} />
                            ) : (
                                <PanelLeftOpen size={18} />
                            )}
                        </button>
                    </div>

                    <nav className={navSpacingClass}>
                        {menu.map((item, index) => {
                            if (item.section) {
                                return (
                                    <p
                                        key={index}
                                        className={`text-xs font-semibold text-brand-grey tracking-wide overflow-hidden transition-all duration-150 ${
                                            showLabels
                                                ? isAdmin
                                                    ? 'mt-5 mb-1.5 max-h-6 opacity-100'
                                                    : 'mt-8 mb-3 max-h-6 opacity-100'
                                                : 'my-0 max-h-0 opacity-0'
                                        }`}
                                    >
                                        {item.section}
                                    </p>
                                );
                            }

                            const Icon = item.icon;
                            const isActive = isPathActive(
                                currentPath,
                                item.path
                            );
                            const isGroup = Boolean(item.children?.length);
                            const hasActiveChild = isGroup
                                ? item.children.some((child) =>
                                      isPathActive(currentPath, child.path)
                                  )
                                : false;
                            const isGroupOpen =
                                Boolean(openGroups[item.key]) || hasActiveChild;
                            const isChildActive = isGroup
                                ? item.children.some((child) =>
                                      isPathActive(currentPath, child.path)
                                  )
                                : false;

                            if (!showLabels && isGroup) {
                                return (
                                    <div
                                        key={item.key}
                                        className={
                                            isAdmin ? 'space-y-1' : 'space-y-2'
                                        }
                                    >
                                        {item.children.map((child) => {
                                            const ChildIcon =
                                                child.icon || Settings;
                                            const isChildCurrent = isPathActive(
                                                currentPath,
                                                child.path
                                            );

                                            return (
                                                <button
                                                    type="button"
                                                    key={child.key}
                                                    onClick={() =>
                                                        handleSelect(child)
                                                    }
                                                    className={`
													w-full flex items-center justify-center
													rounded-lg ${itemPaddingClass} text-sm transition
													${
                                                        isChildCurrent
                                                            ? 'bg-[#14ad81] text-[#1c293d] font-semibold'
                                                            : 'text-brand-grey hover:bg-brand-cream hover:text-brand-navy'
                                                    }
												`}
                                                    aria-label={child.label}
                                                >
                                                    <ChildIcon size={18} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            }

                            return (
                                <div key={item.key}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(item)}
                                        className={`
										w-full flex items-center ${showLabels ? 'justify-between' : 'justify-center'}
										rounded-lg ${itemPaddingClass} text-sm transition
										${
                                            isActive || isChildActive
                                                ? 'bg-[#14ad81] text-[#1c293d] font-semibold'
                                                : 'text-brand-grey hover:bg-brand-cream hover:text-brand-navy'
                                        }
									`}
                                        aria-label={
                                            !showLabels ? item.label : undefined
                                        }
                                    >
                                        <div
                                            className={`flex items-center ${showLabels ? 'gap-3' : 'gap-0'}`}
                                        >
                                            <Icon size={18} />
                                            <span
                                                className={`whitespace-nowrap overflow-hidden transition-all duration-150 ${
                                                    showLabels
                                                        ? 'max-w-[10rem] opacity-100'
                                                        : 'max-w-0 opacity-0'
                                                }`}
                                            >
                                                {item.label}
                                            </span>
                                        </div>

                                        {showLabels && isGroup ? (
                                            isGroupOpen ? (
                                                <ChevronDown
                                                    size={16}
                                                    className="text-brand-grey"
                                                />
                                            ) : (
                                                <ChevronRight
                                                    size={16}
                                                    className="text-brand-grey"
                                                />
                                            )
                                        ) : item.arrow && showLabels ? (
                                            <ChevronRight
                                                size={16}
                                                className="text-brand-grey"
                                            />
                                        ) : null}
                                    </button>

                                    {showLabels && isGroup && isGroupOpen ? (
                                        <div
                                            className={
                                                isAdmin
                                                    ? 'mt-1.5 ml-8 space-y-1'
                                                    : 'mt-2 ml-9 space-y-1.5'
                                            }
                                        >
                                            {item.children.map((child) => {
                                                const isChildCurrent =
                                                    isPathActive(
                                                        currentPath,
                                                        child.path
                                                    );
                                                return (
                                                    <button
                                                        type="button"
                                                        key={child.key}
                                                        onClick={() =>
                                                            handleSelect(child)
                                                        }
                                                        className={`w-full rounded-md ${childPaddingClass} text-left text-sm transition ${
                                                            isChildCurrent
                                                                ? 'bg-[#14ad81] text-[#1c293d] font-semibold'
                                                                : 'text-brand-grey hover:bg-brand-cream hover:text-brand-navy'
                                                        }`}
                                                    >
                                                        {child.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </nav>
                </div>
            </aside>
        </>
    );
}
