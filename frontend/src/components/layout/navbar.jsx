import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Bell,
    ChevronDown,
    ChevronRight,
    Settings,
    LogOut,
    Menu,
    Search,
    Users,
    Check,
    ExternalLink,
    Loader,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { listarEventos, marcarAlertalido } from '../../utils/api';
import defaultAvatar from '../../assets/img/default-avatar.svg';
import { getMenuTrail } from './menuConfig';

const ROLE_LABEL = {
    gestor: 'Administrador',
    professor: 'Professor',
    aluno: 'Aluno',
};

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

export default function Navbar({ user, onLogout, onNavigate, onToggleSidebar }) {
    const location = useLocation();
    const trail = getMenuTrail(user?.role, location.pathname);
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
                    encarregados: [],
                    inscricoesPublicas: [],
                };
                // Estrutura esperada: { alunos: [], professores: [], servicosCurriculares: [], servicosExtraCurriculares: [], encarregados: [], inscricoesPublicas: [] }
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

                if (data.encarregados && Array.isArray(data.encarregados)) {
                    results.push({
                        categoria: 'Encarregados',
                        items: data.encarregados.map((e) => ({
                            id: e.id,
                            nome: e.nome,
                            tipo: 'encarregado',
                            idAluno: e.id_aluno ?? null,
                        })),
                    });
                }

                if (
                    data.inscricoesPublicas &&
                    Array.isArray(data.inscricoesPublicas)
                ) {
                    results.push({
                        categoria: 'Inscrições Públicas',
                        items: data.inscricoesPublicas.map((i) => ({
                            id: i.id,
                            nome: i.nome,
                            tipo: 'inscricao_publica',
                            estado: i.estado,
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
            } else if (result.tipo === 'encarregado') {
                // Não existe ficha própria de EE — navega para a ficha do
                // aluno associado (id_aluno resolvido no backend via
                // DISTINCT ON). Sem aluno associado, não há para onde navegar.
                if (result.idAluno) {
                    path = `/gestor/alunos/ficha/${result.idAluno}`;
                }
            } else if (result.tipo === 'inscricao_publica') {
                path = `/gestor/inscricoes-publicas`;
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

    const initials =
        displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('') || 'U';

    return (
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            <button
                type="button"
                onClick={onToggleSidebar}
                className="-ml-1 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
                aria-label="Abrir menu"
            >
                <Menu size={20} />
            </button>

            <nav
                aria-label="Localização"
                className="hidden min-w-0 items-center gap-1.5 text-sm md:flex"
            >
                {trail?.group ? (
                    <>
                        <span className="truncate text-slate-400">
                            {trail.group}
                        </span>
                        <ChevronRight
                            size={14}
                            className="shrink-0 text-slate-300"
                            aria-hidden="true"
                        />
                    </>
                ) : null}
                <span className="truncate font-medium text-slate-700">
                    {trail?.label || 'Gestudo'}
                </span>
            </nav>

            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
                {canUseGlobalSearch ? (
                    <form
                        onSubmit={handleSearchSubmit}
                        className="min-w-0 flex-1 md:max-w-sm lg:max-w-md"
                    >
                        <div className="relative w-full" ref={searchRef}>
                            <Search
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                            />

                            {isSearchDropdownOpen && search.trim() ? (
                                <div
                                    id="search-results-listbox"
                                    role="listbox"
                                    aria-label="Resultados da pesquisa"
                                    className="fixed inset-x-4 top-[4.5rem] z-[100] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10 sm:absolute sm:inset-x-auto sm:left-0 sm:right-0 sm:top-full sm:mt-2 sm:max-h-96 sm:w-full"
                                >
                                    {isSearching ? (
                                        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-500">
                                            <Loader
                                                size={16}
                                                className="animate-spin"
                                            />
                                            A pesquisar...
                                        </div>
                                    ) : searchResults.every(
                                          (cat) => cat.items.length === 0
                                      ) ? (
                                        <p className="px-4 py-6 text-center text-sm text-slate-500">
                                            Nenhum resultado para &quot;{search}&quot;
                                        </p>
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
                                                        <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                            {
                                                                categoria.categoria
                                                            }
                                                        </p>
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
                                                                        className={`block w-full px-4 py-2 text-left text-sm font-medium transition ${
                                                                            isActive
                                                                                ? 'bg-cyan-50 text-cyan-800'
                                                                                : 'text-slate-700 hover:bg-slate-50'
                                                                        }`}
                                                                    >
                                                                        {
                                                                            item.nome
                                                                        }
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

                <div ref={notificationsRef} className="relative shrink-0">
                    <button
                        type="button"
                        onClick={handleNotificationToggle}
                        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        aria-label={
                            unreadCount > 0
                                ? `Notificações (${unreadCount} por ler)`
                                : 'Notificações'
                        }
                    >
                        <Bell size={19} />
                        {unreadCount > 0 ? (
                            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        ) : null}
                    </button>

                    {isNotificationsOpen ? (
                        <div className="fixed inset-x-4 top-[4.5rem] z-[100] max-h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                <p className="text-sm font-semibold text-slate-800">
                                    Notificações
                                </p>
                                {unreadCount > 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleMarkAllAsRead}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-900"
                                    >
                                        <Check size={14} />
                                        Marcar todas como lidas
                                    </button>
                                ) : null}
                            </div>
                            <div className="max-h-[min(22rem,calc(100vh-14rem))] overflow-auto">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                                        <Bell
                                            size={20}
                                            className="text-slate-300"
                                        />
                                        <p className="text-sm text-slate-500">
                                            Sem notificações de momento.
                                        </p>
                                    </div>
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
                                            className="flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50"
                                        >
                                            <span
                                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                                    notification.lido
                                                        ? 'bg-transparent'
                                                        : 'bg-cyan-500'
                                                }`}
                                                aria-hidden="true"
                                            />
                                            <span className="min-w-0">
                                                <span
                                                    className={`block text-sm ${
                                                        notification.lido
                                                            ? 'text-slate-600'
                                                            : 'font-medium text-slate-800'
                                                    }`}
                                                >
                                                    {notification.titulo}
                                                </span>
                                                {notification.descricao ? (
                                                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">
                                                        {notification.descricao}
                                                    </span>
                                                ) : null}
                                                <span className="mt-1 block text-xs text-slate-400">
                                                    {getRelativeTime(
                                                        notification.createdAt
                                                    )}
                                                </span>
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="border-t border-slate-100 p-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleMenuNavigation(notificationsPath)
                                    }
                                    className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                                >
                                    Ver todas as notificações
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div
                    className="mx-1 hidden h-6 w-px bg-slate-200 sm:block"
                    aria-hidden="true"
                />

                <div ref={dropdownRef} className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setIsDropdownOpen((prev) => !prev);
                            setIsNotificationsOpen(false);
                        }}
                        className="flex items-center gap-2.5 rounded-lg p-1 transition hover:bg-slate-100 md:pr-2"
                        aria-haspopup="menu"
                        aria-expanded={isDropdownOpen}
                        aria-label="Menu da conta"
                    >
                        {user?.imagem_perfil_url ? (
                            <img
                                src={avatarSrc}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                                onError={(event) => {
                                    const image = event.currentTarget;
                                    if (image.dataset.fallbackApplied === '1') {
                                        return;
                                    }
                                    image.dataset.fallbackApplied = '1';
                                    image.src = defaultAvatar;
                                }}
                            />
                        ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                                {initials}
                            </span>
                        )}
                        <span className="hidden min-w-0 text-left md:block">
                            <span className="block max-w-36 truncate text-sm font-medium leading-tight text-slate-800">
                                {displayName}
                            </span>
                            <span className="block text-xs leading-tight text-slate-500">
                                {ROLE_LABEL[user?.role] || 'Utilizador'}
                            </span>
                        </span>
                        <ChevronDown
                            size={16}
                            className="hidden text-slate-400 md:block"
                        />
                    </button>

                    {isDropdownOpen ? (
                        <div
                            role="menu"
                            className="fixed inset-x-4 top-[4.5rem] z-[100] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-60"
                        >
                            <div className="border-b border-slate-100 px-3 pb-2.5 pt-1.5">
                                <p className="truncate text-sm font-medium text-slate-800">
                                    {displayName}
                                </p>
                                {user?.email ? (
                                    <p className="truncate text-xs text-slate-500">
                                        {user.email}
                                    </p>
                                ) : null}
                            </div>
                            <div className="py-1">
                                {user?.role !== 'gestor' ? (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() =>
                                            handleMenuNavigation(
                                                `/${user?.role}/perfil`
                                            )
                                        }
                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <Users
                                            size={16}
                                            className="text-slate-400"
                                        />
                                        Perfil
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() =>
                                            handleMenuNavigation(
                                                '/gestor/configuracoes'
                                            )
                                        }
                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <Settings
                                            size={16}
                                            className="text-slate-400"
                                        />
                                        Configurações
                                    </button>
                                )}
                            </div>
                            <div className="border-t border-slate-100 pt-1">
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={onLogout}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                >
                                    <LogOut size={16} />
                                    Terminar sessão
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    );
}
