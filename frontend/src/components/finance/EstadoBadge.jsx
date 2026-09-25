import { AlertCircle, Ban, CheckCircle2, CircleDashed, Clock } from 'lucide-react';

// O estado é sempre mostrado com ícone + texto (nunca só pela cor).
const ESTADOS = {
    pendente: { label: 'Pendente', icon: Clock, className: 'bg-slate-100 text-slate-700' },
    parcial: { label: 'Parcial', icon: CircleDashed, className: 'bg-sky-50 text-sky-700' },
    paga: { label: 'Paga', icon: CheckCircle2, className: 'bg-green-50 text-green-700' },
    vencida: { label: 'Vencida', icon: AlertCircle, className: 'bg-rose-50 text-rose-700' },
    anulada: { label: 'Anulada', icon: Ban, className: 'bg-slate-100 text-slate-400 line-through' },
};

export default function EstadoBadge({ estado }) {
    const config = ESTADOS[estado] || ESTADOS.pendente;
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
        >
            <Icon size={12} aria-hidden="true" />
            {config.label}
        </span>
    );
}
