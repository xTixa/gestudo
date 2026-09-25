export default function EnrollmentStatusBadge({ status }) {
    const statusConfig = {
        aprovada: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-900',
            dot: 'bg-[#06b6d4]',
            label: 'Aprovada',
        },
        rejeitada: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-900',
            dot: 'bg-red-500',
            label: 'Rejeitada',
        },
        pendente: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-900',
            dot: 'bg-amber-500',
            label: 'Pendente',
        },
    };

    const config =
        statusConfig[String(status || '').toLowerCase()] ||
        statusConfig.pendente;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} border ${config.border} px-2.5 py-1 text-xs font-semibold ${config.text} whitespace-nowrap`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
}
