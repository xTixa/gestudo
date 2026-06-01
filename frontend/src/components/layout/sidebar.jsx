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
} from 'lucide-react';
import { useMemo, useState } from 'react';

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
        {
            key: 'gestao-interna',
            label: 'Gestão Interna',
            icon: Settings,
            children: [
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
            key: 'presencas',
            label: 'Presenças',
            path: '/aluno/presencas',
            icon: Bell,
        },
        {
            key: 'notificacoes',
            label: 'Notificações',
            path: '/aluno/notificacoes',
            icon: Bell,
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
            icon: Bell,
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
    const menu = useMemo(() => menuByRole[role] || [], [role]);
    const showLabels = isOpen;
    const [openGroups, setOpenGroups] = useState({});

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
                    className="fixed top-4 left-4 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
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
					${isOpen ? 'w-64 lg:w-64' : 'w-64 lg:w-20'}
				`}
            >
                <div className="h-full w-full px-3 py-5 overflow-y-auto">
                    <div
                        className={`${showLabels ? 'flex justify-end' : 'flex justify-center'}`}
                    >
                        <button
                            type="button"
                            onClick={onToggle}
                            className="rounded-lg p-2 hover:bg-slate-100"
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

                    <nav className="space-y-2 mt-5">
                        {menu.map((item, index) => {
                            if (item.section) {
                                return (
                                    <p
                                        key={index}
                                        className={`text-xs text-slate-400 tracking-wide overflow-hidden transition-all duration-150 ${
                                            showLabels
                                                ? 'mt-8 mb-3 max-h-6 opacity-100'
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
                                    <div key={item.key} className="space-y-2">
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
													rounded-lg px-3 py-2.5 text-sm transition
													${
                                                        isChildCurrent
                                                            ? 'bg-york-400 text-white font-medium'
                                                            : 'text-slate-700 hover:bg-slate-100'
                                                    }
												`}
                                                    title={child.label}
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
										rounded-lg px-3 py-2.5 text-sm transition
										${
                                            isActive || isChildActive
                                                ? 'bg-york-400 text-white font-medium'
                                                : 'text-slate-700 hover:bg-slate-100'
                                        }
									`}
                                        title={
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
                                                    className="text-slate-400"
                                                />
                                            ) : (
                                                <ChevronRight
                                                    size={16}
                                                    className="text-slate-400"
                                                />
                                            )
                                        ) : item.arrow && showLabels ? (
                                            <ChevronRight
                                                size={16}
                                                className="text-slate-400"
                                            />
                                        ) : null}
                                    </button>

                                    {showLabels && isGroup && isGroupOpen ? (
                                        <div className="mt-2 ml-9 space-y-1.5">
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
                                                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                                                            isChildCurrent
                                                                ? 'bg-york-400 text-white font-medium'
                                                                : 'text-slate-600 hover:bg-slate-100'
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
