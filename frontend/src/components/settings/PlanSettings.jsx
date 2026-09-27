import { useEffect, useState } from 'react';
import { Check, Lock, Mail } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { SALES_EMAIL } from '../../utils/plan';

function UsageBar({ label, used, max }) {
    const unlimited = max == null;
    const ratio = unlimited ? 0 : Math.min(used / max, 1);
    const tone =
        ratio >= 1 ? 'bg-red-500' : ratio >= 0.85 ? 'bg-york-500' : 'bg-emerald-500';

    return (
        <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-sm tabular-nums text-slate-500">
                    <span className="font-semibold text-slate-900">{used}</span>
                    {unlimited ? ' · ilimitado' : ` / ${max}`}
                </p>
            </div>
            {!unlimited && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className={`h-full rounded-full ${tone}`}
                        style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                    />
                </div>
            )}
            {!unlimited && ratio >= 1 && (
                <p className="mt-2 text-xs text-red-600">
                    Limite atingido — não é possível ativar mais contas.
                </p>
            )}
        </div>
    );
}

export default function PlanSettings() {
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        apiGet('/api/gestor/plano')
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data?.message);
                if (active) setPlan(data);
            })
            .catch((err) => {
                if (active) {
                    setError(err?.message || 'Não foi possível carregar o pacote.');
                }
            });
        return () => {
            active = false;
        };
    }, []);

    if (error) {
        return <p className="text-sm text-red-600">{error}</p>;
    }

    if (!plan) {
        return <p className="text-sm text-slate-500">A carregar…</p>;
    }

    const modules = Object.entries(plan.catalogo || {});
    const included = modules.filter(([key]) => plan.modulos?.[key]);
    const missing = modules.filter(([key]) => !plan.modulos?.[key]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm text-slate-500">Pacote contratado</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                        {plan.nome}
                    </h2>
                </div>
                {plan.plano !== 'completo' && (
                    <a
                        href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`Mudança de pacote (atual: ${plan.nome})`)}`}
                        className="inline-flex items-center gap-2 self-start rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                        <Mail size={16} />
                        Pedir mudança de pacote
                    </a>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <UsageBar
                    label="Alunos ativos"
                    used={plan.uso?.alunos ?? 0}
                    max={plan.limites?.alunos}
                />
                <UsageBar
                    label="Contas de gestor ativas"
                    used={plan.uso?.gestores ?? 0}
                    max={plan.limites?.gestores}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                        Incluído no seu pacote
                    </h3>
                    <ul className="mt-3 space-y-2">
                        {included.map(([key, info]) => (
                            <li key={key} className="flex items-center gap-2.5 text-sm text-slate-700">
                                <Check size={16} className="shrink-0 text-emerald-600" />
                                {info.nome}
                            </li>
                        ))}
                        <li className="flex items-center gap-2.5 text-sm text-slate-700">
                            <Check size={16} className="shrink-0 text-emerald-600" />
                            Alunos, professores, agenda, presenças e dashboard
                        </li>
                    </ul>
                </div>

                {missing.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                            Disponível noutros pacotes
                        </h3>
                        <ul className="mt-3 space-y-2">
                            {missing.map(([key, info]) => (
                                <li key={key} className="flex items-center gap-2.5 text-sm text-slate-500">
                                    <Lock size={15} className="shrink-0 text-slate-400" />
                                    <span className="flex-1">{info.nome}</span>
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                        {info.desdeNome}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
