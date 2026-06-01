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
        <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                        dataKey="alunos"
                        name="Inscrições ativas"
                        fill="#A8D5E2"
                    />
                    <Bar
                        dataKey="sessoes"
                        name="Serviços ativos"
                        fill="#C9B8E4"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
