import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import markLogo from '../../assets/img/gestudo-mark.png';
import { apiGet } from '../../utils/api';
import { isPathActive, menuByRole, ROLE_LABEL } from './menuConfig';

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

    const groups = useMemo(() => {
        const base = menuByRole[role] || [];
        if (role === 'aluno' && !reinscricaoAtiva) {
            return base.map((group) => ({
                ...group,
                items: group.items.filter((item) => item.key !== 'reinscricao'),
            }));
        }
        return base;
    }, [role, reinscricaoAtiva]);

    // Em ecrãs grandes, "isOpen" alterna entre expandida e recolhida (só
    // ícones); em ecrãs pequenos, controla se o menu está visível.
    const expanded = isOpen;

    function handleSelect(item) {
        onNavigate?.(item.path);

        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            onClose?.();
        }
    }

    return (
        <>
            {isOpen ? (
                <button
                    type="button"
                    onClick={onClose}
                    className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[1px] lg:hidden"
                    aria-label="Fechar menu"
                />
            ) : null}

            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-[width] ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                } ${expanded ? 'lg:w-64' : 'lg:w-[72px]'}`}
                aria-label="Menu principal"
            >
                {/* Marca */}
                <div
                    className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/10 ${
                        expanded ? 'px-5' : 'px-5 lg:justify-center lg:px-0'
                    }`}
                >
                    <button
                        type="button"
                        onClick={() => handleSelect({ path: groups[0]?.items[0]?.path })}
                        className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                        aria-label="Ir para o dashboard"
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                            <img src={markLogo} alt="" className="h-7 w-7 object-contain" />
                        </span>
                        <span className={`min-w-0 text-left ${expanded ? '' : 'lg:hidden'}`}>
                            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-white">
                                Gestudo
                            </span>
                            <span className="block truncate text-xs leading-tight text-slate-400">
                                {ROLE_LABEL[role] || 'Plataforma'}
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
                        aria-label="Fechar menu"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navegação */}
                <nav
                    className={`flex-1 overflow-y-auto overflow-x-hidden py-4 [scrollbar-width:thin] ${
                        expanded ? 'px-3' : 'px-3 lg:px-2.5'
                    }`}
                >
                    {groups.map((group, groupIndex) => (
                        <div
                            key={group.title || `grupo-${groupIndex}`}
                            className={groupIndex > 0 ? 'mt-4' : ''}
                        >
                            {group.title ? (
                                expanded ? (
                                    <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        {group.title}
                                    </p>
                                ) : (
                                    <>
                                        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:hidden">
                                            {group.title}
                                        </p>
                                        <div
                                            className="mx-auto mb-2 hidden h-px w-6 bg-white/10 lg:block"
                                            aria-hidden="true"
                                        />
                                    </>
                                )
                            ) : null}

                            <ul className="space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isPathActive(currentPath, item.path);

                                    return (
                                        <li key={item.key}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelect(item)}
                                                title={expanded ? undefined : item.label}
                                                aria-current={active ? 'page' : undefined}
                                                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
                                                    expanded ? '' : 'lg:justify-center lg:px-0'
                                                } ${
                                                    active
                                                        ? 'bg-white/10 text-white'
                                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                                }`}
                                            >
                                                {active ? (
                                                    <span
                                                        className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-cyan-400"
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                                <Icon
                                                    size={18}
                                                    strokeWidth={active ? 2.25 : 2}
                                                    className={`shrink-0 ${
                                                        active
                                                            ? 'text-cyan-400'
                                                            : 'text-slate-500 group-hover:text-slate-300'
                                                    }`}
                                                />
                                                <span className={`truncate ${expanded ? '' : 'lg:hidden'}`}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Recolher / expandir (só em ecrãs grandes) */}
                <div className="hidden shrink-0 border-t border-white/10 p-3 lg:block">
                    <button
                        type="button"
                        onClick={onToggle}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 ${
                            expanded ? '' : 'justify-center px-0'
                        }`}
                        aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
                        title={expanded ? undefined : 'Expandir menu'}
                    >
                        {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                        {expanded ? <span>Recolher menu</span> : null}
                    </button>
                </div>
            </aside>
        </>
    );
}
