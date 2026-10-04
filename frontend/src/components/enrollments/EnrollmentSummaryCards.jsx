export default function EnrollmentSummaryCards({ summary }) {
    const cards = [
        {
            label: 'Pendentes',
            value: summary.pendente,
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            color: 'text-amber-900',
            dotColor: 'bg-amber-500',
        },
        {
            label: 'Aprovadas',
            value: summary.aprovada,
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            color: 'text-emerald-900',
            dotColor: 'bg-emerald-500',
        },
        {
            label: 'Rejeitadas',
            value: summary.rejeitada,
            bg: 'bg-red-50',
            border: 'border-red-200',
            color: 'text-red-900',
            dotColor: 'bg-red-500',
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className={`flex items-center gap-3 rounded-xl border ${card.bg} ${card.border} p-3.5`}
                >
                    <span className={`h-2 w-2 rounded-full ${card.dotColor}`} />
                    <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold ${card.color}`}>
                            {card.label}
                        </p>
                    </div>
                    <p className={`text-lg font-bold ${card.color}`}>
                        {card.value}
                    </p>
                </div>
            ))}
        </div>
    );
}
