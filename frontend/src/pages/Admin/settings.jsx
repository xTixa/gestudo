import {
    Settings,
    Bell,
    Mail,
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
        { id: 'alertas', label: 'Alertas e notificações', icon: Bell },
        { id: 'emails', label: 'Templates de email', icon: Mail },
        { id: 'gestores', label: 'Administradores', icon: Shield },
        { id: 'limpeza', label: 'Limpeza de dados', icon: DatabaseZap },
        { id: 'inscricao-textos', label: 'Formulário de inscrição', icon: FileText },
        { id: 'funcionalidades', label: 'Funcionalidades', icon: SlidersHorizontal },
    ];

    return (
        <section className="space-y-6">
            <AdminPageHeader
                eyebrow="Sistema"
                title="Configurações"
                subtitle="Gestão de preferências e opções do sistema."
                icon={Settings}
            />

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
                {/* Abas */}
                <div
                    role="tablist"
                    aria-label="Secções das configurações"
                    className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 [scrollbar-width:none]"
                >
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab.id)}
                                className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium transition ${
                                    isActive
                                        ? 'border-cyan-600 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                                }`}
                            >
                                <Icon
                                    size={16}
                                    className={isActive ? 'text-cyan-600' : 'text-slate-400'}
                                />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Conteúdo das Abas */}
                <div className="p-5 sm:p-6 lg:p-8">

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
                                        className="px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/50"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Nome (opcional)"
                                        value={novoGestor.nome}
                                        onChange={(e) => setNovoGestor({ ...novoGestor, nome: e.target.value })}
                                        className="px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/50"
                                    />
                                </div>
                                <p className="text-sm text-slate-500 mt-3 mb-4">
                                    Será gerada uma password temporária e enviada para o email indicado.
                                </p>
                                <button
                                    onClick={handleCreateGestor}
                                    disabled={gestoresLoading}
                                    className={`flex items-center gap-2 px-6 py-3 text-white text-base rounded-lg transition font-semibold ${gestoresLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#06b6d4] hover:bg-[#0891b2]'}`}
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
                                                                    <span className="ml-2 text-xs text-[#06b6d4] font-normal">(você)</span>
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
                                                                            className="p-2 text-slate-500 hover:text-[#06b6d4] hover:bg-slate-100 rounded-lg transition"
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

                </div>
            </div>
        </section>
    );
}
