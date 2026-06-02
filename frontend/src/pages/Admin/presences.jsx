import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    FileText,
    RefreshCw,
    Search,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { apiGet } from '../../utils/api';

const MIN_ATTENDANCE_COLUMNS = 8;
const MONTH_NAMES = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
];

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatHours(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatHoursLabel(value) {
    const number = Number(value || 0);
    if (number === 0) return '';
    return `${formatHours(number)}h`;
}

function formatDifference(value) {
    const number = Number(value || 0);
    if (Math.abs(number) < 0.01) return '-';
    return `${number > 0 ? '+' : ''}${formatHours(number)}h`;
}

function formatDayMonth(value) {
    if (!value) return '';
    const [, month, day] = String(value).split('-');
    return `${Number(day)}/${Number(month)}`;
}

function formatAno(value) {
    const raw = String(value || '').trim();
    return raw ? `${raw}º` : '';
}

function formatMonthTitle(monthValue) {
    const [year, month] = String(monthValue || getCurrentMonth())
        .split('-')
        .map(Number);
    const monthName = MONTH_NAMES[month - 1] || '';
    return `${monthName} ${year}`;
}

function buildAttendanceColumns(rows) {
    const maxPresencas = rows.reduce(
        (max, aluno) => Math.max(max, aluno.presencas?.length || 0),
        0
    );
    return Math.max(MIN_ATTENDANCE_COLUMNS, maxPresencas);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[^\S\r\n]+/g, ' ').trim();
}

function pdfNumber(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function pdfText(value) {
    const text = escapeHtml(value);
    let hex = 'FEFF';

    for (let index = 0; index < text.length; index += 1) {
        hex += text.charCodeAt(index).toString(16).padStart(4, '0');
    }

    return `<${hex}>`;
}

function estimateTextWidth(text, size) {
    return String(text || '').length * size * 0.48;
}

function createPresencasPdfBlob({
    title,
    rows,
    attendanceColumnCount,
    filename,
}) {
    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const margin = 24;
    const titleHeight = 24;
    const headerHeight = 24;
    const rowHeight = 25;
    const top = margin;
    const tableTop = top + titleHeight;
    const bodyTop = tableTop + headerHeight;
    const rowsPerPage = Math.max(
        1,
        Math.floor((pageHeight - bodyTop - margin) / rowHeight)
    );

    const yearWidth = 34;
    const nameWidth = 118;
    const hoursWidth = 44;
    const totalWidth = 62;
    const differenceWidth = 74;
    const fixedWidth =
        yearWidth + nameWidth + hoursWidth + totalWidth + differenceWidth;
    const availableWidth = pageWidth - margin * 2 - fixedWidth;
    const attendanceWidth = Math.max(
        30,
        availableWidth / Math.max(1, attendanceColumnCount)
    );
    const tableWidth = fixedWidth + attendanceWidth * attendanceColumnCount;

    function drawText(commands, text, x, yFromTop, size = 9, align = 'left') {
        let nextX = x;
        if (align === 'center') {
            nextX = x - estimateTextWidth(text, size) / 2;
        } else if (align === 'right') {
            nextX = x - estimateTextWidth(text, size);
        }

        commands.push(
            `BT /F1 ${pdfNumber(size)} Tf ${pdfNumber(nextX)} ${pdfNumber(
                pageHeight - yFromTop
            )} Td ${pdfText(text)} Tj ET`
        );
    }

    function drawCell(commands, x, y, width, height, fill = null) {
        if (fill) {
            commands.push(
                `${fill} rg ${pdfNumber(x)} ${pdfNumber(
                    pageHeight - y - height
                )} ${pdfNumber(width)} ${pdfNumber(height)} re f 0 g`
            );
        }

        commands.push(
            `${pdfNumber(x)} ${pdfNumber(pageHeight - y - height)} ${pdfNumber(
                width
            )} ${pdfNumber(height)} re S`
        );
    }

    function drawHeader(commands, pageIndex) {
        drawCell(commands, margin, top, tableWidth, titleHeight, null);
        drawText(
            commands,
            pageIndex === 0 ? title : `${title} (continuação)`,
            margin + tableWidth / 2,
            top + 15,
            12,
            'center'
        );

        let x = margin;
        [yearWidth, nameWidth, hoursWidth].forEach((width) => {
            drawCell(commands, x, tableTop, width, headerHeight, '0.93 0.94 0.96');
            x += width;
        });

        for (let index = 0; index < attendanceColumnCount; index += 1) {
            drawCell(commands, x, tableTop, attendanceWidth, headerHeight, null);
            x += attendanceWidth;
        }

        [
            ['TOTAL', totalWidth],
            ['DIFERENCA', differenceWidth],
        ].forEach(([label, width]) => {
            drawCell(commands, x, tableTop, width, headerHeight, '0.93 0.94 0.96');
            drawText(
                commands,
                label,
                x + width / 2,
                tableTop + 15,
                8,
                'center'
            );
            x += width;
        });
    }

    function buildPage(pageRows, pageIndex) {
        const commands = ['0.2 w'];
        drawHeader(commands, pageIndex);

        pageRows.forEach((aluno, rowIndex) => {
            const y = bodyTop + rowIndex * rowHeight;
            let x = margin;

            [
                [formatAno(aluno.ano), yearWidth, 'center'],
                [aluno.nome, nameWidth, 'left'],
                [formatHoursLabel(aluno.horas_subscritas), hoursWidth, 'center'],
            ].forEach(([label, width, align]) => {
                drawCell(commands, x, y, width, rowHeight, '0.96 0.97 0.98');
                drawText(
                    commands,
                    label,
                    align === 'left' ? x + 4 : x + width / 2,
                    y + 16,
                    8,
                    align
                );
                x += width;
            });

            for (let index = 0; index < attendanceColumnCount; index += 1) {
                const presenca = aluno.presencas?.[index];
                drawCell(commands, x, y, attendanceWidth, rowHeight, null);

                if (presenca) {
                    drawText(
                        commands,
                        formatDayMonth(presenca.data),
                        x + attendanceWidth / 2,
                        y + 10,
                        8,
                        'center'
                    );
                    drawText(
                        commands,
                        formatHoursLabel(presenca.horas),
                        x + attendanceWidth / 2,
                        y + 20,
                        8,
                        'center'
                    );
                }

                x += attendanceWidth;
            }

            [
                [formatHoursLabel(aluno.total_horas_feitas), totalWidth],
                [formatDifference(aluno.diferenca), differenceWidth],
            ].forEach(([label, width]) => {
                drawCell(commands, x, y, width, rowHeight, null);
                drawText(commands, label, x + width / 2, y + 16, 10, 'center');
                x += width;
            });
        });

        return commands.join('\n');
    }

    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    const pageIds = [];

    for (let index = 0; index < rows.length; index += rowsPerPage) {
        const pageRows = rows.slice(index, index + rowsPerPage);
        const stream = buildPage(pageRows, pageIds.length);
        const contentId = objects.length + 1;
        objects.push(
            `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
        );

        const pageId = objects.length + 1;
        pageIds.push(pageId);
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
        );
    }

    objects[1] =
        `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new File([pdf], filename, { type: 'application/pdf' });
}

export default function PresencasGestorPage() {
    const [month, setMonth] = useState(getCurrentMonth);
    const [search, setSearch] = useState('');
    const [report, setReport] = useState({
        alunos: [],
        month: getCurrentMonth(),
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadReport = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const response = await apiGet(
                `/api/gestor/presencas?month=${encodeURIComponent(month)}`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao carregar presenças.');
            }

            setReport({
                alunos: Array.isArray(data?.alunos) ? data.alunos : [],
                month: data?.month || month,
                startDate: data?.startDate,
                endDate: data?.endDate,
            });
        } catch (err) {
            setError(err?.message || 'Erro ao carregar presenças.');
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const filteredRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return report.alunos;

        return report.alunos.filter((aluno) =>
            `${aluno?.ano || ''} ${aluno?.nome || ''}`
                .toLowerCase()
                .includes(term)
        );
    }, [report.alunos, search]);

    const attendanceColumnCount = useMemo(
        () => buildAttendanceColumns(filteredRows),
        [filteredRows]
    );

    const summary = useMemo(() => {
        return report.alunos.reduce(
            (acc, aluno) => {
                acc.subscritas += Number(aluno.horas_subscritas || 0);
                acc.feitas += Number(aluno.total_horas_feitas || 0);
                return acc;
            },
            { subscritas: 0, feitas: 0 }
        );
    }, [report.alunos]);

    function exportToPdf() {
        const filename = `presencas-${report.month || month}.pdf`;
        const file = createPresencasPdfBlob({
            title: formatMonthTitle(report.month || month),
            rows: filteredRows,
            attendanceColumnCount,
            filename,
        });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    const hasRows = filteredRows.length > 0;

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Presenças"
                title="Mapa mensal"
                subtitle="Modelo mensal com ano, aluno, horas subscritas, registos por aula, total e diferença."
                icon={CalendarDays}
                actions={
                    <>
                        <button
                            type="button"
                            onClick={loadReport}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <RefreshCw
                                size={16}
                                className={loading ? 'animate-spin' : ''}
                            />
                            Atualizar
                        </button>
                        <button
                            type="button"
                            onClick={exportToPdf}
                            disabled={!hasRows}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FileText size={16} />
                            PDF
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="text-xs font-medium text-slate-500">
                        Mês
                    </label>
                    <input
                        type="month"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                    <label className="text-xs font-medium text-slate-500">
                        Pesquisar
                    </label>
                    <div className="relative mt-1">
                        <Search
                            size={16}
                            className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Ano ou nome do aluno"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium text-slate-500">
                            Subscritas
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-slate-800">
                            {formatHoursLabel(summary.subscritas) || '0h'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium text-slate-500">
                            Feitas
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-slate-800">
                            {formatHoursLabel(summary.feitas) || '0h'}
                        </p>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {loading ? (
                    <p className="p-6 text-sm text-slate-500">
                        A carregar presenças...
                    </p>
                ) : !hasRows ? (
                    <p className="p-6 text-sm text-slate-500">
                        Sem presenças para o mês selecionado.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-max">
                            <div className="border-x border-t border-slate-900 py-3 text-center text-sm font-semibold text-slate-900">
                                {formatMonthTitle(report.month || month)}
                            </div>
                            <table className="border-collapse text-sm text-slate-900">
                                <thead>
                                    <tr>
                                        <th className="w-14 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                        </th>
                                        <th className="w-44 border border-slate-900 bg-slate-100 px-2 py-2 text-left font-semibold">
                                        </th>
                                        <th className="w-16 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                        </th>
                                        {Array.from({
                                            length: attendanceColumnCount,
                                        }).map((_, index) => (
                                            <th
                                                key={`slot-head-${index}`}
                                                className="h-9 w-20 border border-slate-900 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-700"
                                            />
                                        ))}
                                        <th className="w-24 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                            TOTAL
                                        </th>
                                        <th className="w-28 border border-slate-900 bg-slate-100 px-2 py-2 text-center font-semibold">
                                            DIFERENÇA
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((aluno) => (
                                        <tr key={aluno.id_aluno}>
                                            <td className="border border-slate-900 bg-slate-100 px-2 py-3 text-center font-semibold">
                                                {formatAno(aluno.ano)}
                                            </td>
                                            <td className="border border-slate-900 bg-slate-100 px-3 py-3 font-medium">
                                                {aluno.nome}
                                            </td>
                                            <td className="border border-slate-900 bg-slate-100 px-2 py-3 text-center font-semibold">
                                                {formatHoursLabel(
                                                    aluno.horas_subscritas
                                                )}
                                            </td>
                                            {Array.from({
                                                length: attendanceColumnCount,
                                            }).map((_, index) => {
                                                const presenca =
                                                    aluno.presencas?.[index];
                                                return (
                                                    <td
                                                        key={`${aluno.id_aluno}-${index}`}
                                                        className="h-14 border border-slate-900 bg-white px-2 py-1 text-center align-middle"
                                                    >
                                                        {presenca ? (
                                                            <span className="inline-flex flex-col leading-tight">
                                                                <span>
                                                                    {formatDayMonth(
                                                                        presenca.data
                                                                    )}
                                                                </span>
                                                                <span>
                                                                    {formatHoursLabel(
                                                                        presenca.horas
                                                                    )}
                                                                </span>
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                );
                                            })}
                                            <td className="border border-slate-900 bg-white px-2 py-3 text-center text-base font-semibold">
                                                {formatHoursLabel(
                                                    aluno.total_horas_feitas
                                                )}
                                            </td>
                                            <td className="border border-slate-900 bg-white px-2 py-3 text-center text-base font-semibold">
                                                {formatDifference(
                                                    aluno.diferenca
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
