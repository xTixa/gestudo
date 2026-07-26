import {
    Settings,
    Bell,
    Mail,
    AlertTriangle,
    Plus,
    Trash2,
    Check,
    AlertCircle,
    Shield,
    UserPlus,
    ToggleLeft,
    ToggleRight,
    DatabaseZap,
    FileText,
    SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import AlertsPage from './alerts';
import EmailTemplatesSettings from '../../components/settings/EmailTemplatesSettings';
import DataCleanupSettings from '../../components/settings/DataCleanupSettings';
import EnrollmentFormTextsSettings from '../../components/settings/EnrollmentFormTextsSettings';
import FeatureFlagsSettings from '../../components/settings/FeatureFlagsSettings';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../utils/api';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('alertas');
    const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
    const [novoAviso, setNovoAviso] = useState({ titulo: '', descricao: '' });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);

    // Gestores
    const [gestores, setGestores] = useState([]);
    const [novoGestor, setNovoGestor] = useState({ email: '', nome: '' });
    const [gestoresLoading, setGestoresLoading] = useState(false);
    const currentUserId = (() => {
        try { return JSON.parse(localStorage.getItem('mc_user') || '{}').id; } catch { return null; }
    })();

    useEffect(() => {
        if (activeTab !== 'gestores') return;
        let isMounted = true;

        async function loadGestores() {
            try {
                const response = await apiGet('/api/gestor/gestores');
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao carregar administradores.');
                if (isMounted) setGestores(Array.isArray(data) ? data : []);
            } catch (error) {
                if (isMounted) {
                    setNotification({ type: 'error', message: error.message || 'Erro ao carregar administradores.' });
                    setTimeout(() => setNotification(null), 4000);
                }
            }
        }

        loadGestores();
        return () => { isMounted = false; };
    }, [activeTab]);

    useEffect(() => {
        let isMounted = true;

        async function loadMaintenanceAlerts() {
            try {
                const response = await apiGet('/api/gestor/manutencao-avisos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar avisos de manutenção.'
                    );
                }

                if (isMounted) {
                    setMaintenanceAlerts(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                if (isMounted) {
                    setNotification({
                        type: 'error',
                        message:
                            error.message ||
                            'Erro ao carregar avisos de manutenção.',
                    });
                    setTimeout(() => setNotification(null), 4000);
                }
            }
        }

        loadMaintenanceAlerts();

        return () => {
            isMounted = false;
        };
    }, []);

    async function handleCreateGestor() {
        const email = novoGestor.email.trim();
        const nome = novoGestor.nome.trim();

        if (!email) {
            setNotification({ type: 'error', message: 'O email é obrigatório.' });
            setTimeout(() => setNotification(null), 4000);
            return;
        }

        setGestoresLoading(true);
        try {
            const response = await apiPost('/api/gestor/gestores', { email, nome });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao criar administrador.');
            setGestores([data.gestor, ...gestores]);
            setNovoGestor({ email: '', nome: '' });
            setNotification({ type: 'success', message: 'Administrador criado. As credenciais foram enviadas por email.' });
            setTimeout(() => setNotification(null), 5000);
        } catch (error) {
            setNotification({ type: 'error', message: error.message || 'Erro ao criar administrador.' });
            setTimeout(() => setNotification(null), 4000);
        } finally {
            setGestoresLoading(false);
        }
    }

    async function handleToggleGestor(gestor) {
        const novoStatus = !gestor.status;
        try {
            const response = await apiPatch(`/api/gestor/gestores/${gestor.id_user}/estado`, { status: novoStatus });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao alterar estado.');
            setGestores(gestores.map((g) => g.id_user === gestor.id_user ? { ...g, status: novoStatus } : g));
        } catch (error) {
            setNotification({ type: 'error', message: error.message || 'Erro ao alterar estado.' });
            setTimeout(() => setNotification(null), 4000);
        }
    }

    async function handleRemoveGestor(gestor) {
        if (!window.confirm(`Remover o administrador ${gestor.email}?`)) return;
        try {
            const response = await apiDelete(`/api/gestor/gestores/${gestor.id_user}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao remover administrador.');
            setGestores(gestores.filter((g) => g.id_user !== gestor.id_user));
            setNotification({ type: 'success', message: 'Administrador removido com sucesso.' });
            setTimeout(() => setNotification(null), 4000);
        } catch (error) {
            setNotification({ type: 'error', message: error.message || 'Erro ao remover administrador.' });
            setTimeout(() => setNotification(null), 4000);
        }
    }

    const tabs = [
        { id: 'alertas', label: 'Alertas e Notificações', icon: Bell },
        { id: 'emails', label: 'Templates de Email', icon: Mail },
        { id: 'manutencao', label: 'Avisos de Manutenção', icon: AlertTriangle },
        { id: 'gestores', label: 'Administradores', icon: Shield },
        { id: 'limpeza', label: 'Limpeza de Dados', icon: DatabaseZap },
        { id: 'inscricao-textos', label: 'Formulário de Inscrição', icon: FileText },
        { id: 'funcionalidades', label: 'Funcionalidades', icon: SlidersHorizontal },
    ];

    async function handleAddMaintenance() {
        if (!novoAviso.titulo.trim()) {
            setNotification({
                type: 'error',
                message: 'Por favor, preencha o título do aviso',
            });
            setTimeout(() => setNotification(null), 4000);
            return;
        }

        setLoading(true);
        try {
            const novoItem = {
                titulo: novoAviso.titulo,
                descricao: novoAviso.descricao,
                ativa: true,
                criadaEm: new Date().toISOString().split('T')[0],
            };

            // Salvar aviso no backend
            const response = await apiPost(
                '/api/gestor/manutencao-avisos',
                novoItem
            );

            if (!response.ok) {
                throw new Error('Erro ao criar aviso');
            }

            const savedItem = await response.json();

            setMaintenanceAlerts([...maintenanceAlerts, savedItem]);
            setNovoAviso({ titulo: '', descricao: '' });
            setNotification({
                type: 'success',
                message: 'Aviso criado e notificações enviadas com sucesso!',
            });
            setTimeout(() => setNotification(null), 4000);
        } catch (error) {
            console.error('Erro:', error);
            setNotification({
                type: 'error',
                message: 'Erro ao criar aviso: ' + error.message,
            });
            setTimeout(() => setNotification(null), 4000);
        } finally {
            setLoading(false);
        }
    }

    async function handleRemoveMaintenance(id) {
        try {
            const response = await apiDelete(
                `/api/gestor/manutencao-avisos/${id}`
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Erro ao remover aviso');
            }
            setMaintenanceAlerts(
                maintenanceAlerts.filter((item) => item.id !== id)
            );
            setNotification({
                type: 'success',
                message: 'Aviso removido com sucesso!',
            });
            setTimeout(() => setNotification(null), 4000);
        } catch (error) {
            console.error('Erro ao remover:', error);
            setNotification({
                type: 'error',
                message: 'Erro ao remover aviso',
            });
            setTimeout(() => setNotification(null), 4000);
        }
    }

    async function handleToggleMaintenance(id) {
        const item = maintenanceAlerts.find((a) => a.id === id);
        if (!item) return;

        try {
            const response = await apiPatch(
                `/api/gestor/manutencao-avisos/${id}`,
                { ativa: !item.ativa }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Erro ao atualizar aviso');
            }
            setMaintenanceAlerts(
                maintenanceAlerts.map((a) =>
                    a.id === id ? { ...a, ativa: !a.ativa } : a
                )
            );
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            setNotification({
                type: 'error',
                message: 'Erro ao atualizar aviso',
            });
            setTimeout(() => setNotification(null), 4000);
        }
    }

    return (
        <section className="space-y-6">
            <AdminPageHeader
                eyebrow="Sistema"
                title="Configurações"
                subtitle="Gestão de preferências e opções do sistema."
                icon={Settings}
            />

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Abas */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-6 py-4 text-base font-medium transition ${
                                    isActive
                                        ? 'border-b-2 border-[#14ad81] text-[#14ad81] bg-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Icon size={22} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Conteúdo das Abas */}
                <div className="p-8 lg:p-10">

                    {activeTab === 'alertas' && <AlertsPage />}
                    {activeTab === 'emails' && <EmailTemplatesSettings />}
                    {activeTab === 'limpeza' && <DataCleanupSettings />}
                    {activeTab === 'inscricao-textos' && <EnrollmentFormTextsSettings />}
                    {activeTab === 'funcionalidades' && <FeatureFlagsSettings />}

                    {/* ABA: Administradores */}
                    {activeTab === 'gestores' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                                    Administradores
                                </h2>
                                <p className="text-base text-slate-600 mb-8">
                                    Crie e gira as contas de administrador do sistema.
                                </p>
                            </div>

                            {notification && (
                                <div className={`flex items-center gap-3 px-6 py-4 rounded-lg border-l-4 ${notification.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}`}>
                                    {notification.type === 'success' ? <Check size={20} className="flex-shrink-0" /> : <AlertCircle size={20} className="flex-shrink-0" />}
                                    <p className="text-sm font-medium">{notification.message}</p>
                                </div>
                            )}

                            {/* Formulário novo administrador */}
                            <div className="rounded-lg border border-slate-200 p-6 bg-slate-50">
                                <h3 className="font-semibold text-lg text-slate-800 mb-5 flex items-center gap-2">
                                    <UserPlus size={20} />
                                    Adicionar Administrador
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="email"
                                        placeholder="Email *"
                                        value={novoGestor.email}
                                        onChange={(e) => setNovoGestor({ ...novoGestor, email: e.target.value })}
                                        className="px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14ad81]/50"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Nome (opcional)"
                                        value={novoGestor.nome}
                                        onChange={(e) => setNovoGestor({ ...novoGestor, nome: e.target.value })}
                                        className="px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14ad81]/50"
                                    />
                                </div>
                                <p className="text-sm text-slate-500 mt-3 mb-4">
                                    Será gerada uma password temporária e enviada para o email indicado.
                                </p>
                                <button
                                    onClick={handleCreateGestor}
                                    disabled={gestoresLoading}
                                    className={`flex items-center gap-2 px-6 py-3 text-white text-base rounded-lg transition font-semibold ${gestoresLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#14ad81] hover:bg-[#0f8d69]'}`}
                                >
                                    <Plus size={20} />
                                    {gestoresLoading ? 'A criar...' : 'Criar Administrador'}
                                </button>
                            </div>

                            {/* Lista de administradores */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg text-slate-800">
                                    Contas de Administrador
                                </h3>
                                {gestores.length === 0 ? (
                                    <p className="text-base text-slate-500 py-8 text-center">
                                        Nenhum administrador encontrado.
                                    </p>
                                ) : (
                                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="text-left px-6 py-3 font-semibold text-slate-700">Email</th>
                                                    <th className="text-left px-6 py-3 font-semibold text-slate-700">Estado</th>
                                                    <th className="text-left px-6 py-3 font-semibold text-slate-700">Criado em</th>
                                                    <th className="px-6 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gestores.map((gestor) => {
                                                    const isCurrentUser = gestor.id_user === currentUserId;
                                                    return (
                                                        <tr key={gestor.id_user} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                                                            <td className="px-6 py-4 text-slate-800 font-medium">
                                                                {gestor.email}
                                                                {isCurrentUser && (
                                                                    <span className="ml-2 text-xs text-[#14ad81] font-normal">(você)</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${gestor.status ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                                                    {gestor.status ? 'Ativo' : 'Inativo'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-500">
                                                                {gestor.created_at
                                                                    ? new Date(gestor.created_at).toLocaleDateString('pt-PT')
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {!isCurrentUser && (
                                                                    <div className="flex items-center gap-2 justify-end">
                                                                        <button
                                                                            onClick={() => handleToggleGestor(gestor)}
                                                                            title={gestor.status ? 'Desativar' : 'Ativar'}
                                                                            className="p-2 text-slate-500 hover:text-[#14ad81] hover:bg-slate-100 rounded-lg transition"
                                                                        >
                                                                            {gestor.status
                                                                                ? <ToggleRight size={22} className="text-green-600" />
                                                                                : <ToggleLeft size={22} />}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveGestor(gestor)}
                                                                            title="Remover"
                                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ABA: Avisos de Manutenção */}
                    {activeTab === 'manutencao' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                                    Avisos de Manutenção
                                </h2>
                                <p className="text-base text-slate-600 mb-8">
                                    Crie avisos para informar utilizadores sobre
                                    manutenção do sistema.
                                </p>
                            </div>

                            {/* Notificação de sucesso/erro */}
                            {notification && (
                                <div
                                    className={`flex items-center gap-3 px-6 py-4 rounded-lg border-l-4 ${
                                        notification.type === 'success'
                                            ? 'bg-green-50 border-green-500 text-green-800'
                                            : 'bg-red-50 border-red-500 text-red-800'
                                    }`}
                                >
                                    {notification.type === 'success' ? (
                                        <Check
                                            size={20}
                                            className="flex-shrink-0"
                                        />
                                    ) : (
                                        <AlertCircle
                                            size={20}
                                            className="flex-shrink-0"
                                        />
                                    )}
                                    <p className="text-sm font-medium">
                                        {notification.message}
                                    </p>
                                </div>
                            )}

                            {/* Formulário para novo aviso */}
                            <div className="rounded-lg border border-slate-200 p-6 bg-slate-50">
                                <h3 className="font-semibold text-lg text-slate-800 mb-5">
                                    Criar Novo Aviso
                                </h3>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Título do aviso"
                                        value={novoAviso.titulo}
                                        onChange={(e) =>
                                            setNovoAviso({
                                                ...novoAviso,
                                                titulo: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14ad81]/50"
                                    />
                                    <textarea
                                        placeholder="Descrição do aviso"
                                        value={novoAviso.descricao}
                                        onChange={(e) =>
                                            setNovoAviso({
                                                ...novoAviso,
                                                descricao: e.target.value,
                                            })
                                        }
                                        rows="4"
                                        className="w-full px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#14ad81]/50 resize-none"
                                    />
                                    <button
                                        onClick={handleAddMaintenance}
                                        disabled={loading}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white text-base rounded-lg transition font-semibold ${
                                            loading
                                                ? 'bg-slate-400 cursor-not-allowed'
                                                : 'bg-[#14ad81] hover:bg-[#0f8d69]'
                                        }`}
                                    >
                                        <Plus size={20} />
                                        {loading ? 'Criando...' : 'Criar Aviso'}
                                    </button>
                                </div>
                            </div>

                            {/* Lista de avisos */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg text-slate-800">
                                    Avisos Ativos
                                </h3>
                                {maintenanceAlerts.length === 0 ? (
                                    <p className="text-base text-slate-500 py-8 text-center">
                                        Nenhum aviso de manutenção criado.
                                    </p>
                                ) : (
                                    maintenanceAlerts.map((aviso) => (
                                        <div
                                            key={aviso.id}
                                            className={`p-6 rounded-lg border-2 transition ${
                                                aviso.ativa
                                                    ? 'border-amber-200 bg-amber-50'
                                                    : 'border-slate-200 bg-slate-50 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h4 className="font-semibold text-lg text-slate-800">
                                                            {aviso.titulo}
                                                        </h4>
                                                        <button
                                                            onClick={() =>
                                                                handleToggleMaintenance(
                                                                    aviso.id
                                                                )
                                                            }
                                                            className={`text-sm px-3 py-1.5 rounded-full transition font-medium ${
                                                                aviso.ativa
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-slate-200 text-slate-600'
                                                            }`}
                                                        >
                                                            {aviso.ativa
                                                                ? 'Ativo'
                                                                : 'Inativo'}
                                                        </button>
                                                    </div>
                                                    <p className="text-base text-slate-600">
                                                        {aviso.descricao}
                                                    </p>
                                                    <p className="text-sm text-slate-500 mt-3">
                                                        Criado em{' '}
                                                        {aviso.criadaEm}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        handleRemoveMaintenance(
                                                            aviso.id
                                                        )
                                                    }
                                                    className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Remover aviso"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
