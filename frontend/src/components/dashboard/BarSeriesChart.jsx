import {
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// Cores das séries definidas em index.css (--chart-series-*), validadas para
// daltonismo em modo claro e escuro. A ordem é fixa: série 1, série 2.
const SERIES_COLORS = ['var(--chart-series-1)', 'var(--chart-series-2)'];

function ChartTooltip({ active, payload, label, series, valueFormatter }) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-900/10">
            <p className="mb-1.5 font-medium text-slate-800">{label}</p>
            <ul className="space-y-1">
                {series.map((item, index) => {
                    const entry = payload.find((p) => p.dataKey === item.key);
                    return (
                        <li key={item.key} className="flex items-center gap-2 text-slate-600">
                            <span
                                className="h-2 w-2 rounded-sm"
                                style={{ background: SERIES_COLORS[index] }}
                                aria-hidden="true"
                            />
                            <span>{item.label}</span>
                            <span className="ml-auto pl-4 font-medium tabular-nums text-slate-900">
                                {valueFormatter ? valueFormatter(entry?.value ?? 0) : entry?.value ?? 0}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function ChartLegend({ series }) {
    return (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            {series.map((item, index) => (
                <li key={item.key} className="flex items-center gap-1.5">
                    <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: SERIES_COLORS[index] }}
                        aria-hidden="true"
                    />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

/**
 * Gráfico de barras agrupadas (até 2 séries) com estados de carregamento,
 * erro e vazio, e uma tabela equivalente para leitores de ecrã.
 */
export default function BarSeriesChart({
    data = [],
    xKey,
    series,
    loading = false,
    error = '',
    emptyText = 'Sem dados para mostrar.',
    caption,
    expanded = false,
    valueFormatter,
    tickFormatter,
}) {
    const heightClass = expanded ? 'h-[min(65vh,34rem)]' : 'h-60';

    if (loading) {
        return (
            <div className={`${heightClass} flex items-end gap-3 px-2 pb-6`} aria-busy="true">
                {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                    <div
                        key={i}
                        className="flex-1 animate-pulse rounded-t bg-slate-100"
                        style={{ height: `${h}%` }}
                    />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${heightClass} flex items-center justify-center`}>
                <p className="text-sm text-rose-600">{error}</p>
            </div>
        );
    }

    const hasValues = data.some((row) =>
        series.some((item) => Number(row[item.key]) > 0)
    );

    if (!hasValues) {
        return (
            <div
                className={`${heightClass} flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-center`}
            >
                <p className="text-sm font-medium text-slate-600">Sem atividade</p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">{emptyText}</p>
            </div>
        );
    }

    return (
        <>
            <div className="mb-3">
                <ChartLegend series={series} />
            </div>
            <div className={heightClass}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        barGap={2}
                        barCategoryGap="28%"
                        margin={{ top: 8, right: 4, bottom: 0, left: -20 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--chart-grid)"
                            strokeWidth={1}
                        />
                        <XAxis
                            dataKey={xKey}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={8}
                            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        />
                        <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                            width={tickFormatter ? 64 : 48}
                            tickFormatter={tickFormatter}
                            tick={{
                                fill: 'var(--chart-axis)',
                                fontSize: 12,
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgb(148 163 184 / 0.12)' }}
                            content={<ChartTooltip series={series} valueFormatter={valueFormatter} />}
                        />
                        {series.map((item, index) => (
                            <Bar
                                key={item.key}
                                dataKey={item.key}
                                name={item.label}
                                fill={SERIES_COLORS[index]}
                                maxBarSize={24}
                                radius={[4, 4, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <table className="sr-only">
                {caption ? <caption>{caption}</caption> : null}
                <thead>
                    <tr>
                        <th scope="col">{xKey}</th>
                        {series.map((item) => (
                            <th key={item.key} scope="col">
                                {item.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row[xKey]}>
                            <th scope="row">{row[xKey]}</th>
                            {series.map((item) => (
                                <td key={item.key}>{valueFormatter ? valueFormatter(row[item.key] ?? 0) : row[item.key] ?? 0}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
