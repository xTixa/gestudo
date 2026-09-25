import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

export default function MonthlyChart({
    data = [],
    loading = false,
    error = '',
    expanded = false,
}) {
    if (loading) {
        return (
            <p className="mt-6 text-sm text-slate-500">
                A carregar serviços por mês...
            </p>
        );
    }

    if (error) {
        return <p className="mt-6 text-sm text-red-600">{error}</p>;
    }

    if (!data.length) {
        return (
            <p className="mt-6 text-sm text-slate-500">
                Sem dados para os últimos 6 meses.
            </p>
        );
    }

    return (
        <div className={expanded ? 'mt-6 h-[min(65vh,34rem)]' : 'mt-6 h-64'}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                        dataKey="curriculares"
                        name="Curriculares ativos"
                        fill="#06b6d4"
                    />
                    <Bar
                        dataKey="extra"
                        name="Extra-curriculares ativos"
                        fill="#1e293b"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
