import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

export default function WeeklyChart({
    data = [],
    loading = false,
    error = '',
    expanded = false,
}) {
    if (loading) {
        return (
            <p className="mt-6 text-sm text-slate-500">
                A carregar atividade semanal...
            </p>
        );
    }

    if (error) {
        return <p className="mt-6 text-sm text-red-600">{error}</p>;
    }

    if (!data.length) {
        return (
            <p className="mt-6 text-sm text-slate-500">
                Sem dados para os últimos 7 dias.
            </p>
        );
    }

    return (
        <div className={expanded ? 'mt-6 h-[min(65vh,34rem)]' : 'mt-6 h-64'}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                        dataKey="alunos"
                        name="Inscrições ativas"
                        fill="#14ad81"
                    />
                    <Bar
                        dataKey="sessoes"
                        name="Serviços ativos"
                        fill="#1e3a5f"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
