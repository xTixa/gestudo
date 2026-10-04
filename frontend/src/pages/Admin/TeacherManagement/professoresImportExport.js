// Importação e exportação de professores (CSV, Excel e PDF). As bibliotecas
// pesadas (jspdf, exceljs) só são carregadas quando são usadas.
import { apiPost } from '../../../utils/api';
import {
    descarregarModeloImportacao,
    MIME_XLSX,
    normalizeFileName as normalizarNome,
    resultadoExportacao,
    saveBlobToDisk,
    validarFicheiroImportacao,
} from '../../../utils/ficheiros';

async function carregarPdf() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);
    return { jsPDF, autoTable };
}

export const FORMAT_OPTIONS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'excel', label: 'Excel', extension: 'xlsx' },
    { id: 'pdf', label: 'PDF', extension: 'pdf' },
];

export const IMPORT_FORMAT_OPTIONS = FORMAT_OPTIONS.filter(
    (option) => option.id !== 'pdf'
);


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

// Nome de ficheiro seguro, com 'professores' por omissão.
function normalizeFileName(fileName) {
    return normalizarNome(fileName, 'professores');
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
    const { lerPrimeiraFolha } = await import('../../../utils/excel');
    const rawRows = await lerPrimeiraFolha(await file.arrayBuffer());

    return rawRows.map((row) =>
        Object.entries(row).reduce((acc, [key, value]) => {
            acc[normalizeHeader(key)] = cleanupParsedValue(value);
            return acc;
        }, {})
    );
}

// Junta à lista os professores acabados de importar que ainda não estão nela.
export function juntarProfessoresImportados(atuais, importados) {
    const ids = new Set(atuais.map((prof) => prof.id_professor));
    return [...atuais, ...importados.filter((prof) => !ids.has(prof.id_professor))];
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

async function exportRowsToPdf(rows, fileName) {
    const { jsPDF, autoTable } = await carregarPdf();
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

export async function downloadProfFichaPdf(prof) {
    const { jsPDF, autoTable } = await carregarPdf();
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

const CAMPOS_EXPORTACAO = [
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

const ROTULOS_EXCEL = [
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

/**
 * Exporta as linhas no formato escolhido. Devolve { mensagem } ou { erro }.
 */
export async function exportarProfessores(rows, { formato, nomeFicheiro }) {
    if (rows.length === 0) {
        return { erro: 'Nao existem professores para exportar.' };
    }

    if (formato === 'pdf') {
        await exportRowsToPdf(rows, nomeFicheiro);
        return { mensagem: 'PDF exportado com sucesso.' };
    }

    const baseFileName = normalizeFileName(nomeFicheiro);
    const valores = (prof) => CAMPOS_EXPORTACAO.map((campo) => prof[campo] || '');

    if (formato === 'csv') {
        const lines = rows.map((prof) =>
            valores(prof)
                .map((value) => `"${String(value || '').replaceAll('"', '""')}"`)
                .join(',')
        );
        const csvData = [CAMPOS_EXPORTACAO.join(','), ...lines].join('\n');

        const saveResult = await saveBlobToDisk(
            new Blob([csvData], { type: 'text/csv;charset=utf-8;' }),
            baseFileName,
            'csv',
            'text/csv'
        );
        return resultadoExportacao(saveResult, 'CSV');
    }

    const { linhasParaXlsx } = await import('../../../utils/excel');
    const saveResult = await saveBlobToDisk(
        await linhasParaXlsx([ROTULOS_EXCEL, ...rows.map(valores)], 'Professores'),
        baseFileName,
        'xlsx',
        MIME_XLSX
    );
    return resultadoExportacao(saveResult, 'XLSX');
}

export function descarregarModeloProfessores(formato) {
    return descarregarModeloImportacao({
        formato,
        cabecalhos: IMPORT_TEMPLATE_HEADERS,
        exemplo: [
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
        ],
        nomeFicheiro: 'modelo-importacao-professores',
        folha: 'Professores',
    });
}

// Lê o ficheiro e valida as linhas (sem linhas totalmente vazias).
async function validarFicheiroProfessores(ficheiro, formato) {
    let parsedRows = [];

    if (formato === 'excel') {
        const excelRows = await parseExcelImportFile(ficheiro);
        parsedRows = excelRows.map((row, index) => toImportProfessor(row, index));
    } else {
        const content = await ficheiro.text();
        parsedRows = parseProfessorCsvRows(content);
    }

    parsedRows = parsedRows.filter((row) =>
        Object.values(row || {}).some((value) => String(value || '').trim() !== '')
    );

    return { parsedRows, validation: validateImportRows(parsedRows) };
}

function resumoValidacao(validation) {
    return {
        total: validation.total,
        valid: validation.validRows.length,
        invalid: validation.invalidRows.length,
        errors: validation.invalidRows.slice(0, 5),
    };
}

// Pré-validação mostrada ao escolher o ficheiro.
export async function preverImportacaoProfessores(ficheiro, formato) {
    try {
        const { validation } = await validarFicheiroProfessores(ficheiro, formato);
        return resumoValidacao(validation);
    } catch {
        return {
            total: 0,
            valid: 0,
            invalid: 0,
            errors: [{ line: 1, reason: 'Não foi possível analisar o ficheiro.' }],
        };
    }
}

/**
 * Lê e valida o ficheiro para importar. Devolve { validRows, invalidCount,
 * preview } ou { erro, preview? }.
 */
export async function lerProfessoresParaImportar(ficheiro, formato) {
    const erroFicheiro = validarFicheiroImportacao(ficheiro, formato);
    if (erroFicheiro) {
        return { erro: erroFicheiro };
    }

    const { parsedRows, validation } = await validarFicheiroProfessores(ficheiro, formato);

    if (!parsedRows.length) {
        return { erro: 'Nenhum registo válido encontrado no ficheiro.' };
    }

    const preview = resumoValidacao(validation);

    if (!validation.validRows.length) {
        return {
            erro: 'Nenhuma linha válida para importar. Verifique os erros listados no preview.',
            preview,
        };
    }

    return {
        validRows: validation.validRows,
        invalidCount: validation.invalidRows.length,
        preview,
    };
}

/**
 * Grava a importação. Devolve { insertedRows, mensagem } ou
 * { insertedRows, erro } (processada sem inserções). Lança erro se o pedido
 * falhar.
 */
export async function importarProfessores(validRows, invalidCount) {
    const importResponse = await apiPost('/api/gestor/professores/import', {
        professores: validRows,
    });
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
    const skipped = Array.isArray(importData.skipped) ? importData.skipped : [];

    if (!insertedRows.length) {
        const details = skipped
            .slice(0, 3)
            .map((item) => `linha ${item.row}: ${item.reason}`)
            .join(' | ');
        return {
            insertedRows,
            erro: details
                ? `Importação processada, mas sem inserções. ${details}`
                : 'Importação processada, mas nenhum professor novo foi inserido (duplicados ou inválidos).',
        };
    }

    const skippedCount = Number(importData.skippedCount || 0);
    const skippedPreview = skipped
        .slice(0, 2)
        .map((item) => `linha ${item.row}: ${item.reason}`)
        .join(' | ');

    return {
        insertedRows,
        mensagem:
            skippedCount > 0
                ? `Importação concluída: ${insertedRows.length} inserido(s) e ${skippedCount} ignorado(s). ${skippedPreview}`
                : `Importação concluída: ${insertedRows.length} professor(es) inserido(s) na base de dados.${
                      invalidCount
                          ? ` ${invalidCount} linha(s) inválida(s) foram ignoradas.`
                          : ''
                  }`,
    };
}
