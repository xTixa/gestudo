import { CheckCircle2, Clock, Lock, Minus } from 'lucide-react';

// Estados do pagamento mensal a um professor (ícone + texto, nunca só cor).
const ESTADOS = {
    em_aberto: { label: 'Em aberto', icon: Clock, className: 'bg-slate-100 text-slate-700' },
    por_pagar: { label: 'Por pagar', icon: Lock, className: 'bg-amber-50 text-amber-700' },
    pago: { label: 'Pago', icon: CheckCircle2, className: 'bg-green-50 text-green-700' },
    sem_sessoes: { label: 'Sem sessões', icon: Minus, className: 'bg-slate-50 text-slate-400' },
};

export default function CustoEstadoBadge({ estado }) {
    const config = ESTADOS[estado] || ESTADOS.em_aberto;
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
            <Icon size={12} aria-hidden="true" />
            {config.label}
        </span>
    );
}
