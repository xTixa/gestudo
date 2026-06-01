import {
    Settings,
    Bell,
    Mail,
    AlertTriangle,
    Plus,
    Trash2,
    Check,
    AlertCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import AlertsPage from './alerts';
import EmailTemplatesSettings from '../../components/settings/EmailTemplatesSettings';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../utils/api';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('alertas');
    const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
    const [novoAviso, setNovoAviso] = useState({ titulo: '', descricao: '' });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);

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

    const tabs = [
        { id: 'alertas', label: 'Alertas e Notificações', icon: Bell },
        { id: 'emails', label: 'Templates de Email', icon: Mail },
        {
            id: 'manutencao',
            label: 'Avisos de Manutenção',
            icon: AlertTriangle,
        },
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
                                        ? 'border-b-2 border-york-400 text-york-400 bg-white'
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

                    {/* ABA: Alertas e Notificações */}
                    {activeTab === 'alertas' && <AlertsPage />}
                    {activeTab === 'emails' && <EmailTemplatesSettings />}

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
                                        className="w-full px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-york-400/50"
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
                                        className="w-full px-4 py-3 text-base rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-york-400/50 resize-none"
                                    />
                                    <button
                                        onClick={handleAddMaintenance}
                                        disabled={loading}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white text-base rounded-lg transition font-semibold ${
                                            loading
                                                ? 'bg-slate-400 cursor-not-allowed'
                                                : 'bg-york-400 hover:bg-york-200'
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
