import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    Download,
    Upload,
    Plus,
    Eye,
    MoreVertical,
    Pencil,
    X,
    UserRound,
    GraduationCap,
    Funnel,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { read, utils, write } from 'xlsx';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiGet, apiPost } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const FORMAT_OPTIONS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'excel', label: 'Excel', extension: 'xlsx' },
    { id: 'pdf', label: 'PDF', extension: 'pdf' },
];

const IMPORT_FORMAT_OPTIONS = FORMAT_OPTIONS.filter(
    (option) => option.id !== 'pdf'
);
const IMPORT_STORAGE_KEY = 'mc_imported_professores';

const IMPORT_TEMPLATE_HEADERS = [
    'nome',
    'email',
    'nif',
    'data_nasc',
    'cc',
    'morada',
    'localidade',
    'cod_postal',
    'contacto',
    'telefone',
    'habilitacao',
    'area_ensino',
    'nivel',
];

// função para extrair valores únicos de um campo de um array de objetos, retornando um array ordenado com o valor 'Todos' no início
function uniqueValues(array, field) {
    const values = Array.from(
        new Set(
            array
                .map((item) => item[field])
                .filter((value) => value != null && String(value).trim() !== '')
        )
    ).sort((a, b) => String(a).localeCompare(String(b), 'pt-PT'));
    return ['Todos', ...values];
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeFileName(fileName) {
    const clean = (fileName || 'professores')
        .trim()
        .replace(/[^a-zA-Z0-9-_]/g, '-');
    return clean || 'professores';
}

function getFileAcceptByFormat(format) {
    if (format === 'csv') {
        return '.csv,text/csv';
    }

    if (format === 'excel') {
        return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return '.pdf,application/pdf';
}

function parseDelimitedLine(line, delimiter) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && char === delimiter) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values;
}

function normalizeHeader(header) {
    return String(header || '')
        .replace(/^\uFEFF/, '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function detectCsvDelimiter(headerLine) {
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
}

function parseLineWithRepair(line, delimiter) {
    let values = parseDelimitedLine(line, delimiter);

    if (values.length > 1) {
        return values;
    }

    const raw = String(line || '').trim();
    if (!raw) {
        return values;
    }

    // Repair common malformed exports where whole row is wrapped and quotes are doubled.
    const repaired = raw
        .replace(/^"/, '')
        .replace(/"+$/, '')
        .replaceAll('""', '"');
    values = parseDelimitedLine(repaired, delimiter);

    if (values.length > 1) {
        return values;
    }

    if (repaired.includes('","')) {
        const splitValues = repaired
            .split('","')
            .map((part) => part.replace(/^"/, '').replace(/"$/, '').trim());

        if (splitValues.length > 1) {
            return splitValues;
        }
    }

    // Final fallback for damaged quote patterns.
    const manual = repaired.split(delimiter).map((part) => part.trim());
    return manual.length > values.length ? manual : values;
}

function cleanupParsedValue(value) {
    return String(value || '')
        .replace(/^\uFEFF/, '')
        .replace(/^"+/, '')
        .replace(/"+$/, '')
        .replaceAll('""', '"')
        .trim();
}

function normalizeImportDate(value) {
    const raw = String(value || '').trim();

    if (!raw) {
        return { value: '', valid: true };
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(date.getTime())
            ? { value: '', valid: false }
            : { value: `${year}-${month}-${day}`, valid: true };
    }

    const ptMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ptMatch) {
        const [, day, month, year] = ptMatch;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (Number.isNaN(date.getTime())) {
            return { value: '', valid: false };
        }

        return {
            value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            valid: true,
        };
    }

    const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
        const [, day, month, year] = dashMatch;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (Number.isNaN(date.getTime())) {
            return { value: '', valid: false };
        }

        return {
            value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            valid: true,
        };
    }

    return { value: '', valid: false };
}

function repairCsvHeaderLine(line) {
    const raw = String(line || '')
        .replace(/^\uFEFF/, '')
        .trim();

    if (!raw) {
        return raw;
    }

    return raw.replaceAll('""', '"').replace(/^"/, '').replace(/"+$/, '');
}

function parseProfessorCsvRows(content) {
    const lines = String(content || '')
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
        return [];
    }

    const originalDelimiter = detectCsvDelimiter(lines[0]);
    const originalHeaders = parseDelimitedLine(lines[0], originalDelimiter).map(
        normalizeHeader
    );
    const hasRequiredHeaders =
        originalHeaders.includes('nome') && originalHeaders.includes('email');
    const headerLine = hasRequiredHeaders
        ? lines[0]
        : repairCsvHeaderLine(lines[0]);
    const delimiter = detectCsvDelimiter(headerLine);
    const headers = parseDelimitedLine(headerLine, delimiter).map(
        normalizeHeader
    );

    return lines.slice(1).map((line, index) => {
        const values = parseLineWithRepair(line, delimiter);
        return toImportProfessor(
            headers.reduce(
                (acc, header, headerIndex) => ({
                    ...acc,
                    [header]: cleanupParsedValue(values[headerIndex]),
                }),
                {}
            ),
            index
        );
    });
}

function isValidEmail(value) {
    const text = String(value || '').trim();
    if (!text) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

async function parseExcelImportFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = utils.sheet_to_json(worksheet, { defval: '' });

    return rawRows.map((row) =>
        Object.entries(row).reduce((acc, [key, value]) => {
            acc[normalizeHeader(key)] = cleanupParsedValue(value);
            return acc;
        }, {})
    );
}

function makeDedupKey(item) {
    return `${String(item?.email || '').toLowerCase()}|${String(item?.nif || '')}`;
}

function readImportedProfessoresStorage() {
    try {
        const raw = localStorage.getItem(IMPORT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveImportedProfessoresStorage(rows) {
    try {
        localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(rows));
    } catch {
        // noop
    }
}

function mergeUniqueByKey(baseRows, incomingRows) {
    const map = new Map();

    for (const row of baseRows || []) {
        map.set(makeDedupKey(row), row);
    }

    for (const row of incomingRows || []) {
        map.set(makeDedupKey(row), row);
    }

    return Array.from(map.values());
}

function findFirstPatternMatch(row, pattern, excludeKeys = []) {
    const excluded = new Set(excludeKeys);

    for (const [key, value] of Object.entries(row || {})) {
        if (excluded.has(key)) {
            continue;
        }

        const text = String(value || '').trim();
        if (pattern.test(text)) {
            return text;
        }
    }

    return '';
}

function toImportProfessor(row, index) {
    const get = (...keys) => {
        for (const key of keys) {
            if (row[key] != null && String(row[key]).trim()) {
                return String(row[key]).trim();
            }
        }
        return '';
    };

    const rawNif = get('nif');
    const rawDataNasc = get(
        'datanasc',
        'data_nasc',
        'datanascimento',
        'data_nascimento'
    );
    const normalizedNifAsDate = normalizeImportDate(rawNif);
    const normalizedDataNasc = normalizeImportDate(rawDataNasc);
    const inferredNif = /^\d{9}$/.test(rawNif)
        ? rawNif
        : findFirstPatternMatch(row, /^\d{9}$/, [
              'nome',
              'nomecompleto',
              'email',
              'data_nasc',
              'datanasc',
              'datanascimento',
              'data_nascimento',
          ]);
    const repairedDataNasc = normalizedDataNasc.valid
        ? normalizedDataNasc.value
        : normalizedNifAsDate.valid
          ? normalizedNifAsDate.value
          : '';

    return {
        id_professor: `import-${Date.now()}-${index}`,
        __line: index + 2,
        nome: get('nome', 'nomecompleto'),
        nif: inferredNif,
        data_nasc: repairedDataNasc || '2000-01-01',
        data_nasc_invalid:
            Boolean(rawDataNasc) &&
            !normalizedDataNasc.valid &&
            !normalizedNifAsDate.valid,
        cc: get('cc', 'numcc', 'cartao') || '0000000000000000',
        morada: get('morada', 'endereco', 'rua') || '',
        localidade: get('localidade', 'cidade') || '',
        cod_postal:
            get('codpostal', 'cod_postal', 'codigopostal') || '0000-000',
        contacto: get('contacto', 'telemovel') || '',
        telefone: get('telefone') || '',
        email: get('email'),
        habilitacao: get('habilitacao'),
        area_ensino: get('areaensino', 'area_ensino', 'area'),
        nivel: get('nivel') || 'Secundario',
        data_entrada: new Date().toISOString(),
        status: 'ativo',
    };
}

function validateImportRows(rows) {
    const validRows = [];
    const invalidRows = [];

    for (const row of rows) {
        const issues = [];

        if (!String(row.nome || '').trim()) {
            issues.push('nome em falta');
        }

        if (!String(row.email || '').trim()) {
            issues.push('email em falta');
        } else if (!isValidEmail(row.email)) {
            issues.push('email inválido');
        }

        if (row.data_nasc_invalid) {
            issues.push('data de nascimento inválida');
        }

        if (issues.length) {
            invalidRows.push({
                line: Number(row.__line || 0),
                reason: issues.join(', '),
            });
            continue;
        }

        validRows.push(row);
    }

    return {
        total: rows.length,
        validRows,
        invalidRows,
    };
}

async function saveBlobToDisk(blob, fileName, extension, mimeType) {
    const suggestedFileName = `${normalizeFileName(fileName)}.${extension}`;

    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedFileName,
                types: [
                    {
                        description: `Ficheiro ${extension.toUpperCase()}`,
                        accept: { [mimeType]: [`.${extension}`] },
                    },
                ],
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return 'saved';
        } catch (error) {
            if (error?.name === 'AbortError') {
                return 'cancelled';
            }
        }
    }

    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);

    link.href = blobUrl;
    link.download = suggestedFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return 'downloaded';
}

function exportRowsToPdf(rows, fileName) {
    const doc = new jsPDF({ orientation: 'landscape' });
    const dateLabel = new Date().toLocaleDateString('pt-PT');

    doc.setFontSize(16);
    doc.text('Lista de Professores', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Gerado em ${dateLabel}`, 14, 22);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
        startY: 28,
        head: [['Nome', 'NIF', 'Data Nasc', 'Contacto', 'Email', 'Habilitacao', 'Area Ensino', 'Nivel']],
        body: rows.map((row) => [
            row.nome || '',
            row.nif || '',
            row.data_nasc ? new Date(row.data_nasc).toLocaleDateString('pt-PT') : '',
            row.contacto || '',
            row.email || '',
            row.habilitacao || '',
            row.area_ensino || '',
            row.nivel || '',
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [248, 250, 252], textColor: [31, 41, 55], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    const suggestedName = `${normalizeFileName(fileName || 'professores')}.pdf`;
    doc.save(suggestedName);
    return true;
}

function downloadProfFichaPdf(prof) {
    const doc = new jsPDF();
    const dateLabel = new Date().toLocaleDateString('pt-PT');

    doc.setFontSize(18);
    doc.text('Ficha de Professor', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Gerado em ${dateLabel}`, 14, 25);
    doc.setTextColor(0, 0, 0);

    const fields = [
        ['Nome', prof.nome || '-'],
        ['NIF', prof.nif || '-'],
        ['Área de Ensino', prof.area_ensino || '-'],
        ['Nível', prof.nivel || '-'],
        ['Contacto', prof.contacto || '-'],
        ['Email', prof.email || '-'],
        ['Data de Entrada', prof.data_entrada ? new Date(prof.data_entrada).toLocaleDateString('pt-PT') : '-'],
    ];

    autoTable(doc, {
        startY: 32,
        head: [['Campo', 'Valor']],
        body: fields,
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    const name = (prof.nome || 'professor').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    doc.save(`ficha_professor_${name}.pdf`);
}

function getProfessorProfileImage(professor) {
    const raw =
        professor?.imagem_perfil_url ||
        professor?.pessoa?.imagem_perfil_url ||
        professor?.pessoa?.user?.imagem_perfil_url ||
        '';

    const value = String(raw || '').trim();
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${API_URL}${value}`;
    }

    return `${API_URL}/${value}`;
}

function getProfessorNome(professor) {
    return (
        String(professor?.nome || professor?.pessoa?.nome || '').trim() || '-'
    );
}

function getProfessorNif(professor) {
    return String(professor?.nif || professor?.pessoa?.nif || '').trim() || '-';
}

export default function GestaoProfessores() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [professorSelecionado, setProfessorSelecionado] = useState(null);
    const [professores, setProfessores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('csv');
    const [importFormat, setImportFormat] = useState('csv');
    const [importing, setImporting] = useState(false);
    const [exportFileName, setExportFileName] = useState('professores');
    const [selectedImportFile, setSelectedImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [actionMessage, setActionMessage] = useState('');
    const [actionError, setActionError] = useState('');
    const [filters, setFilters] = useState({
        search: '',
        area_ensino: 'Todos',
        nivel: 'Todos',
    });
    const [openDropdown, setOpenDropdown] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const dropdownRef = useRef(null);

    const filterOptions = useMemo(
        () => ({
            area_ensino: uniqueValues(professores, 'area_ensino'),
            nivel: uniqueValues(professores, 'nivel'),
        }),
        [professores]
    );

    function updateFilter(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }

    useEffect(() => {
        updateFilter('search', searchParams.get('q') || '');
    }, [searchParams]);

    useEffect(() => {
        let isMounted = true;

        async function carregarProfessores() {
            setLoading(true);
            setError('');

            try {
                const response = await apiGet('/api/gestor/professores');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Não foi possível obter professores.'
                    );
                }

                if (isMounted) {
                    const storedImported = readImportedProfessoresStorage();
                    const apiRows = Array.isArray(data.professores)
                        ? data.professores
                        : [];
                    const merged = mergeUniqueByKey(apiRows, storedImported);
                    setProfessores(merged);
                }
            } catch (fetchError) {
                if (isMounted) {
                    setError(
                        fetchError.message || 'Erro ao carregar professores.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregarProfessores();

        return () => {
            isMounted = false;
        };
    }, []);

    const professoresFiltrados = useMemo(() => {
        const term = filters.search.trim().toLowerCase();

        return professores.filter((prof) => {
            const matchesSearch =
                !term ||
                [prof.nome, prof.nif, prof.area_ensino, prof.nivel].some(
                    (value) => String(value).toLowerCase().includes(term)
                );

            const matchesArea =
                filters.area_ensino === 'Todos' ||
                prof.area_ensino === filters.area_ensino;
            const matchesNivel =
                filters.nivel === 'Todos' || prof.nivel === filters.nivel;

            return matchesSearch && matchesArea && matchesNivel;
        });
    }, [professores, filters]);

    useEffect(() => {
        if (openDropdown === null) return;

        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdown]);

    function handleOpenDropdown(event, prof) {
        if (openDropdown?.id === prof.id_professor) {
            setOpenDropdown(null);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.left });
        setOpenDropdown({ id: prof.id_professor, prof });
    }

    const professorModal = professorSelecionado;
    const professorModalImage = getProfessorProfileImage(professorModal);

    async function handleExportSubmit(event) {
        event.preventDefault();
        setActionMessage('');
        setActionError('');

        if (professoresFiltrados.length === 0) {
            setActionError('Nao existem professores para exportar.');
            return;
        }

        if (exportFormat === 'pdf') {
            exportRowsToPdf(professoresFiltrados, exportFileName);
            setActionMessage('PDF exportado com sucesso.');
            setShowExportModal(false);
            return;
        }

        const baseFileName = normalizeFileName(exportFileName);

        if (exportFormat === 'csv') {
            const header = [
                'nome',
                'nif',
                'data_nasc',
                'cc',
                'morada',
                'localidade',
                'cod_postal',
                'contacto',
                'telefone',
                'email',
                'habilitacao',
                'area_ensino',
                'nivel',
            ];
            const lines = professoresFiltrados.map((prof) =>
                [
                    prof.nome || '',
                    prof.nif || '',
                    prof.data_nasc || '',
                    prof.cc || '',
                    prof.morada || '',
                    prof.localidade || '',
                    prof.cod_postal || '',
                    prof.contacto || '',
                    prof.telefone || '',
                    prof.email || '',
                    prof.habilitacao || '',
                    prof.area_ensino || '',
                    prof.nivel || '',
                ]
                    .map(
                        (value) =>
                            `"${String(value || '').replaceAll('"', '""')}"`
                    )
                    .join(',')
            );
            const csvData = [header.join(','), ...lines].join('\n');

            const saveResult = await saveBlobToDisk(
                new Blob([csvData], { type: 'text/csv;charset=utf-8;' }),
                baseFileName,
                'csv',
                'text/csv'
            );

            if (saveResult === 'cancelled') {
                setActionError('Exportacao cancelada.');
                return;
            }

            setActionMessage(
                saveResult === 'saved'
                    ? 'Ficheiro CSV guardado no local escolhido.'
                    : 'Ficheiro CSV descarregado (browser sem seletor de pasta).'
            );
            setShowExportModal(false);
            return;
        }

        const excelHeader = [
            'Nome',
            'NIF',
            'Data Nascimento',
            'Cartao Cidadao',
            'Morada',
            'Localidade',
            'Cod Postal',
            'Contacto',
            'Telefone',
            'Email',
            'Habilitacao',
            'Area Ensino',
            'Nivel',
        ];
        const wsData = [
            excelHeader,
            ...professoresFiltrados.map((prof) => [
                prof.nome || '',
                prof.nif || '',
                prof.data_nasc || '',
                prof.cc || '',
                prof.morada || '',
                prof.localidade || '',
                prof.cod_postal || '',
                prof.contacto || '',
                prof.telefone || '',
                prof.email || '',
                prof.habilitacao || '',
                prof.area_ensino || '',
                prof.nivel || '',
            ]),
        ];
        const worksheet = utils.aoa_to_sheet(wsData);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Professores');
        const excelArrayBuffer = write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });

        const saveResult = await saveBlobToDisk(
            new Blob([excelArrayBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
            baseFileName,
            'xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        if (saveResult === 'cancelled') {
            setActionError('Exportacao cancelada.');
            return;
        }

        setActionMessage(
            saveResult === 'saved'
                ? 'Ficheiro XLSX guardado no local escolhido.'
                : 'Ficheiro XLSX descarregado (browser sem seletor de pasta).'
        );
        setShowExportModal(false);
    }

    async function handleImportSubmit(event) {
        event.preventDefault();
        setActionMessage('');
        setActionError('');
        setImporting(true);
        try {
            if (!selectedImportFile) {
                setActionError('Selecione um ficheiro para importar.');
                return;
            }

            const fileName = selectedImportFile.name.toLowerCase();
            const isCsv = fileName.endsWith('.csv');
            const isExcel =
                fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

            if (importFormat === 'csv' && !isCsv) {
                setActionError('Formato invalido: escolha um ficheiro .csv.');
                return;
            }

            if (importFormat === 'excel' && !isExcel) {
                setActionError(
                    'Formato invalido: escolha um ficheiro .xls ou .xlsx.'
                );
                return;
            }

            let parsedRows = [];

            if (importFormat === 'excel') {
                const excelRows =
                    await parseExcelImportFile(selectedImportFile);
                parsedRows = excelRows.map((row, index) =>
                    toImportProfessor(row, index)
                );
            } else {
                const content = await selectedImportFile.text();
                parsedRows = parseProfessorCsvRows(content);
            }

            parsedRows = parsedRows.filter((row) =>
                Object.values(row || {}).some(
                    (value) => String(value || '').trim() !== ''
                )
            );

            if (!parsedRows.length) {
                setActionError('Nenhum registo válido encontrado no ficheiro.');
                return;
            }

            const validation = validateImportRows(parsedRows);
            const validRows = validation.validRows;

            setImportPreview({
                total: validation.total,
                valid: validRows.length,
                invalid: validation.invalidRows.length,
                errors: validation.invalidRows.slice(0, 5),
            });

            if (!validRows.length) {
                setActionError(
                    'Nenhuma linha válida para importar. Verifique os erros listados no preview.'
                );
                return;
            }

            const importResponse = await apiPost(
                '/api/gestor/professores/import',
                {
                    professores: validRows,
                }
            );
            const importData = await importResponse.json();

            if (!importResponse.ok) {
                throw new Error(
                    importData.message ||
                        'Não foi possível gravar a importação na base de dados.'
                );
            }

            const insertedRows = Array.isArray(importData.professores)
                ? importData.professores
                : [];
            const merged = mergeUniqueByKey(professores, insertedRows);
            setProfessores(merged);
            saveImportedProfessoresStorage([]);

            const skipped = Array.isArray(importData.skipped)
                ? importData.skipped
                : [];

            if (!insertedRows.length) {
                const details = skipped
                    .slice(0, 3)
                    .map((item) => `linha ${item.row}: ${item.reason}`)
                    .join(' | ');
                setActionError(
                    details
                        ? `Importação processada, mas sem inserções. ${details}`
                        : 'Importação processada, mas nenhum professor novo foi inserido (duplicados ou inválidos).'
                );
                return;
            }

            const skippedCount = Number(importData.skippedCount || 0);
            const skippedPreview = skipped
                .slice(0, 2)
                .map((item) => `linha ${item.row}: ${item.reason}`)
                .join(' | ');
            setActionMessage(
                skippedCount > 0
                    ? `Importação concluída: ${insertedRows.length} inserido(s) e ${skippedCount} ignorado(s). ${skippedPreview}`
                    : `Importação concluída: ${insertedRows.length} professor(es) inserido(s) na base de dados.${
                          validation.invalidRows.length
                              ? ` ${validation.invalidRows.length} linha(s) inválida(s) foram ignoradas.`
                              : ''
                      }`
            );

            setShowImportModal(false);
            setSelectedImportFile(null);
            setImportPreview(null);
        } catch (error) {
            setActionError(
                error?.message ||
                    'Falha inesperada na importação. Verifique o ficheiro e tente novamente.'
            );
        } finally {
            setImporting(false);
        }
    }

    async function handleImportFileChange(file) {
        setSelectedImportFile(file || null);
        setImportPreview(null);

        if (!file) {
            return;
        }

        try {
            let parsedRows = [];

            if (importFormat === 'excel') {
                const excelRows = await parseExcelImportFile(file);
                parsedRows = excelRows.map((row, index) =>
                    toImportProfessor(row, index)
                );
            } else {
                const content = await file.text();
                parsedRows = parseProfessorCsvRows(content);
            }

            parsedRows = parsedRows.filter((row) =>
                Object.values(row || {}).some(
                    (value) => String(value || '').trim() !== ''
                )
            );

            const validation = validateImportRows(parsedRows);
            setImportPreview({
                total: validation.total,
                valid: validation.validRows.length,
                invalid: validation.invalidRows.length,
                errors: validation.invalidRows.slice(0, 5),
            });
        } catch {
            setImportPreview({
                total: 0,
                valid: 0,
                invalid: 0,
                errors: [
                    {
                        line: 1,
                        reason: 'Não foi possível analisar o ficheiro.',
                    },
                ],
            });
        }
    }

    async function handleDownloadImportTemplate() {
        setActionMessage('');
        setActionError('');

        const sampleRow = [
            'Ana Costa',
            'ana.costa@exemplo.pt',
            '234567890',
            '1988-03-15',
            '1234567890123456',
            'Rua das Flores 10',
            'Porto',
            '4000-100',
            '912345678',
            '220000000',
            'Mestrado em Ensino',
            'Matematica e Ciencias',
            'Secundario',
        ];

        if (importFormat === 'csv') {
            const csvRows = [IMPORT_TEMPLATE_HEADERS, sampleRow].map((row) =>
                row
                    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                    .join(',')
            );

            const saveResult = await saveBlobToDisk(
                new Blob([csvRows.join('\n')], {
                    type: 'text/csv;charset=utf-8;',
                }),
                'modelo-importacao-professores',
                'csv',
                'text/csv'
            );

            if (saveResult === 'cancelled') {
                setActionError('Download do modelo cancelado.');
                return;
            }

            setActionMessage('Modelo CSV descarregado com sucesso.');
            return;
        }

        const worksheet = utils.aoa_to_sheet([
            IMPORT_TEMPLATE_HEADERS,
            sampleRow,
        ]);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Professores');

        const excelArrayBuffer = write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });

        const saveResult = await saveBlobToDisk(
            new Blob([excelArrayBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
            'modelo-importacao-professores',
            'xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        if (saveResult === 'cancelled') {
            setActionError('Download do modelo cancelado.');
            return;
        }

        setActionMessage('Modelo Excel descarregado com sucesso.');
    }

    return (
        <div className="space-y-5">
            <AdminPageHeader
                eyebrow="Professores"
                title="Gestão de Professores"
                subtitle="Gerir informações e especialidades dos professores"
                icon={GraduationCap}
                actions={
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                        >
                            <Download size={16} />
                            Exportar
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                        >
                            <Upload size={16} />
                            Importar
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                navigate('/gestor/professores/addProf')
                            }
                            className="flex items-center gap-2 rounded-lg bg-york-400 px-4 py-2 text-sm text-white hover:bg-york-200"
                        >
                            <Plus size={16} />
                            Novo Professor
                        </button>
                    </div>
                }
            />

            {actionMessage ? (
                <p className="mb-4 text-sm text-emerald-700">{actionMessage}</p>
            ) : null}
            {actionError ? (
                <p className="mb-4 text-sm text-red-600">{actionError}</p>
            ) : null}

            {/* Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2 text-slate-700">
                    <Funnel size={15} className="text-slate-500" />
                    <h2 className="text-sm font-medium">Filtros</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <label className="md:col-span-2">
                        <span className="mb-1 block text-xs text-slate-500">
                            Pesquisar
                        </span>
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    updateFilter('search', value);

                                    const nextParams = new URLSearchParams(
                                        searchParams
                                    );

                                    if (value.trim()) {
                                        nextParams.set('q', value);
                                    } else {
                                        nextParams.delete('q');
                                    }

                                    setSearchParams(nextParams, {
                                        replace: true,
                                    });
                                }}
                                placeholder="Pesquisar em nome, NIF, área..."
                                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-spindle"
                            />
                        </div>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Área Ensino
                        </span>
                        <select
                            value={filters.area_ensino}
                            onChange={(event) =>
                                updateFilter('area_ensino', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.area_ensino.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Nível
                        </span>
                        <select
                            value={filters.nivel}
                            onChange={(event) =>
                                updateFilter('nivel', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.nivel.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {/* Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                {/* Search */}
                {error ? (
                    <p className="mb-4 text-sm text-red-600">{error}</p>
                ) : null}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 border-b">
                            <tr>
                                <th className="py-3">Nome Completo</th>
                                <th>NIF</th>
                                <th>Área Ensino</th>
                                <th>Contacto</th>
                                <th>Email</th>
                                <th>Nível</th>
                                <th>Data Entrada</th>
                                <th className="text-center">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        A carregar professores...
                                    </td>
                                </tr>
                            ) : null}

                            {professoresFiltrados.map((prof) => (
                                <tr
                                    key={prof.id_professor}
                                    className="border-b hover:bg-gray-50 transition"
                                >
                                    <td className="py-3 font-medium text-gray-800">
                                        {prof.nome}
                                    </td>
                                    <td>{prof.nif}</td>
                                    <td>{prof.area_ensino}</td>
                                    <td>{prof.contacto}</td>
                                    <td>{prof.email}</td>
                                    <td>{prof.nivel}</td>
                                    <td>
                                        {new Date(
                                            prof.data_entrada
                                        ).toLocaleDateString('pt-PT')}
                                    </td>
                                    <td className="flex justify-center gap-3 py-3">
                                        <button
                                            className="text-gray-500 hover:text-sky-600"
                                            title="Ver ficha do professor"
                                            onClick={() =>
                                                setProfessorSelecionado(prof)
                                            }
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            className="text-gray-500 hover:text-indigo-600"
                                            title="Ações"
                                            onClick={(e) => handleOpenDropdown(e, prof)}
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {!loading && professoresFiltrados.length === 0 && (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        Nenhum professor encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {professorSelecionado ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">
                                    Ficha do Professor
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Preview rápida dos dados.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setProfessorSelecionado(null)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Fechar ficha"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 px-5 py-5 text-sm md:grid-cols-2">
                            <div className="flex items-center gap-4 md:col-span-2 pb-2">
                                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                                    {professorModalImage ? (
                                        <img
                                            src={professorModalImage}
                                            alt="Foto de perfil do professor"
                                            className="h-full w-full object-cover"
                                            onError={(event) => {
                                                const img = event.currentTarget;
                                                img.style.display = 'none';
                                                const fallback =
                                                    img.parentElement?.querySelector(
                                                        '[data-professor-profile-fallback="1"]'
                                                    );
                                                if (fallback) {
                                                    fallback.classList.remove(
                                                        'hidden'
                                                    );
                                                }
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        data-professor-profile-fallback="1"
                                        className={
                                            professorModalImage ? 'hidden' : ''
                                        }
                                    >
                                        <UserRound
                                            size={36}
                                            strokeWidth={1.8}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {getProfessorNome(professorModal)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Preview rápida do professor
                                    </p>
                                </div>
                            </div>

                            <p className="text-slate-700">
                                <strong>Nome:</strong>{' '}
                                {getProfessorNome(professorSelecionado)}
                            </p>
                            <p className="text-slate-700">
                                <strong>NIF:</strong>{' '}
                                {getProfessorNif(professorSelecionado)}
                            </p>
                            <p className="text-slate-700">
                                <strong>Email:</strong>{' '}
                                {professorSelecionado.email}
                            </p>
                            <p className="text-slate-700">
                                <strong>Contacto:</strong>{' '}
                                {professorSelecionado.contacto}
                            </p>
                            <p className="text-slate-700">
                                <strong>Área de Ensino:</strong>{' '}
                                {professorSelecionado.area_ensino}
                            </p>
                            <p className="text-slate-700">
                                <strong>Nível:</strong>{' '}
                                {professorSelecionado.nivel}
                            </p>
                            <p className="text-slate-700 md:col-span-2">
                                <strong>Habilitação:</strong>{' '}
                                {professorSelecionado.habilitacao}
                            </p>
                            <p className="text-slate-700 md:col-span-2">
                                <strong>Data de Entrada:</strong>{' '}
                                {new Date(
                                    professorSelecionado.data_entrada
                                ).toLocaleDateString('pt-PT')}
                            </p>
                        </div>

                        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setProfessorSelecionado(null)}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {showExportModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">
                                    Exportar professores
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Escolha o formato do ficheiro.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Fechar exportacao"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleExportSubmit}
                            className="space-y-4 px-5 py-5"
                        >
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-700">
                                    Formato
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {FORMAT_OPTIONS.map((option) => (
                                        <label
                                            key={option.id}
                                            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                                                exportFormat === option.id
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="export-format"
                                                value={option.id}
                                                checked={
                                                    exportFormat === option.id
                                                }
                                                onChange={(event) =>
                                                    setExportFormat(
                                                        event.target.value
                                                    )
                                                }
                                                className="sr-only"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Nome do ficheiro
                                </label>
                                <input
                                    type="text"
                                    value={exportFileName}
                                    onChange={(event) =>
                                        setExportFileName(event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="professores"
                                />
                            </div>

                            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowExportModal(false)}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                                >
                                    Confirmar exportacao
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {showImportModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">
                                    Importar professores
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Escolha formato e ficheiro.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowImportModal(false);
                                    setSelectedImportFile(null);
                                }}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Fechar importacao"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleImportSubmit}
                            className="space-y-4 px-5 py-5"
                        >
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-700">
                                    Formato
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {IMPORT_FORMAT_OPTIONS.map((option) => (
                                        <label
                                            key={option.id}
                                            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                                                importFormat === option.id
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="import-format"
                                                value={option.id}
                                                checked={
                                                    importFormat === option.id
                                                }
                                                onChange={(event) => {
                                                    setImportFormat(
                                                        event.target.value
                                                    );
                                                    setSelectedImportFile(null);
                                                    setImportPreview(null);
                                                }}
                                                className="sr-only"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Ficheiro
                                </label>
                                <input
                                    type="file"
                                    accept={getFileAcceptByFormat(importFormat)}
                                    onChange={(event) =>
                                        handleImportFileChange(
                                            event.target.files?.[0] || null
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                                />
                                {selectedImportFile ? (
                                    <p className="mt-2 text-xs text-slate-500">
                                        Selecionado: {selectedImportFile.name}
                                    </p>
                                ) : null}
                                {importPreview ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <p className="text-xs font-medium text-slate-700">
                                            Pré-validação: {importPreview.total}{' '}
                                            linha(s), {importPreview.valid}{' '}
                                            válida(s), {importPreview.invalid}{' '}
                                            inválida(s)
                                        </p>
                                        {importPreview.errors?.length ? (
                                            <ul className="mt-1 space-y-1 text-xs text-rose-700">
                                                {importPreview.errors.map(
                                                    (item, idx) => (
                                                        <li
                                                            key={`${item.line}-${idx}`}
                                                        >
                                                            Linha {item.line}:{' '}
                                                            {item.reason}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        ) : null}
                                    </div>
                                ) : null}
                                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-xs text-slate-600">
                                        Precisa de ajuda? Descarregue o modelo
                                        de importacao.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleDownloadImportTemplate}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                        <Download size={13} /> Modelo
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setSelectedImportFile(null);
                                        setImportPreview(null);
                                    }}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={importing}
                                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                                >
                                    {importing
                                        ? 'A importar...'
                                        : 'Confirmar importacao'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {openDropdown !== null && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: `${dropdownPos.top}px`,
                        left: `${dropdownPos.left}px`,
                        zIndex: 9999,
                    }}
                    className="w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1"
                >
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                            navigate(`/gestor/professores/ficha/${openDropdown.id}`);
                            setOpenDropdown(null);
                        }}
                    >
                        <UserRound size={14} />
                        Ver ficha completa
                    </button>
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                            navigate(`/gestor/professores/update/${openDropdown.id}`);
                            setOpenDropdown(null);
                        }}
                    >
                        <Pencil size={14} />
                        Editar
                    </button>
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                            downloadProfFichaPdf(openDropdown.prof);
                            setOpenDropdown(null);
                        }}
                    >
                        <Download size={14} />
                        Download
                    </button>
                </div>
            )}
        </div>
    );
}
