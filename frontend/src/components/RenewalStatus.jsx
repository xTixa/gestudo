import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Calendar } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api.js';

function RenewalCard({ status, anoAtual, dataUltima, onRenewal }) {
    const [isRenewing, setIsRenewing] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    async function handleRenewal() {
        setIsRenewing(true);
        setMessage('');

        try {
            const response = await apiPost('/api/aluno/renovacao/renovar');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao renovar matrícula.');
            }

            setMessageType('success');
            setMessage(data?.message);
            if (onRenewal) {
                onRenewal();
            }
        } catch (error) {
            setMessageType('error');
            setMessage(
                error?.message || 'Não foi possível renovar a matrícula.'
            );
        } finally {
            setIsRenewing(false);
        }
    }

    const isActive = status === true;
    const formatDateLabel = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    return (
        <section className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
            <div
                className={`border-b-2 px-5 py-4 ${
                    isActive
                        ? 'border-green-200 bg-green-50'
                        : 'border-amber-200 bg-amber-50'
                }`}
            >
                <div className="flex items-center gap-3">
                    {isActive ? (
                        <CheckCircle2
                            size={24}
                            className="text-green-600 flex-shrink-0"
                        />
                    ) : (
                        <AlertCircle
                            size={24}
                            className="text-amber-600 flex-shrink-0"
                        />
                    )}
                    <div>
                        <h3 className="font-semibold text-slate-800">
                            Status da Matrícula
                        </h3>
                        <p
                            className={`text-sm ${
                                isActive ? 'text-green-600' : 'text-amber-600'
                            }`}
                        >
                            {isActive
                                ? `? Renovada para ${anoAtual}`
                                : `? Requer renovação`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 py-4">
                <div className="space-y-4">
                    {/* Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                                Ano Letivo Atual
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                                {anoAtual || '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                                Última Renovação
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                                {formatDateLabel(dataUltima)}
                            </p>
                        </div>
                    </div>

                    {/* Message Alert */}
                    {message && (
                        <div
                            className={`rounded-lg px-3 py-2 text-sm ${
                                messageType === 'success'
                                    ? 'border border-green-200 bg-green-50 text-green-700'
                                    : 'border border-red-200 bg-red-50 text-red-700'
                            }`}
                        >
                            {message}
                        </div>
                    )}

                    {/* Renewal Button */}
                    {!isActive && (
                        <div className="border-t border-slate-200 pt-4">
                            <p className="text-sm text-slate-600 mb-3">
                                Renove a sua matrícula para continuar a ter
                                acesso à plataforma.
                            </p>
                            <button
                                type="button"
                                onClick={handleRenewal}
                                disabled={isRenewing}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#14ad81] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f8d69] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw
                                    size={16}
                                    className={isRenewing ? 'animate-spin' : ''}
                                />
                                {isRenewing
                                    ? 'Renovando...'
                                    : 'Renovar Matrícula'}
                            </button>
                        </div>
                    )}

                    {/* Info Text */}
                    {isActive && (
                        <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                            <Calendar
                                size={14}
                                className="flex-shrink-0 mt-0.5"
                            />
                            <p>
                                A sua matrícula está ativa para o ano letivo
                                atual.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default function RenewalStatus() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [renewalStatus, setRenewalStatus] = useState(null);

    async function loadStatus() {
        setLoading(true);
        setError('');

        try {
            const response = await apiGet('/api/aluno/renovacao/status');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Erro ao obter status de renovação.'
                );
            }

            setRenewalStatus(data);
        } catch (requestError) {
            setError(
                requestError?.message || 'Erro ao carregar status de renovação.'
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadStatus();
    }, []);

    if (loading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm text-slate-500">
                    A carregar status de renovação...
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-sm text-red-700">{error}</p>
            </section>
        );
    }

    if (!renewalStatus) {
        return null;
    }

    return (
        <RenewalCard
            status={renewalStatus.matriculaAtiva}
            anoAtual={renewalStatus.anoLetivoAtual}
            dataUltima={renewalStatus.renovacao.dataUltmaRenovacao}
            onRenewal={loadStatus}
        />
    );
}
