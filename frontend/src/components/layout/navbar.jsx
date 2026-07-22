import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Bell,
    ChevronDown,
    Settings,
    LogOut,
    Search,
    Users,
    Check,
    ExternalLink,
    Loader,
} from 'lucide-react';
import logo from '../../assets/img/Asset-31.svg';
import { apiFetch } from '../../utils/api';
import { listarEventos, marcarAlertalido } from '../../utils/api';
import defaultAvatar from '../../assets/img/default-avatar.svg';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getDashboardPathByRole(role) {
    if (role === 'gestor') {
        return '/gestor/dashboard';
    }

    if (role === 'professor') {
        return '/professor/dashboard';
    }

    if (role === 'aluno') {
        return '/aluno/dashboard';
    }

    return '/';
}

function getNotificationsPathByRole(role) {
    if (role === 'gestor') {
        return '/gestor/notificacoes';
    }

    if (role === 'professor') {
        return '/professor/notificacoes';
    }

    if (role === 'aluno') {
        return '/aluno/notificacoes';
    }

    return getDashboardPathByRole(role);
}

export default function Navbar({ user, onLogout, onNavigate, compact = false }) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [activeResultIndex, setActiveResultIndex] = useState(-1);
    const [notifications, setNotifications] = useState([]);
    const dropdownRef = useRef(null);
    const notificationsRef = useRef(null);
    const searchRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const lastSearchRef = useRef('');
    const searchInputRef = useRef(null);
    const displayName =
        user?.nome?.trim() || user?.email?.split('@')[0] || 'Utilizador';
    const avatarSrc = user?.imagem_perfil_url || defaultAvatar;
    const canUseGlobalSearch = user?.role === 'gestor';
    const notificationsPath = getNotificationsPathByRole(user?.role);
    const unreadCount = notifications.filter(
        (notification) => !notification.lido
    ).length;

    function getRelativeTime(isoDate) {
        if (!isoDate) {
            return 'agora';
        }

        const diffMs = Date.now() - new Date(isoDate).getTime();
        const diffMin = Math.max(1, Math.floor(diffMs / 60000));

        if (diffMin < 60) {
            return `há ${diffMin} min`;
        }

        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) {
            return `há ${diffHours} h`;
        }

        const diffDays = Math.floor(diffHours / 24);
        return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsDropdownOpen(false);
            }

            if (
                notificationsRef.current &&
                !notificationsRef.current.contains(event.target)
            ) {
                setIsNotificationsOpen(false);
            }

            if (
                searchRef.current &&
                !searchRef.current.contains(event.target)
            ) {
                setIsSearchDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function fetchNotifications() {
            try {
                const result = await listarEventos({ limite: 15, offset: 0 });
                if (!result?.success) {
                    return;
                }

                if (isMounted && Array.isArray(result.data)) {
                    setNotifications(
                        result.data.map((row) => ({
                            id: row.id_alerta_evento,
                            titulo: row.titulo,
                            descricao: row.descricao || '',
                            createdAt: row.criado_em,
                            lido: Boolean(row.lido),
                        }))
                    );
                }
            } catch {
                // Evita quebrar a UI caso o endpoint ainda não esteja disponível.
            }
        }

        fetchNotifications();
        const handleForegroundPush = () => {
            fetchNotifications();
        };

        window.addEventListener('mc:push-foreground', handleForegroundPush);
        const intervalId = setInterval(fetchNotifications, 20000);

        return () => {
            isMounted = false;
            window.removeEventListener(
                'mc:push-foreground',
                handleForegroundPush
            );
            clearInterval(intervalId);
        };
    }, []);

    async function handleMarkAllAsRead() {
        const unread = notifications.filter((item) => !item.lido);
        await Promise.all(unread.map((item) => marcarAlertalido(item.id)));
        setNotifications((prev) =>
            prev.map((item) => ({ ...item, lido: true }))
        );
    }

    function handleMenuNavigation(path) {
        setIsDropdownOpen(false);
        setIsNotificationsOpen(false);
        onNavigate?.(path);
    }

    function handleNotificationToggle() {
        setIsNotificationsOpen((prev) => !prev);
        setIsDropdownOpen(false);
    }

    async function handleNotificationClick(notificationId) {
        await marcarAlertalido(notificationId);
        setNotifications((prev) =>
            prev.map((item) =>
                item.id === notificationId ? { ...item, lido: true } : item
            )
        );
        handleMenuNavigation(notificationsPath);
    }

    const triggerSearch = useCallback(
        async (rawValue) => {
            if (!canUseGlobalSearch) {
                setSearchResults([]);
                setIsSearchDropdownOpen(false);
                return;
            }

            const normalized = rawValue.trim();

            if (!normalized) {
                setIsSearchDropdownOpen(false);
                setSearchResults([]);
                return;
            }

            lastSearchRef.current = normalized;
            setIsSearching(true);
            setIsSearchDropdownOpen(true);

            try {
                // Buscar alunos, professores e pacotes/serviços
                const response = await apiFetch(
                    `${API_URL}/api/busca?q=${encodeURIComponent(normalized)}`,
                    { method: 'GET' }
                );

                if (!response.ok) {
                    setSearchResults([]);
                    setIsSearching(false);
                    return;
                }

                const result = await response.json();
                const data = result.data || {
                    alunos: [],
                    professores: [],
                    servicosCurriculares: [],
                    servicosExtraCurriculares: [],
                };
                // Estrutura esperada: { alunos: [], professores: [], servicosCurriculares: [], servicosExtraCurriculares: [] }
                const results = [];

                if (data.alunos && Array.isArray(data.alunos)) {
                    results.push({
                        categoria: 'Alunos',
                        items: data.alunos.map((a) => ({
                            id: a.id,
                            nome: a.nome,
                            tipo: 'aluno',
                        })),
                    });
                }

                if (data.professores && Array.isArray(data.professores)) {
                    results.push({
                        categoria: 'Professores',
                        items: data.professores.map((p) => ({
                            id: p.id,
                            nome: p.nome,
                            tipo: 'professor',
                        })),
                    });
                }

                if (
                    data.servicosCurriculares &&
                    Array.isArray(data.servicosCurriculares)
                ) {
                    results.push({
                        categoria: 'Serviços Curriculares',
                        items: data.servicosCurriculares.map((s) => ({
                            id: s.id,
                            nome: s.nome,
                            tipo: 'servico_curricular',
                            modalidade: s.modalidade,
                            responsavel: s.responsavel,
                        })),
                    });
                }

                if (
                    data.servicosExtraCurriculares &&
                    Array.isArray(data.servicosExtraCurriculares)
                ) {
                    results.push({
                        categoria: 'Serviços Extra-Curriculares',
                        items: data.servicosExtraCurriculares.map((s) => ({
                            id: s.id,
                            nome: s.nome,
                            tipo: 'servico_extra',
                            modalidade: s.modalidade,
                            responsavel: s.responsavel,
                        })),
                    });
                }

                setSearchResults(results);
                setActiveResultIndex(-1);
            } catch {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        },
        [canUseGlobalSearch]
    );

    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        const normalized = search.trim();

        if (!normalized) {
            lastSearchRef.current = '';
            setSearchResults([]);
            setIsSearchDropdownOpen(false);
            return;
        }

        debounceTimerRef.current = setTimeout(() => {
            triggerSearch(search);
        }, 250);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [search, triggerSearch]);

    function handleSearchSubmit(event) {
        event.preventDefault();
        const flatResults = searchResults.flatMap((cat) => cat.items);
        if (activeResultIndex >= 0 && flatResults[activeResultIndex]) {
            handleSearchResultClick(flatResults[activeResultIndex]);
        }
    }

    function handleSearchKeyDown(event) {
        if (!isSearchDropdownOpen) return;
        const flatResults = searchResults.flatMap((cat) => cat.items);
        if (flatResults.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveResultIndex((prev) =>
                prev < flatResults.length - 1 ? prev + 1 : 0
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveResultIndex((prev) =>
                prev > 0 ? prev - 1 : flatResults.length - 1
            );
        } else if (event.key === 'Escape') {
            setIsSearchDropdownOpen(false);
            setActiveResultIndex(-1);
            searchInputRef.current?.blur();
        }
    }

    function handleSearchResultClick(result) {
        let path = '';

        if (user?.role === 'gestor') {
            if (result.tipo === 'aluno') {
                path = `/gestor/alunos/ficha/${result.id}`;
            } else if (result.tipo === 'professor') {
                path = `/gestor/professores/ficha/${result.id}`;
            } else if (result.tipo === 'servico_curricular') {
                path = `/gestor/servicos/curriculares`;
            } else if (result.tipo === 'servico_extra') {
                path = `/gestor/servicos/extra-curriculares`;
            }
        } else if (user?.role === 'professor') {
            if (
                result.tipo === 'servico_curricular' ||
                result.tipo === 'servico_extra'
            ) {
                path = `/professor/servicos`;
            }
        } else if (user?.role === 'aluno') {
            if (
                result.tipo === 'servico_curricular' ||
                result.tipo === 'servico_extra'
            ) {
                path = `/aluno/servicos`;
            }
        }

        if (path) {
            onNavigate?.(path);
            setSearch('');
            setSearchResults([]);
            setIsSearchDropdownOpen(false);
        }
    }

    function handleLogoClick() {
        onNavigate?.(getDashboardPathByRole(user?.role));
    }

    return (
        <header
            className={`border-b border-slate-200 bg-white px-4 py-3 sm:flex sm:items-center ${
                compact ? 'min-h-16 sm:px-4 sm:py-0' : 'min-h-20 sm:px-6 sm:py-0'
            }`}
        >
            <div
                className={`flex w-full flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3 ${
                    compact ? 'lg:gap-4' : 'lg:gap-6'
                }`}
            >
                <button
                    type="button"
                    onClick={handleLogoClick}
                    className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                    aria-label="Ir para dashboard"
                >
                    <img
                        src={logo}
                        alt="Logo Centro de Explicações"
                        className="h-10 w-auto object-contain"
                    />
                </button>

                {canUseGlobalSearch ? (
                    <form
                        onSubmit={handleSearchSubmit}
                        className="order-last flex w-full min-w-0 items-center sm:order-none sm:flex-1 lg:max-w-3xl"
                    >
                        <div className="relative w-full" ref={searchRef}>
                            <Search
                                size={17}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-grey"
                            />
                            <input
                                ref={searchInputRef}
                                type="text"
                                role="combobox"
                                aria-label="Pesquisa global"
                                aria-expanded={isSearchDropdownOpen}
                                aria-controls="search-results-listbox"
                                aria-autocomplete="list"
                                aria-activedescendant={
                                    activeResultIndex >= 0
                                        ? `search-result-${activeResultIndex}`
                                        : undefined
                                }
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                onFocus={() =>
                                    search.trim() &&
                                    isSearchDropdownOpen &&
                                    setIsSearchDropdownOpen(true)
                                }
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Pesquisar alunos, professores, serviços..."
                                className={`w-full rounded-xl border border-slate-200 bg-brand-cream pl-10 pr-4 text-sm text-brand-navy outline-none transition focus:border-brand-emerald focus:bg-white focus:ring-2 focus:ring-emerald-100 ${
                                    compact ? 'h-10' : 'h-11'
                                }`}
                            />

                            {isSearchDropdownOpen && search.trim() ? (
                                <div
                                    id="search-results-listbox"
                                    role="listbox"
                                    aria-label="Resultados da pesquisa"
                                    className="fixed inset-x-4 top-32 z-[100] max-h-[calc(100vh-9rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:right-0 sm:top-full sm:mt-2 sm:max-h-96 sm:w-full"
                                >
                                    {isSearching ? (
                                        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-500">
                                            <Loader
                                                size={16}
                                                className="animate-spin"
                                            />
                                            Procurando...
                                        </div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                                            <p>
                                                Nenhum resultado encontrado para
                                                "{search}"
                                            </p>
                                        </div>
                                    ) : (
                                        (() => {
                                            let globalIndex = -1;
                                            return searchResults
                                                .filter(
                                                    (cat) =>
                                                        cat.items.length > 0
                                                )
                                                .map((categoria) => (
                                                    <div
                                                        key={
                                                            categoria.categoria
                                                        }
                                                    >
                                                        <div className="border-t border-slate-100 bg-brand-cream px-4 py-2 text-xs font-semibold text-brand-grey">
                                                            {
                                                                categoria.categoria
                                                            }
                                                        </div>
                                                        {categoria.items.map(
                                                            (item) => {
                                                                globalIndex += 1;
                                                                const idx =
                                                                    globalIndex;
                                                                const isActive =
                                                                    idx ===
                                                                    activeResultIndex;
                                                                return (
                                                                    <button
                                                                        id={`search-result-${idx}`}
                                                                        key={`${item.tipo}-${item.id}`}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={
                                                                            isActive
                                                                        }
                                                                        onClick={() =>
                                                                            handleSearchResultClick(
                                                                                item
                                                                            )
                                                                        }
                                                                        className={`w-full px-4 py-2.5 text-left text-sm text-brand-grey transition ${isActive ? 'bg-emerald-50 text-brand-emerald' : 'hover:bg-brand-cream hover:text-brand-navy'}`}
                                                                    >
                                                                        <p className="font-medium">
                                                                            {
                                                                                item.nome
                                                                            }
                                                                        </p>
                                                                    </button>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                ));
                                        })()
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </form>
                ) : null}

                <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
                    <div ref={notificationsRef} className="relative">
                        <button
                            type="button"
                            onClick={handleNotificationToggle}
                            className="relative rounded-xl p-2.5 text-brand-grey transition hover:bg-brand-cream hover:text-brand-navy"
                            aria-label="Notificações"
                        >
                            <Bell size={19} className="text-current" />
                            {unreadCount > 0 ? (
                                <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            ) : null}
                        </button>

                        {isNotificationsOpen ? (
                            <div className="fixed inset-x-4 top-24 z-[100] max-h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-none">
                                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                                    <p className="text-sm font-semibold text-slate-700">
                                        Notificações
                                    </p>
                                    {unreadCount > 0 ? (
                                        <button
                                            type="button"
                                            onClick={handleMarkAllAsRead}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-emerald hover:text-emerald-700"
                                        >
                                            <Check size={14} />
                                            Marcar todas como lidas
                                        </button>
                                    ) : null}
                                </div>
                                <div className="max-h-[min(18rem,calc(100vh-14rem))] overflow-auto py-1 sm:max-h-72">
                                    {notifications.length === 0 ? (
                                        <p className="px-3 py-4 text-sm text-slate-500">
                                            Sem notificações de momento.
                                        </p>
                                    ) : (
                                        notifications.map((notification) => (
                                            <button
                                                type="button"
                                                key={notification.id}
                                                onClick={() =>
                                                    handleNotificationClick(
                                                        notification.id
                                                    )
                                                }
                                                className="w-full rounded-lg px-3 py-2 text-left hover:bg-brand-cream"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {notification.titulo}
                                                    </p>
                                                    {!notification.lido ? (
                                                        <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                                                    ) : null}
                                                </div>
                                                {notification.descricao ? (
                                                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                                                        {notification.descricao}
                                                    </p>
                                                ) : null}
                                                <p className="text-xs text-slate-600 mt-1">
                                                    {getRelativeTime(
                                                        notification.createdAt
                                                    )}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <div className="border-t border-slate-100 px-2 pt-1.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleMenuNavigation(
                                                notificationsPath
                                            )
                                        }
                                        className="w-full rounded-lg px-3 py-2 text-sm font-medium text-brand-emerald hover:bg-emerald-50"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            Ver todas as notificações
                                            <ExternalLink size={14} />
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div ref={dropdownRef} className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setIsDropdownOpen((prev) => !prev);
                                setIsNotificationsOpen(false);
                            }}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-brand-cream"
                        >
                            <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                <img
                                    src={avatarSrc}
                                    alt={`Foto de ${displayName}`}
                                    className="h-full w-full object-cover"
                                    onError={(event) => {
                                        const image = event.currentTarget;
                                        if (
                                            image.dataset.fallbackApplied ===
                                            '1'
                                        ) {
                                            return;
                                        }

                                        image.dataset.fallbackApplied = '1';
                                        image.src = defaultAvatar;
                                    }}
                                />
                            </div>
                            <span className="hidden md:block text-sm font-medium text-slate-700 max-w-36 truncate">
                                {displayName}
                            </span>
                            <ChevronDown size={16} className="text-slate-500" />
                        </button>

                        {isDropdownOpen ? (
                            <div className="fixed inset-x-4 top-24 z-[100] rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56 sm:max-w-none">
                                {user?.role !== 'gestor' && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleMenuNavigation(
                                                `/${user?.role}/perfil`
                                            )
                                        }
                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-slate-100"
                                    >
                                        <Users
                                            size={16}
                                            className="text-slate-600"
                                        />
                                        Perfil
                                    </button>
                                )}
                                {user?.role === 'gestor' ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleMenuNavigation(
                                                `/${user?.role}/configuracoes`
                                            )
                                        }
                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-slate-100"
                                    >
                                        <Settings
                                            size={16}
                                            className="text-slate-600"
                                        />
                                        Configurações
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                                >
                                    <LogOut size={16} />
                                    Terminar Sessão
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </header>
    );
}
