import { useEffect, useMemo, useState } from 'react';
import {
    Bell,
    BellRing,
    CalendarCheck2,
    CheckSquare,
    Circle,
    CreditCard,
    GraduationCap,
    KeyRound,
    Mail,
    MessageSquare,
    MonitorCog,
    MonitorIcon,
    RefreshCcw,
    Trash2,
    UserPlus,
    UserRoundX,
    Wallet,
    Wrench,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { CUSTOM_GROUP_TEMPLATE, DEFAULT_ALERT_GROUPS } from './alertsConfig';
import {
    atualizarPreferencias,
    obterDefinicoes,
    obterMinhasPreferencias,
} from '../../utils/api';

const STORAGE_KEY = 'mc_alerts_config_v1';
const EXCLUDED_GROUP_IDS = new Set(['financeiro']);
const EXCLUDED_ALERT_CODES = new Set(['salas-disponiveis', 'manutencao-salas']);

const ICON_MAP = {
    Bell,
    BellRing,
    CalendarCheck2,
    Circle,
    CreditCard,
    GraduationCap,
    KeyRound,
    MonitorCog,
    MonitorIcon,
    RefreshCcw,
    UserPlus,
    UserRoundX,
    Wallet,
    Wrench,
};

function isVisibleAlertCode(value) {
    return !EXCLUDED_ALERT_CODES.has(String(value || '').trim());
}

function toSerializable(groups) {
    return (groups || []).map((group) => ({
        ...group,
        items: (group.items || []).map((item) => ({
            ...item,
            icon:
                typeof item.icon === 'string'
                    ? item.icon
                    : item.icon?.displayName || item.icon?.name || 'Bell',
        })),
    }));
}

function withIcons(groups) {
    return (groups || []).map((group) => ({
        ...group,
        items: (group.items || []).map((item) => ({
            ...item,
            icon: ICON_MAP[item.icon] || Bell,
        })),
    }));
}

function createFallbackGroup(groupId) {
    return {
        id: groupId,
        label: groupId.charAt(0).toUpperCase() + groupId.slice(1),
        barClass: 'bg-slate-100',
        iconClass: 'bg-slate-100 text-slate-600',
        items: [],
    };
}

function getStoredCustomGroup() {
    try {
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        if (!storedRaw) {
            return null;
        }

        const storedParsed = JSON.parse(storedRaw);
        if (!Array.isArray(storedParsed)) {
            return null;
        }

        const storedWithIcons = withIcons(storedParsed);
        const customGroup = storedWithIcons.find(
            (group) => group?.id === CUSTOM_GROUP_TEMPLATE.id
        );

        if (!customGroup) {
            return null;
        }

        const items = (customGroup.items || []).filter((item) =>
            isVisibleAlertCode(item.codigo || item.id)
        );

        if (!items.length) {
            return null;
        }

        return {
            ...customGroup,
            items,
        };
    } catch {
        return null;
    }
}

function buildInitialState() {
    const defaults = withIcons(DEFAULT_ALERT_GROUPS);

    try {
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        if (!storedRaw) {
            return defaults;
        }

        const storedParsed = JSON.parse(storedRaw);
        if (!Array.isArray(storedParsed)) {
            return defaults;
        }

        const storedWithIcons = withIcons(storedParsed);
        const storedById = new Map(
            storedWithIcons.map((group) => [group.id, group])
        );

        const merged = defaults.map((group) => {
            const persisted = storedById.get(group.id);
            if (!persisted) {
                return {
                    ...group,
                    items: (group.items || []).filter((item) =>
                        isVisibleAlertCode(item.codigo || item.id)
                    ),
                };
            }

            const persistedItemsById = new Map(
                (persisted.items || []).map((item) => [item.id, item])
            );

            return {
                ...group,
                items: (group.items || [])
                    .filter((item) =>
                        isVisibleAlertCode(item.codigo || item.id)
                    )
                    .map((item) => {
                        const persistedItem = persistedItemsById.get(item.id);
                        if (!persistedItem) {
                            return item;
                        }

                        return {
                            ...item,
                            appEnabled: Boolean(persistedItem.appEnabled),
                            emailEnabled: Boolean(persistedItem.emailEnabled),
                            smsEnabled: Boolean(persistedItem.smsEnabled),
                        };
                    }),
            };
        });

        const customGroup = storedById.get(CUSTOM_GROUP_TEMPLATE.id);
        if (customGroup) {
            const items = (customGroup.items || []).filter((item) =>
                isVisibleAlertCode(item.codigo || item.id)
            );

            if (items.length > 0) {
                merged.push({
                    ...customGroup,
                    items,
                });
            }
        }

        return merged;
    } catch {
        return defaults;
    }
}

function buildAlertsFromBackend(defsData = {}, preferences = []) {
    const prefsMap = new Map(
        (preferences || []).map((pref) => [pref.codigo, pref])
    );

    return Object.keys(defsData)
        .filter((groupId) => !EXCLUDED_GROUP_IDS.has(groupId))
        .map((groupId) => {
            const groupDefinitions = (defsData[groupId] || []).filter(
                (definition) =>
                    isVisibleAlertCode(definition?.codigo || definition?.id)
            );

            if (!groupDefinitions.length) {
                return null;
            }

            const groupTemplate =
                DEFAULT_ALERT_GROUPS.find((group) => group.id === groupId) ||
                createFallbackGroup(groupId);

            return {
                ...groupTemplate,
                items: groupDefinitions.map((definition) => {
                    const preference = prefsMap.get(definition.codigo);

                    return {
                        id: definition.id,
                        codigo: definition.codigo,
                        title: definition.titulo,
                        description: definition.descricao,
                        icon: ICON_MAP[definition.icone] || Bell,
                        icone: definition.icone,
                        appEnabled:
                            preference?.canal_app !== undefined
                                ? preference.canal_app
                                : definition.canal_app_default,
                        emailEnabled:
                            preference?.canal_email !== undefined
                                ? preference.canal_email
                                : definition.canal_email_default,
                        smsEnabled:
                            preference?.canal_sms !== undefined
                                ? preference.canal_sms
                                : definition.canal_sms_default,
                        ativo:
                            preference?.ativo !== undefined
                                ? preference.ativo
                                : true,
                    };
                }),
            };
        })
        .filter(Boolean);
}

function ToggleSwitch({ checked, onChange, loading }) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={loading}
            aria-pressed={checked}
            className={`relative h-5 w-9 rounded-full border transition ${
                checked
                    ? 'border-indigo-300 bg-indigo-300'
                    : 'border-slate-300 bg-slate-200'
            } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
        >
            <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                    checked ? 'left-[18px]' : 'left-0.5'
                }`}
            />
            <span className="sr-only">Alternar estado</span>
        </button>
    );
}

export default function AlertsPage() {
    const [alerts, setAlerts] = useState(() => {
        try {
            return buildInitialState();
        } catch (error) {
            console.error('[alerts] Erro na inicialização:', error);
            return withIcons(DEFAULT_ALERT_GROUPS);
        }
    });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);

                const defsResult = await obterDefinicoes();

                if (cancelled) {
                    return;
                }

                if (!defsResult?.success) {
                    setAlerts(buildInitialState());
                    return;
                }

                const defsData = defsResult.data || {};
                const defsHasGroups = Object.keys(defsData).length > 0;

                let preferences = [];
                try {
                    const prefsResult = await obterMinhasPreferencias();
                    if (
                        prefsResult?.success &&
                        Array.isArray(prefsResult.data)
                    ) {
                        preferences = prefsResult.data;
                    }
                } catch (prefError) {
                    console.warn(
                        '[alerts] Erro ao carregar preferências, continuando sem elas:',
                        prefError?.message || prefError
                    );
                }

                if (!defsHasGroups) {
                    setAlerts(buildInitialState());
                    return;
                }

                const builtAlerts = buildAlertsFromBackend(
                    defsData,
                    preferences
                );
                const customGroup = getStoredCustomGroup();
                const nextAlerts = customGroup
                    ? [...builtAlerts, customGroup]
                    : builtAlerts;

                if (!cancelled) {
                    setAlerts(nextAlerts);
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(toSerializable(nextAlerts))
                    );
                }
            } catch (err) {
                console.error('[alerts] Erro ao carregar alertas:', err);
                setError(`Erro: ${err.message || 'Erro desconhecido'}`);
                setAlerts(buildInitialState());
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadData();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!loading) {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(toSerializable(alerts))
            );
        }
    }, [alerts, loading]);

    const customGroup = useMemo(() => {
        if (!Array.isArray(alerts)) return null;
        return (
            alerts.find((group) => group?.id === CUSTOM_GROUP_TEMPLATE.id) ||
            null
        );
    }, [alerts]);

    async function toggleChannel(groupId, itemId, channelKey) {
        if (!Array.isArray(alerts)) {
            console.warn('[alerts] toggle: alerts não é array');
            return;
        }

        const group = alerts.find((candidate) => candidate?.id === groupId);
        if (!group) return;

        const item = (group.items || []).find(
            (candidate) => candidate?.id === itemId
        );
        if (!item) return;

        const newValue = !item[channelKey];
        const channelMap = {
            appEnabled: 'canal_app',
            emailEnabled: 'canal_email',
            smsEnabled: 'canal_sms',
        };
        const apiChannel = channelMap[channelKey];

        setAlerts((prev) =>
            prev.map((currentGroup) => {
                if (currentGroup.id !== groupId) return currentGroup;

                return {
                    ...currentGroup,
                    items: (currentGroup.items || []).map((currentItem) =>
                        currentItem.id !== itemId
                            ? currentItem
                            : { ...currentItem, [channelKey]: newValue }
                    ),
                };
            })
        );

        try {
            setSyncing((prev) => ({
                ...prev,
                [`${groupId}-${itemId}-${channelKey}`]: true,
            }));

            const result = await atualizarPreferencias(item.codigo, {
                [apiChannel]: newValue,
            });

            if (!result?.success) {
                setAlerts((prev) =>
                    prev.map((currentGroup) => {
                        if (currentGroup.id !== groupId) return currentGroup;

                        return {
                            ...currentGroup,
                            items: (currentGroup.items || []).map(
                                (currentItem) =>
                                    currentItem.id !== itemId
                                        ? currentItem
                                        : {
                                              ...currentItem,
                                              [channelKey]: !newValue,
                                          }
                            ),
                        };
                    })
                );
                setError(
                    `Erro ao sincronizar: ${result?.message || 'erro desconhecido'}`
                );
            }
        } catch (err) {
            console.error('Erro ao sincronizar preferência:', err);
            setAlerts((prev) =>
                prev.map((currentGroup) => {
                    if (currentGroup.id !== groupId) return currentGroup;

                    return {
                        ...currentGroup,
                        items: (currentGroup.items || []).map((currentItem) =>
                            currentItem.id !== itemId
                                ? currentItem
                                : { ...currentItem, [channelKey]: !newValue }
                        ),
                    };
                })
            );
        } finally {
            setSyncing((prev) => {
                const nextSyncing = { ...prev };
                delete nextSyncing[`${groupId}-${itemId}-${channelKey}`];
                return nextSyncing;
            });
        }
    }

    function setAllByChannel(channelKey, value) {
        setAlerts((prev) => {
            if (!Array.isArray(prev)) return prev;

            return prev.map((group) => ({
                ...group,
                items: (group.items || []).map((item) => ({
                    ...item,
                    [channelKey]: value,
                })),
            }));
        });

        if (!Array.isArray(alerts)) return;

        alerts.forEach((group) => {
            if (!group || !Array.isArray(group.items)) return;

            group.items.forEach((item) => {
                if (item && item.codigo && item[channelKey] !== value) {
                    const channelMap = {
                        appEnabled: 'canal_app',
                        emailEnabled: 'canal_email',
                        smsEnabled: 'canal_sms',
                    };
                    const apiChannel = channelMap[channelKey];

                    atualizarPreferencias(item.codigo, {
                        [apiChannel]: value,
                    }).catch((err) => {
                        console.error(
                            `Erro ao sincronizar ${item.codigo}:`,
                            err
                        );
                    });
                }
            });
        });
    }

    function removeCustomAlert(itemId) {
        setAlerts((prev) => {
            if (!Array.isArray(prev)) return prev;

            return prev
                .map((group) => {
                    if (!group || group.id !== CUSTOM_GROUP_TEMPLATE.id) {
                        return group;
                    }

                    return {
                        ...group,
                        items: (group.items || []).filter(
                            (item) => item && item.id !== itemId
                        ),
                    };
                })
                .filter(
                    (group) =>
                        group &&
                        (group.id !== CUSTOM_GROUP_TEMPLATE.id ||
                            (group.items && group.items.length > 0))
                );
        });
    }

    function resetToDefaults() {
        if (!window.confirm('Reset aos alertas para o estado inicial?')) {
            return;
        }

        async function reload() {
            try {
                const defsResult = await obterDefinicoes();
                const prefsResult = await obterMinhasPreferencias();

                if (!defsResult?.success) {
                    setAlerts(buildInitialState());
                    return;
                }

                const preferences =
                    prefsResult?.success && Array.isArray(prefsResult.data)
                        ? prefsResult.data
                        : [];

                const builtAlerts = buildAlertsFromBackend(
                    defsResult.data || {},
                    preferences
                );
                const customGroup = getStoredCustomGroup();
                setAlerts(
                    customGroup ? [...builtAlerts, customGroup] : builtAlerts
                );
            } catch (err) {
                console.error('Erro ao recarregar:', err);
            }
        }

        reload();
    }

    if (loading) {
        return (
            <section className="mx-auto w-full max-w-7xl">
                <div className="flex items-center justify-center py-12">
                    <p className="text-slate-600">
                        A carregar configuração de alertas...
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto w-full max-w-7xl space-y-4 pb-8 sm:pb-10">
            <AdminPageHeader
                eyebrow="Alertas"
                title="Alertas e Notificações"
                subtitle="Configure como deseja receber as notificações. Pode adicionar alertas personalizados agora e depois."
                icon={BellRing}
                actions={
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
                        <button
                            type="button"
                            onClick={() => setAllByChannel('appEnabled', true)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 sm:text-xs"
                        >
                            <CheckSquare size={13} />
                            Ativar Todos na App
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setAllByChannel('emailEnabled', true)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 sm:text-xs"
                        >
                            <CheckSquare size={13} />
                            Ativar Todos no Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setAllByChannel('smsEnabled', true)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 sm:text-xs"
                        >
                            <CheckSquare size={13} />
                            Ativar Todos por Mensagem
                        </button>
                        <button
                            type="button"
                            onClick={resetToDefaults}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 sm:text-xs"
                        >
                            Reset Defaults
                        </button>
                    </div>
                }
            />

            {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:text-sm">
                    {error}
                </div>
            ) : null}

            {customGroup ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
                    Tem {customGroup.items?.length || 0} alerta(s)
                    personalizado(s). Estes ficam guardados apenas localmente
                    até sincronizar com backend.
                </div>
            ) : null}

            {Array.isArray(alerts) && alerts.length > 0 ? (
                <div className="overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {alerts.map((group) => {
                        if (!group || !Array.isArray(group.items)) return null;

                        return (
                            <article key={group.id}>
                                <div
                                    className={`px-4 py-2 text-sm font-semibold ${group.barClass}`}
                                >
                                    {group.label}
                                </div>

                                {group.items.map((item) => {
                                    const ItemIcon = item.icon;
                                    const isCustom =
                                        group.id === CUSTOM_GROUP_TEMPLATE.id;
                                    const syncKeyApp = `${group.id}-${item.id}-appEnabled`;
                                    const syncKeyEmail = `${group.id}-${item.id}-emailEnabled`;
                                    const syncKeySms = `${group.id}-${item.id}-smsEnabled`;
                                    const syncingApp = syncing[syncKeyApp];
                                    const syncingEmail = syncing[syncKeyEmail];
                                    const syncingSms = syncing[syncKeySms];

                                    return (
                                        <div
                                            key={item.id}
                                            className="flex flex-col gap-2 border-b border-slate-100 px-4 py-2.5 last:border-b-0 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div
                                                    className={`mt-0.5 rounded-md border p-1.5 ${group.iconClass}`}
                                                >
                                                    <ItemIcon size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-700">
                                                        {item.title}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-slate-400">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 sm:w-auto sm:gap-5 md:flex md:items-center md:gap-5">
                                                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                                                    <MonitorIcon size={14} />
                                                    <ToggleSwitch
                                                        checked={
                                                            item.appEnabled
                                                        }
                                                        loading={syncingApp}
                                                        onChange={() =>
                                                            toggleChannel(
                                                                group.id,
                                                                item.id,
                                                                'appEnabled'
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                                                    <Mail size={14} />
                                                    <ToggleSwitch
                                                        checked={
                                                            item.emailEnabled
                                                        }
                                                        loading={syncingEmail}
                                                        onChange={() =>
                                                            toggleChannel(
                                                                group.id,
                                                                item.id,
                                                                'emailEnabled'
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                                                    <MessageSquare size={14} />
                                                    <ToggleSwitch
                                                        checked={
                                                            item.smsEnabled
                                                        }
                                                        loading={syncingSms}
                                                        onChange={() =>
                                                            toggleChannel(
                                                                group.id,
                                                                item.id,
                                                                'smsEnabled'
                                                            )
                                                        }
                                                    />
                                                </div>

                                                {isCustom ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeCustomAlert(
                                                                item.id
                                                            )
                                                        }
                                                        className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                                        title="Remover alerta personalizado"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </article>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
}
