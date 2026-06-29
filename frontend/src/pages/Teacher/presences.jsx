import { useEffect, useMemo, useState, useRef } from 'react';
import {
    AlertCircle,
    Calendar,
    Check,
    CheckCircle2,
    Clock3,
    Edit3,
    Loader2,
    Save,
    X,
    Users,
    Search,
    UserPlus,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    CalendarDays,
    Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiGet, apiPost } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_STYLES = {
    presente: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    falta: 'border-rose-300 bg-rose-50 text-rose-700',
    reposta: 'border-blue-300 bg-blue-50 text-blue-700',
    justificada: 'border-amber-300 bg-amber-50 text-amber-700',
    pendente: 'border-slate-300 bg-slate-100 text-slate-700',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
}

function formatDateLabel(value) {
    if (!value) return '--';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatServiceDay(value) {
    if (!value) return '--';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' });
}

function formatTimeRange(service) {
    const start = String(service?.horaInicio || '').slice(0, 5);
    const end = String(service?.horaFim || '').slice(0, 5);
    if (start && end) return `${start} - ${end}`;
    return start || end || '--:--';
}

function buildStudentKey(student) {
    return String(student?._tempId || student?.id_aluno || '');
}

function isServiceToday(service) {
    const today = todayIso();
    const start = String(service?.dataAula || service?.dataInicio || '').slice(
        0,
        10
    );
    const end = String(service?.dataFim || start).slice(0, 10);
    if (!start) return false;
    return today >= start && today <= end;
}

function isServiceBeforeToday(service) {
    const today = todayIso();
    const date = String(service?.dataAula || service?.dataInicio || '').slice(
        0,
        10
    );
    return Boolean(date && date < today);
}

function getServiceDisplayDate(service) {
    return (
        String(service?.dataAula || service?.dataInicio || '').slice(0, 10) ||
        todayIso()
    );
}

function normalizeStudent(student) {
    return {
        id_aluno: student.id_aluno ?? null,
        _tempId: student._tempId || null,
        _extra: student._extra || false,
        nome: String(student.nome || 'Aluno').trim(),
        ano: String(student.ano || '').trim(),
        turma: String(student.turma || '').trim(),
        estado: student.estado || 'presente',
        observacao: String(student.observacao || '').trim(),
        data_reposicao: String(
            student.data_reposicao || student.replacementDate || ''
        )
            .trim()
            .slice(0, 10),
    };
}

// ---------------------------------------------------------------------------
// Confirmation Dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({ isOpen, stats, onConfirm, onCancel, saving }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Save size={20} className="text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                        Confirmar registo de presenças
                    </h3>
                </div>

                <p className="text-sm text-slate-600">
                    Tens a certeza que queres guardar o seguinte registo?
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                            Total
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                            {stats.total}
                        </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                        <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">
                            Presentes
                        </p>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">
                            {stats.presentes}
                        </p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
                        <p className="text-xs text-rose-600 font-semibold uppercase tracking-wide">
                            Faltas
                        </p>
                        <p className="text-2xl font-bold text-rose-700 mt-1">
                            {stats.faltas}
                        </p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                            Repostas
                        </p>
                        <p className="text-2xl font-bold text-blue-700 mt-1">
                            {stats.repostas}
                        </p>
                    </div>
                </div>

                {stats.extras > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Inclui {stats.extras} aluno{stats.extras > 1 ? 's' : ''}{' '}
                        extra{stats.extras > 1 ? 's' : ''} não inscritos na
                        sessão.
                    </p>
                )}

                <div className="flex gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95"
                    >
                        Rever
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 transition active:scale-95"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={15} className="animate-spin" /> A
                                guardar...
                            </>
                        ) : (
                            <>
                                <Check size={15} /> Confirmar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Add Extra Student Panel
// ---------------------------------------------------------------------------

function AddExtraStudentPanel({ allStudents, enrolledIds, onAdd, onClose }) {
    const [tab, setTab] = useState('search');
    const [query, setQuery] = useState('');
    const [manualNome, setManualNome] = useState('');
    const [manualNumero, setManualNumero] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, [tab]);

    const filteredGlobal = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return (allStudents || [])
            .filter(
                (s) =>
                    !enrolledIds.has(String(s.id_aluno)) &&
                    (s.nome?.toLowerCase().includes(q) ||
                        String(s.id_aluno).includes(q))
            )
            .slice(0, 8);
    }, [query, allStudents, enrolledIds]);

    function handleAddFromList(student) {
        onAdd(
            normalizeStudent({ ...student, estado: 'presente', _extra: true })
        );
    }

    function handleAddManual() {
        if (!manualNome.trim()) return;
        const tempId = `extra_${Date.now()}`;
        onAdd(
            normalizeStudent({
                id_aluno: manualNumero.trim()
                    ? Number(manualNumero.trim())
                    : null,
                _tempId: tempId,
                nome: manualNome.trim(),
                estado: 'presente',
                _extra: true,
            })
        );
    }

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-blue-800">
                    Adicionar aluno extra
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-blue-400 hover:text-blue-700 transition"
                >
                    <X size={17} />
                </button>
            </div>

            <div className="flex rounded-lg border border-blue-200 overflow-hidden text-xs font-semibold">
                <button
                    type="button"
                    onClick={() => setTab('search')}
                    className={`flex-1 py-2 transition ${tab === 'search' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
                >
                    Pesquisar aluno
                </button>
                <button
                    type="button"
                    onClick={() => setTab('manual')}
                    className={`flex-1 py-2 transition ${tab === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
                >
                    Inserir manualmente
                </button>
            </div>

            {tab === 'search' ? (
                <div className="space-y-2">
                    <div className="relative">
                        <Search
                            size={13}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Nome ou nº do aluno..."
                            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                    {query.trim() && (
                        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                            {filteredGlobal.length ? (
                                filteredGlobal.map((s) => (
                                    <button
                                        key={s.id_aluno}
                                        type="button"
                                        onClick={() => handleAddFromList(s)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition"
                                    >
                                        <p className="text-sm font-medium text-slate-900">
                                            {s.nome}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Nº {s.id_aluno}
                                            {s.ano ? ` · ${s.ano}º` : ''}
                                            {s.turma ? ` Turma ${s.turma}` : ''}
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <p className="px-3 py-3 text-xs text-slate-400 text-center">
                                    Nenhum aluno encontrado
                                </p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={manualNome}
                        onChange={(e) => setManualNome(e.target.value)}
                        placeholder="Nome completo *"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <input
                        type="text"
                        value={manualNumero}
                        onChange={(e) => setManualNumero(e.target.value)}
                        placeholder="Nº de aluno (opcional)"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="button"
                        onClick={handleAddManual}
                        disabled={!manualNome.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 transition active:scale-95"
                    >
                        <UserPlus size={14} /> Adicionar
                    </button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Student Row
// ---------------------------------------------------------------------------

function StudentRow({
    student,
    onStatusChange,
    onObservacaoChange,
    onReplacementDateChange,
}) {
    const [expanded, setExpanded] = useState(false);
    const key = buildStudentKey(student);
    const estado = String(student.estado || 'presente').toLowerCase();
    const isPresent = estado === 'presente';
    const isAbsent = estado === 'falta';
    const isReplacement = estado === 'reposta';

    return (
        <div
            className={`rounded-lg border bg-white transition ${
                student._extra
                    ? 'border-amber-200 ring-1 ring-amber-100'
                    : 'border-slate-200'
            }`}
        >
            <div className="flex items-center justify-between p-3.5">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                            {student.nome}
                        </p>
                        {student._extra && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                                EXTRA
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {student.id_aluno ? `Nº ${student.id_aluno}` : ''}
                        {student.ano ? ` · ${student.ano}º` : ''}
                        {student.turma ? ` Turma ${student.turma}` : ''}
                    </p>
                </div>

                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => onStatusChange(key, 'presente')}
                        title="Presente"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                            isPresent
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : 'bg-slate-100 text-slate-500 border border-transparent hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                    >
                        <CheckCircle2 size={13} /> P
                    </button>
                    <button
                        type="button"
                        onClick={() => onStatusChange(key, 'falta')}
                        title="Falta"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                            isAbsent
                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                : 'bg-slate-100 text-slate-500 border border-transparent hover:bg-rose-50 hover:text-rose-600'
                        }`}
                    >
                        <X size={13} /> F
                    </button>
                    <button
                        type="button"
                        onClick={() => onStatusChange(key, 'reposta')}
                        title="Reposta"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                            isReplacement
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-slate-100 text-slate-500 border border-transparent hover:bg-blue-50 hover:text-blue-600'
                        }`}
                    >
                        <CalendarDays size={13} /> R
                    </button>
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        title="Observação"
                        className={`inline-flex items-center rounded-full p-1.5 transition ${
                            student.observacao
                                ? 'bg-blue-100 text-blue-600 border border-blue-200'
                                : 'bg-slate-100 text-slate-400 border border-transparent hover:bg-slate-200'
                        }`}
                    >
                        <MessageSquare size={13} />
                    </button>
                </div>
            </div>

            {isReplacement && (
                <div className="border-t border-blue-100 px-3.5 py-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-blue-700">
                            Data de reposição
                        </span>
                        <input
                            type="date"
                            value={student.data_reposicao || ''}
                            onChange={(e) =>
                                onReplacementDateChange(key, e.target.value)
                            }
                            className="h-10 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                </div>
            )}

            {expanded && (
                <div className="px-3.5 pb-3.5">
                    <textarea
                        value={student.observacao}
                        onChange={(e) =>
                            onObservacaoChange(key, e.target.value)
                        }
                        placeholder="Observação sobre este aluno..."
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none"
                    />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Attendance Modal
// ---------------------------------------------------------------------------

function AttendanceModal({
    isOpen,
    onClose,
    onSave,
    service,
    selectedDate,
    students,
    onStudentChange,
    onObservacaoChange,
    onReplacementDateChange,
    onMarkAll,
    onAddExtra,
    allStudents,
    stats,
    saving,
    loading,
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    function handleExportPDF() {
        const doc = new jsPDF();
        const titulo = service?.disciplina || service?.titulo || 'Aula';
        const sala = service?.sala || '';
        const hora = `${String(service?.hora_inicio || service?.horaInicio || '').slice(0, 5)} - ${String(service?.hora_fim || service?.horaFim || '').slice(0, 5)}`;
        const dataLabel = selectedDate
            ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
            : '';

        doc.setFontSize(16);
        doc.text('Folha de Presenças', 14, 16);
        doc.setFontSize(11);
        doc.text(`Serviço: ${titulo}`, 14, 26);
        doc.text(`Data: ${dataLabel}`, 14, 32);
        if (hora.trim() !== '-') doc.text(`Horário: ${hora}`, 14, 38);
        if (sala) doc.text(`Sala: ${sala}`, 14, 44);

        const statusLabel = { presente: 'Presente', falta: 'Falta', reposta: 'Reposição', justificada: 'Justificada', pendente: 'Pendente' };

        autoTable(doc, {
            startY: 52,
            head: [['Nº', 'Nome', 'Ano', 'Turma', 'Estado', 'Observação']],
            body: students.map((s) => [
                s.id_aluno ? String(s.id_aluno) : (s._extra ? 'EXTRA' : '-'),
                s.nome || '-',
                s.ano ? `${s.ano}º` : '-',
                s.turma || '-',
                statusLabel[String(s.estado || 'presente').toLowerCase()] || s.estado || '-',
                s.observacao || '',
            ]),
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            columnStyles: { 5: { cellWidth: 'auto' } },
        });

        const fileName = `presencas-${titulo.toLowerCase().replace(/\s+/g, '-')}-${selectedDate || 'sem-data'}.pdf`;
        doc.save(fileName);
    }

    const enrolledIds = useMemo(
        () => new Set(students.map((s) => String(s.id_aluno ?? s._tempId))),
        [students]
    );

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.nome?.toLowerCase().includes(q) ||
                String(s.id_aluno || '').includes(q)
        );
    }, [students, searchQuery]);

    if (!isOpen) return null;

    return (
        <>
            <ConfirmDialog
                isOpen={showConfirm}
                stats={stats}
                onConfirm={() => {
                    onSave();
                    setShowConfirm(false);
                }}
                onCancel={() => setShowConfirm(false)}
                saving={saving}
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-start justify-between z-10">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-900">
                                Marcar Presença
                            </h2>
                            {service && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                                        {service.disciplina || 'Serviço'}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                                        <Clock3 size={12} />
                                        {formatTimeRange(service)}
                                    </span>
                                    {service.sala && (
                                        <>
                                            <span className="text-slate-300">
                                                •
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {service.sala}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                            {selectedDate && (
                                <p className="mt-1.5 text-xs text-slate-400 inline-flex items-center gap-1">
                                    <Calendar size={12} />
                                    {formatDateLabel(selectedDate)}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 ml-3"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex min-h-72 items-center justify-center">
                            <div className="text-center">
                                <Loader2
                                    size={28}
                                    className="animate-spin text-blue-500 mx-auto mb-2"
                                />
                                <p className="text-sm text-slate-500">
                                    A carregar alunos...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-5 space-y-5">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        Total
                                    </p>
                                    <p className="mt-1 text-3xl font-bold text-slate-900">
                                        {stats.total}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-emerald-600 font-semibold">
                                        Presentes
                                    </p>
                                    <p className="mt-1 text-3xl font-bold text-emerald-700">
                                        {stats.presentes}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-rose-600 font-semibold">
                                        Faltas
                                    </p>
                                    <p className="mt-1 text-3xl font-bold text-rose-700">
                                        {stats.faltas}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-blue-600 font-semibold">
                                        Repostas
                                    </p>
                                    <p className="mt-1 text-3xl font-bold text-blue-700">
                                        {stats.repostas}
                                    </p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex flex-col sm:flex-row gap-2 pb-4 border-b border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => onMarkAll('presente')}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition active:scale-95"
                                >
                                    <Check size={13} /> Marcar Todos Presentes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddPanel((v) => !v)}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                                        showAddPanel
                                            ? 'border-blue-400 bg-blue-100 text-blue-800'
                                            : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    }`}
                                >
                                    <UserPlus size={13} />
                                    Adicionar Aluno Extra
                                    {showAddPanel ? (
                                        <ChevronUp size={13} />
                                    ) : (
                                        <ChevronDown size={13} />
                                    )}
                                </button>
                            </div>

                            {/* Add extra panel */}
                            {showAddPanel && (
                                <AddExtraStudentPanel
                                    allStudents={allStudents}
                                    enrolledIds={enrolledIds}
                                    onAdd={(student) => {
                                        onAddExtra(student);
                                        setShowAddPanel(false);
                                    }}
                                    onClose={() => setShowAddPanel(false)}
                                />
                            )}

                            {/* Students list */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Users
                                        size={15}
                                        className="text-slate-400"
                                    />
                                    <h3 className="text-sm font-semibold text-slate-700">
                                        Alunos ({students.length})
                                        {stats.extras > 0 && (
                                            <span className="ml-1.5 text-amber-600 font-normal text-xs">
                                                +{stats.extras} extra
                                                {stats.extras > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </h3>
                                </div>

                                {students.length > 5 && (
                                    <div className="relative mb-3">
                                        <Search
                                            size={13}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) =>
                                                setSearchQuery(e.target.value)
                                            }
                                            placeholder="Filtrar alunos..."
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                )}

                                <div className="max-h-80 overflow-y-auto space-y-1.5 pr-0.5">
                                    {filteredStudents.length ? (
                                        filteredStudents.map((student) => (
                                            <StudentRow
                                                key={buildStudentKey(student)}
                                                student={student}
                                                onStatusChange={onStudentChange}
                                                onObservacaoChange={
                                                    onObservacaoChange
                                                }
                                                onReplacementDateChange={
                                                    onReplacementDateChange
                                                }
                                            />
                                        ))
                                    ) : (
                                        <div className="py-10 text-center">
                                            <Users
                                                size={26}
                                                className="mx-auto mb-2 text-slate-300"
                                            />
                                            <p className="text-xs text-slate-400">
                                                {searchQuery
                                                    ? 'Nenhum aluno corresponde à pesquisa'
                                                    : 'Sem alunos inscritos'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportPDF}
                                    disabled={!students.length}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition active:scale-95"
                                >
                                    <Download size={14} /> Exportar PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(true)}
                                    disabled={saving || !students.length}
                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition active:scale-95"
                                >
                                    <Save size={15} /> Guardar Presenças
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Service Card
// ---------------------------------------------------------------------------

function ServiceCard({ service, isActive, isMarked, onOpen }) {
    return (
        <div
            className={`rounded-2xl border bg-white p-5 shadow-sm transition cursor-pointer ${
                isActive
                    ? 'border-blue-400 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
            onClick={onOpen}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <p className="text-base font-semibold text-slate-900">
                        {service.titulo}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {service.disciplina || 'Serviço'} •{' '}
                        {service.sala || 'Sala'}
                    </p>
                </div>
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                        isMarked
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border border-amber-300 bg-amber-50 text-amber-700'
                    }`}
                >
                    {isMarked ? (
                        <>
                            <CheckCircle2 size={12} /> Marcada
                        </>
                    ) : (
                        <>
                            <AlertCircle size={12} /> Pendente
                        </>
                    )}
                </span>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-slate-500">
                <p className="inline-flex items-center gap-1.5">
                    <Calendar size={13} />{' '}
                    {formatServiceDay(service.dataInicio)}
                </p>
                <p className="inline-flex items-center gap-1.5">
                    <Clock3 size={13} /> {formatTimeRange(service)}
                </p>
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-100 px-3 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-200 transition active:scale-95"
            >
                <Edit3 size={13} />
                {isMarked ? 'Ver/Editar Presença' : 'Marcar Presença'}
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PresencasProfessorPage() {
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedSessionKey, setSelectedSessionKey] = useState('');
    const [selectedDate, setSelectedDate] = useState(todayIso());
    const [serviceDetail, setServiceDetail] = useState(null);
    const [savedAttendanceMap, setSavedAttendanceMap] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [allStudents, setAllStudents] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [historicoServiceId, setHistoricoServiceId] = useState('');
    const [historico, setHistorico] = useState(null);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function loadServices() {
            setLoadingServices(true);
            setError('');
            try {
                const response = await apiGet(
                    '/api/professor/presencas/servicos'
                );
                const data = await response.json();
                if (!response.ok)
                    throw new Error(
                        data.message || 'Erro ao carregar serviços.'
                    );
                if (!isMounted) return;
                setServices(Array.isArray(data.servicos) ? data.servicos : []);
            } catch (err) {
                if (isMounted)
                    setError(err.message || 'Erro ao carregar serviços.');
            } finally {
                if (isMounted) setLoadingServices(false);
            }
        }
        loadServices();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        async function loadAllStudents() {
            try {
                const response = await apiGet('/api/professor/alunos');
                const data = await response.json();
                if (response.ok && Array.isArray(data.alunos)) {
                    setAllStudents(data.alunos);
                }
            } catch {
                // silently fail
            }
        }
        loadAllStudents();
    }, []);

    useEffect(() => {
        let isMounted = true;
        async function loadDetail() {
            if (!selectedServiceId) {
                setServiceDetail(null);
                return;
            }
            setLoadingDetail(true);
            setError('');
            setMessage('');
            try {
                const response = await apiGet(
                    `/api/professor/presencas/${selectedServiceId}?data=${selectedDate}`
                );
                const data = await response.json();
                if (!response.ok)
                    throw new Error(
                        data.message || 'Erro ao carregar a aula selecionada.'
                    );
                if (!isMounted) return;
                setServiceDetail({
                    servico: data.servico || null,
                    alunos: Array.isArray(data.alunos)
                        ? data.alunos.map((s) =>
                              normalizeStudent({
                                  ...s,
                                  estado:
                                      String(s.estado || '').toLowerCase() ===
                                      'pendente'
                                          ? 'presente'
                                          : s.estado || 'presente',
                              })
                          )
                        : [],
                });
            } catch (err) {
                if (isMounted)
                    setError(
                        err.message || 'Erro ao carregar a aula selecionada.'
                    );
            } finally {
                if (isMounted) setLoadingDetail(false);
            }
        }
        loadDetail();
        return () => {
            isMounted = false;
        };
    }, [selectedServiceId, selectedDate]);

    useEffect(() => {
        let isMounted = true;
        async function loadHistorico() {
            if (!historicoServiceId) { setHistorico(null); return; }
            setLoadingHistorico(true);
            try {
                const response = await apiGet(`/api/professor/presencas/${historicoServiceId}/historico`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                if (isMounted) setHistorico(data);
            } catch { if (isMounted) setHistorico(null); }
            finally { if (isMounted) setLoadingHistorico(false); }
        }
        loadHistorico();
        return () => { isMounted = false; };
    }, [historicoServiceId]);

    const attendanceRows = useMemo(
        () => serviceDetail?.alunos || [],
        [serviceDetail]
    );

    const todayServices = useMemo(
        () => services.filter(isServiceToday),
        [services]
    );
    const pendingServices = useMemo(
        () => services.filter(isServiceBeforeToday),
        [services]
    );

    const stats = useMemo(() => {
        const base = attendanceRows.reduce(
            (acc, s) => {
                const st = String(s.estado || 'presente').toLowerCase();
                if (st === 'presente') acc.presentes += 1;
                else if (st === 'falta') acc.faltas += 1;
                else if (st === 'reposta') acc.repostas += 1;
                if (s._extra) acc.extras += 1;
                return acc;
            },
            { presentes: 0, faltas: 0, repostas: 0, extras: 0 }
        );
        return { ...base, total: attendanceRows.length };
    }, [attendanceRows]);

    function updateStudent(key, updates) {
        setServiceDetail((cur) => {
            if (!cur) return cur;
            return {
                ...cur,
                alunos: cur.alunos.map((s) =>
                    buildStudentKey(s) === String(key)
                        ? { ...s, ...updates }
                        : s
                ),
            };
        });
    }

    function markAll(status) {
        setServiceDetail((cur) => {
            if (!cur) return cur;
            return {
                ...cur,
                alunos: cur.alunos.map((s) => ({
                    ...s,
                    estado: status,
                    ...(status === 'reposta' ? {} : { data_reposicao: '' }),
                })),
            };
        });
    }

    function addExtraStudent(student) {
        setServiceDetail((cur) => {
            if (!cur) return cur;
            return { ...cur, alunos: [...cur.alunos, student] };
        });
    }

    async function handleSave() {
        if (!selectedServiceId || !serviceDetail?.servico) return;
        const missingReplacementDate = attendanceRows.some(
            (s) =>
                String(s.estado || '').toLowerCase() === 'reposta' &&
                !s.data_reposicao
        );

        if (missingReplacementDate) {
            setError('Indique a data de reposição para todos os alunos marcados como reposta.');
            return;
        }

        setSaving(true);
        setError('');
        setMessage('');
        try {
            const payload = {
                id_servico: Number(selectedServiceId),
                data_aula: selectedDate,
                hora_aula:
                    serviceDetail.servico.hora_inicio ||
                    serviceDetail.servico.horaInicio ||
                    '',
                presencas: attendanceRows.map((s) => ({
                    id_aluno: s.id_aluno,
                    estado: String(s.estado || 'presente').toLowerCase(),
                    observacao: s.observacao || '',
                    data_reposicao: s.data_reposicao || null,
                    extra: s._extra || false,
                })),
            };
            const response = await apiPost('/api/professor/presencas', payload);
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || 'Erro ao guardar presenças.');
            setSavedAttendanceMap((cur) => ({
                ...cur,
                [`${selectedServiceId}:${selectedDate}`]: true,
            }));
            setMessage(data.message || 'Presenças guardadas com sucesso.');
            setTimeout(() => {
                setIsModalOpen(false);
                setSelectedServiceId('');
                setSelectedSessionKey('');
                setServiceDetail(null);
            }, 900);
        } catch (err) {
            setError(err.message || 'Erro ao guardar presenças.');
        } finally {
            setSaving(false);
        }
    }

    function isMarked(service) {
        const date = getServiceDisplayDate(service);
        return Boolean(
            service.marcada || savedAttendanceMap[`${service.id}:${date}`]
        );
    }

    function openService(service) {
        setSelectedServiceId(String(service.id));
        setSelectedSessionKey(
            service.sessionKey ||
                `${service.id}:${getServiceDisplayDate(service)}`
        );
        setSelectedDate(getServiceDisplayDate(service)); // auto-set to dataInicio
        setError('');
        setMessage('');
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setSelectedServiceId('');
        setSelectedSessionKey('');
        setServiceDetail(null);
    }

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Presenças"
                title="Marcações de Presença"
                subtitle="Gerencie as presenças dos seus alunos de forma rápida e fácil."
                icon={CalendarDays}
            />

            {error && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-800 flex items-start gap-3">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {message && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 flex items-start gap-3">
                    <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{message}</span>
                </div>
            )}

            {loadingServices ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                    <Loader2
                        size={28}
                        className="animate-spin text-blue-500 mx-auto mb-3"
                    />
                    <p className="text-sm text-slate-500">
                        A carregar serviços...
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={19} className="text-blue-600" />
                            <h2 className="text-2xl font-bold text-slate-900">
                                Aulas de Hoje
                            </h2>
                        </div>
                        {todayServices.length ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {todayServices.map((s) => (
                                    <ServiceCard
                                        key={
                                            s.sessionKey ||
                                            `${s.id}:${getServiceDisplayDate(s)}`
                                        }
                                        service={s}
                                        isActive={
                                            (s.sessionKey ||
                                                `${s.id}:${getServiceDisplayDate(s)}`) ===
                                            selectedSessionKey
                                        }
                                        isMarked={isMarked(s)}
                                        onOpen={() => openService(s)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                                <Calendar
                                    size={28}
                                    className="mx-auto mb-3 text-slate-300"
                                />
                                <p className="text-sm text-slate-400">
                                    Não há aulas para hoje
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={19} className="text-amber-500" />
                            <h2 className="text-2xl font-bold text-slate-900">
                                Presenças Pendentes
                            </h2>
                        </div>
                        {pendingServices.length ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pendingServices.map((s) => (
                                    <ServiceCard
                                        key={
                                            s.sessionKey ||
                                            `${s.id}:${getServiceDisplayDate(s)}`
                                        }
                                        service={s}
                                        isActive={
                                            (s.sessionKey ||
                                                `${s.id}:${getServiceDisplayDate(s)}`) ===
                                            selectedSessionKey
                                        }
                                        isMarked={isMarked(s)}
                                        onOpen={() => openService(s)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                                <CheckCircle2
                                    size={28}
                                    className="mx-auto mb-3 text-emerald-300"
                                />
                                <p className="text-sm text-slate-400">
                                    Sem registos pendentes
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Histórico de Presenças por Aluno */}
            {!loadingServices && services.length > 0 && (
                <div className="space-y-4 border-t border-slate-200 pt-6">
                    <div className="flex items-center gap-2">
                        <Users size={19} className="text-violet-600" />
                        <h2 className="text-2xl font-bold text-slate-900">Histórico por Aluno</h2>
                    </div>
                    <p className="text-sm text-slate-500">Selecione um serviço para ver o histórico acumulado de presenças e faltas de cada aluno.</p>
                    <div className="flex items-center gap-3">
                        <select
                            value={historicoServiceId}
                            onChange={(e) => setHistoricoServiceId(e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white"
                        >
                            <option value="">Escolher serviço...</option>
                            {services.map((s) => (
                                <option key={s.id} value={String(s.id)}>{s.titulo || s.disciplina}</option>
                            ))}
                        </select>
                        {historicoServiceId && (
                            <button onClick={() => setHistoricoServiceId('')} className="text-slate-400 hover:text-slate-600 p-1">
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {loadingHistorico && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                            <Loader2 size={16} className="animate-spin" /> A carregar histórico...
                        </div>
                    )}

                    {historico && !loadingHistorico && (
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            {historico.resumo_por_aluno?.length === 0 ? (
                                <div className="py-12 text-center">
                                    <Users size={28} className="mx-auto mb-3 text-slate-200" />
                                    <p className="text-sm text-slate-400">Sem registos de presenças para este serviço</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Aluno</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Ano/Turma</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-600 uppercase">Presenças</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-rose-600 uppercase">Faltas</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Repostas</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Total</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Taxa Presença</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {historico.resumo_por_aluno.map((aluno, i) => {
                                                const taxa = aluno.total > 0 ? Math.round(((aluno.presentes + aluno.repostas) / aluno.total) * 100) : 0;
                                                return (
                                                    <tr key={i} className={`hover:bg-slate-50 ${aluno.faltas > 2 ? 'bg-rose-50/40' : ''}`}>
                                                        <td className="px-4 py-3 font-medium text-slate-800">{aluno.nome}</td>
                                                        <td className="px-4 py-3 text-slate-500">{aluno.ano ? `${aluno.ano}º` : ''}{aluno.turma ? ` T${aluno.turma}` : ''}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-emerald-700">{aluno.presentes}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`font-semibold ${aluno.faltas > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{aluno.faltas}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-semibold text-blue-700">{aluno.repostas}</td>
                                                        <td className="px-4 py-3 text-center text-slate-600">{aluno.total}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${taxa >= 80 ? 'bg-emerald-100 text-emerald-700' : taxa >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                {taxa}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <AttendanceModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSave={handleSave}
                service={serviceDetail?.servico}
                selectedDate={selectedDate}
                students={attendanceRows}
                onStudentChange={(key, status) =>
                    updateStudent(key, {
                        estado: status,
                        ...(status === 'reposta'
                            ? {}
                            : { data_reposicao: '' }),
                    })
                }
                onObservacaoChange={(key, obs) =>
                    updateStudent(key, { observacao: obs })
                }
                onReplacementDateChange={(key, date) =>
                    updateStudent(key, { data_reposicao: date })
                }
                onMarkAll={markAll}
                onAddExtra={addExtraStudent}
                allStudents={allStudents}
                stats={stats}
                saving={saving}
                loading={loadingDetail}
            />
        </section>
    );
}
