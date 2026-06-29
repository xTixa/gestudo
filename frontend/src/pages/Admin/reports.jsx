import { useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    Download,
    FileText,
    Loader2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Filter,
    X,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { utils, writeFile } from 'xlsx';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { apiGet } from '../../utils/api';

const REPORTS = [
    { key: 'presencas', label: 'Presenças', description: 'Registo detalhado de presenças por aluno e sessão' },
    { key: 'faltas-por-aluno', label: 'Faltas por Aluno', description: 'Total de faltas acumuladas por cada aluno' },
    { key: 'matriculas', label: 'Matrículas', description: 'Estado das matrículas dos alunos', filter: { key: 'estado', label: 'Estado', options: ['', 'ativa', 'expirada'] } },
    { key: 'catalogo-servicos', label: 'Catálogo de Serviços', description: 'Todos os serviços curriculares e extra-curriculares' },
    { key: 'ocupacao-salas', label: 'Ocupação de Salas', description: 'Taxa de utilização das salas por serviço ativo' },
    { key: 'receita-inscricoes', label: 'Receita de Inscrições', description: 'Volume de receita das inscrições por mês' },
    { key: 'reagendamentos-pedidos', label: 'Reagendamentos', description: 'Pedidos de reagendamento submetidos pelos professores', filter: { key: 'estado', label: 'Estado', options: ['', 'pendente', 'aprovado', 'rejeitado'] } },
    { key: 'servicos-extracurriculares', label: 'Serviços Extra-Curriculares', description: 'Resumo dos serviços extra-curriculares' },
    { key: 'utilizadores', label: 'Utilizadores', description: 'Todos os utilizadores do sistema', filter: { key: 'role', label: 'Perfil', options: ['', 'aluno', 'professor', 'gestor'] } },
    { key: 'agenda-gestor', label: 'Agenda', description: 'Todas as sessões agendadas no sistema' },
];

const PAGE_SIZE = 50;

function formatCellValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        return new Date(str).toLocaleDateString('pt-PT');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return new Date(`${str}T00:00:00`).toLocaleDateString('pt-PT');
    }
    return str;
}

function formatColumnLabel(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function exportToPDF(reportLabel, columns, rows) {
    const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
    doc.setFontSize(14);
    doc.text(`Relatório: ${reportLabel}`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-PT')}`, 14, 22);

    autoTable(doc, {
        startY: 28,
        head: [columns.map(formatColumnLabel)],
        body: rows.map((row) => columns.map((col) => formatCellValue(row[col]))),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 102, 204], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`relatorio-${reportLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function exportToExcel(reportLabel, columns, rows) {
    const data = [
        columns.map(formatColumnLabel),
        ...rows.map((row) => columns.map((col) => formatCellValue(row[col]))),
    ];
    const ws = utils.aoa_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Relatório');
    writeFile(wb, `relatorio-${reportLabel.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
}

export default function ReportsPage() {
    const [selectedKey, setSelectedKey] = useState(REPORTS[0].key);
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filterValue, setFilterValue] = useState('');
    const [allRows, setAllRows] = useState([]);
    const [loadingAll, setLoadingAll] = useState(false);

    const selectedReport = REPORTS.find((r) => r.key === selectedKey) || REPORTS[0];
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const columns = useMemo(() => {
        if (!items.length) return [];
        const keys = Object.keys(items[0]);
        return keys.filter((k) => !['id_presenca', 'id_inscricao'].includes(k));
    }, [items]);

    useEffect(() => {
        setPage(1);
        setFilterValue('');
        setAllRows([]);
    }, [selectedKey]);

    useEffect(() => {
        let isMounted = true;
        async function loadReport() {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(PAGE_SIZE),
                });
                if (filterValue && selectedReport.filter) {
                    params.set(selectedReport.filter.key, filterValue);
                }
                const response = await apiGet(`/api/gestor/relatorios/${selectedKey}?${params}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao carregar relatório.');
                if (isMounted) {
                    setItems(Array.isArray(data.items) ? data.items : []);
                    setTotal(Number(data.total || 0));
                }
            } catch (err) {
                if (isMounted) setError(err.message || 'Erro ao carregar relatório.');
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        loadReport();
        return () => { isMounted = false; };
    }, [selectedKey, page, filterValue, selectedReport.filter]);

    async function loadAllForExport() {
        setLoadingAll(true);
        try {
            const params = new URLSearchParams({ page: '1', limit: '500' });
            if (filterValue && selectedReport.filter) params.set(selectedReport.filter.key, filterValue);
            const response = await apiGet(`/api/gestor/relatorios/${selectedKey}?${params}`);
            const data = await response.json();
            return Array.isArray(data.items) ? data.items : [];
        } finally {
            setLoadingAll(false);
        }
    }

    async function handleExportPDF() {
        const rows = await loadAllForExport();
        if (!rows.length) return;
        const cols = Object.keys(rows[0]).filter((k) => !['id_presenca', 'id_inscricao'].includes(k));
        exportToPDF(selectedReport.label, cols, rows);
    }

    async function handleExportExcel() {
        const rows = await loadAllForExport();
        if (!rows.length) return;
        const cols = Object.keys(rows[0]).filter((k) => !['id_presenca', 'id_inscricao'].includes(k));
        exportToExcel(selectedReport.label, cols, rows);
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Relatórios"
                title="Relatórios do Sistema"
                subtitle="Consulte e exporte dados do sistema em PDF ou Excel."
                icon={BarChart3}
            />

            <div className="flex flex-col lg:flex-row gap-5">
                {/* Sidebar */}
                <aside className="w-full lg:w-64 flex-shrink-0">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipos de Relatório</p>
                        </div>
                        <nav className="py-1">
                            {REPORTS.map((r) => (
                                <button
                                    key={r.key}
                                    type="button"
                                    onClick={() => setSelectedKey(r.key)}
                                    className={`w-full text-left px-4 py-3 text-sm font-medium transition ${
                                        selectedKey === r.key
                                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Toolbar */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">{selectedReport.label}</h2>
                                <p className="text-sm text-slate-500 mt-0.5">{selectedReport.description}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {selectedReport.filter && (
                                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 bg-white">
                                        <Filter size={14} className="text-slate-400" />
                                        <select
                                            value={filterValue}
                                            onChange={(e) => { setFilterValue(e.target.value); setPage(1); }}
                                            className="text-sm text-slate-700 outline-none bg-transparent"
                                        >
                                            {selectedReport.filter.options.map((opt) => (
                                                <option key={opt} value={opt}>{opt || `Todos (${selectedReport.filter.label})`}</option>
                                            ))}
                                        </select>
                                        {filterValue && (
                                            <button onClick={() => { setFilterValue(''); setPage(1); }}>
                                                <X size={13} className="text-slate-400 hover:text-slate-600" />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <button
                                    onClick={handleExportExcel}
                                    disabled={loadingAll || !items.length}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition"
                                >
                                    <Download size={14} /> Excel
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={loadingAll || !items.length}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 transition"
                                >
                                    <FileText size={14} /> PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 size={28} className="animate-spin text-blue-500 mr-3" />
                                <span className="text-sm text-slate-500">A carregar...</span>
                            </div>
                        ) : error ? (
                            <div className="flex items-start gap-3 p-6 text-rose-700">
                                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : !items.length ? (
                            <div className="py-16 text-center">
                                <FileText size={32} className="mx-auto mb-3 text-slate-200" />
                                <p className="text-sm text-slate-400">Sem dados para este relatório</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            {columns.map((col) => (
                                                <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                                    {formatColumnLabel(col)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition">
                                                {columns.map((col) => (
                                                    <td key={col} className="px-4 py-3 text-slate-700 whitespace-nowrap max-w-[240px] truncate">
                                                        {formatCellValue(row[col])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {total > PAGE_SIZE && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                                <p className="text-xs text-slate-500">
                                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} registos
                                </p>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="px-3 text-xs font-medium text-slate-700">{page} / {totalPages}</span>
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
