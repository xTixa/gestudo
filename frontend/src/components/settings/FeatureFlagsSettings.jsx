import { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, Check, AlertCircle } from 'lucide-react';
import { apiGet, apiPatch } from '../../utils/api';

export default function FeatureFlagsSettings() {
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState(null);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function carregar() {
            setLoading(true);
            try {
                const response = await apiGet('/api/gestor/feature-flags');
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar funcionalidades.'
                    );
                }
                if (isMounted) {
                    setFlags(Array.isArray(data?.flags) ? data.flags : []);
                }
            } catch (error) {
                if (isMounted) {
                    setNotification({
                        type: 'error',
                        message:
                            error.message ||
                            'Erro ao carregar funcionalidades.',
                    });
                    setTimeout(() => setNotification(null), 4000);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        carregar();
        return () => {
            isMounted = false;
        };
    }, []);

    async function handleToggle(flag) {
        setSavingKey(flag.key);
        try {
            const response = await apiPatch(
                `/api/gestor/feature-flags/${flag.key}`,
                { ativo: !flag.ativo }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.message || 'Erro ao atualizar funcionalidade.'
                );
            }
            setFlags((prev) =>
                prev.map((item) =>
                    item.key === flag.key ? data.flag : item
                )
            );
        } catch (error) {
            setNotification({
                type: 'error',
                message: error.message || 'Erro ao atualizar funcionalidade.',
            });
            setTimeout(() => setNotification(null), 4000);
        } finally {
            setSavingKey(null);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                    Funcionalidades
                </h2>
                <p className="text-base text-slate-600 mb-8">
                    Ative ou desative funcionalidades visíveis aos
                    utilizadores da plataforma.
                </p>
            </div>

            {notification && (
                <div
                    className={`flex items-center gap-3 px-6 py-4 rounded-lg border-l-4 ${
                        notification.type === 'success'
                            ? 'bg-green-50 border-green-500 text-green-800'
                            : 'bg-red-50 border-red-500 text-red-800'
                    }`}
                >
                    {notification.type === 'success' ? (
                        <Check size={20} className="flex-shrink-0" />
                    ) : (
                        <AlertCircle size={20} className="flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium">
                        {notification.message}
                    </p>
                </div>
            )}

            {loading ? (
                <p className="text-base text-slate-500 py-8 text-center">
                    A carregar funcionalidades...
                </p>
            ) : flags.length === 0 ? (
                <p className="text-base text-slate-500 py-8 text-center">
                    Nenhuma funcionalidade configurável encontrada.
                </p>
            ) : (
                <div className="space-y-4">
                    {flags.map((flag) => (
                        <div
                            key={flag.key}
                            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-6 bg-slate-50"
                        >
                            <div>
                                <h3 className="font-semibold text-lg text-slate-800">
                                    {flag.label}
                                </h3>
                                {flag.descricao ? (
                                    <p className="text-sm text-slate-600 mt-1">
                                        {flag.descricao}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle(flag)}
                                disabled={savingKey === flag.key}
                                title={flag.ativo ? 'Desativar' : 'Ativar'}
                                className="p-2 text-slate-500 hover:text-[#06b6d4] hover:bg-slate-100 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {flag.ativo ? (
                                    <ToggleRight
                                        size={28}
                                        className="text-green-600"
                                    />
                                ) : (
                                    <ToggleLeft size={28} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
