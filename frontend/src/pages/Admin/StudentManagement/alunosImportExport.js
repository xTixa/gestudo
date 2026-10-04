// Importação e exportação de alunos (CSV, Excel e PDF). As bibliotecas
// pesadas (jspdf, papaparse, exceljs) só são carregadas quando são usadas.
import { apiGet, apiPost } from '../../../utils/api';
import {
    celulaCsv,
    descarregarModeloImportacao,
    MIME_XLSX,
    normalizeFileName as normalizarNome,
    resultadoExportacao,
    saveBlobToDisk,
    validarFicheiroImportacao,
} from '../../../utils/ficheiros';
import { formatDate, getEncarregadoLabel } from './alunosFormat';

// opções de formato para exportação de dados, com identificadores, rótulos legíveis e extensões de arquivo correspondentes, usadas para configurar o processo de exportação e para validar os arquivos selecionados pelo usuário
export const EXPORT_FORMAT_OPTIONS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'excel', label: 'Excel', extension: 'xlsx' },
    { id: 'pdf', label: 'PDF', extension: 'pdf' },
];

// opções de formato para importação de dados, com identificadores, rótulos legíveis e extensões de arquivo correspondentes, usadas para configurar o processo de importação e para validar os arquivos selecionados pelo usuário
export const IMPORT_FORMAT_OPTIONS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'excel', label: 'Excel', extension: 'xlsx' },
];

// lista de cabeçalhos esperados para o arquivo de importação, usados para validar os arquivos selecionados pelo usuário e para mapear os dados do arquivo para o formato esperado pela API, garantindo que os campos sejam corretamente identificados mesmo que os cabeçalhos estejam em uma ordem diferente ou usem variações de nomenclatura
const IMPORT_TEMPLATE_HEADERS = [
    'nome_completo',
    'email',
    'data_nascimento',
    'cartao_cidadao',
    'nif',
    'morada',
    'localidade',
    'codigo_postal',
    'telemovel',
    'telefone',
    'ano_escolar',
    'turma',
    'escola',
    'ee_nome_completo',
    'ee_email',
    'ee_cartao_cidadao',
    'ee_nif',
    'ee_morada',
    'ee_localidade',
    'ee_codigo_postal',
    'ee_telemovel',
    'ee_telefone',
    'ee_parentesco',
];

// lista de campos que podem ser exportados, com identificadores e rótulos legíveis, usados para configurar o processo de exportação e para permitir que o usuário selecione quais campos deseja incluir no arquivo exportado
export const EXPORTABLE_FIELDS = [
    { id: 'nome', label: 'Nome Completo' },
    { id: 'email', label: 'Email' },
    { id: 'nif', label: 'NIF' },
    { id: 'data_nascimento', label: 'Data Nascimento' },
    { id: 'cc', label: 'Cartão Cidadão' },
    { id: 'morada', label: 'Morada' },
    { id: 'localidade', label: 'Localidade' },
    { id: 'cod_postal', label: 'Código Postal' },
    { id: 'contacto', label: 'Telemóvel' },
    { id: 'telefone', label: 'Telefone' },
    { id: 'ano', label: 'Ano Escolar' },
    { id: 'turma', label: 'Turma' },
    { id: 'escola', label: 'Escola' },
    { id: 'encarregado', label: 'Encarregado Educação' },
    { id: 'ee_email', label: 'Email Encarregado' },
    { id: 'ee_contacto', label: 'Contacto Encarregado' },
    { id: 'ee_parentesco', label: 'Parentesco' },
    { id: 'data_inicio', label: 'Data Início' },
];

// Nome de ficheiro seguro, com 'alunos' por omissão.
function normalizeFileName(fileName) {
    return normalizarNome(fileName, 'alunos');
}

// função para normalizar uma chave de cabeçalho, removendo acentos, convertendo para minúsculas, substituindo caracteres não alfanuméricos por underscores e removendo underscores extras no início e no fim, garantindo que as chaves sejam consistentes e fáceis de mapear para os campos esperados pela API
function normalizeHeaderKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// objeto que mapeia os campos esperados para o processo de importação para uma lista de aliases possíveis, permitindo que o sistema reconheça os campos mesmo que os cabeçalhos do arquivo de importação usem variações de nomenclatura, e garantindo que os dados sejam corretamente identificados e processados durante a importação
const IMPORT_FIELD_ALIASES = {
    nome_completo: ['nome_completo', 'nome', 'nome_aluno'],
    email: ['email', 'email_aluno'],
    data_nascimento: ['data_nascimento', 'data_nasc', 'nascimento'],
    cartao_cidadao: ['cartao_cidadao', 'cc', 'cartao'],
    nif: ['nif', 'nif_aluno'],
    morada: ['morada', 'endereco'],
    localidade: ['localidade', 'cidade'],
    codigo_postal: ['codigo_postal', 'cod_postal', 'cp'],
    telemovel: ['telemovel', 'celular'],
    telefone: ['telefone', 'telefone_fixo'],
    ano_escolar: ['ano_escolar', 'ano', 'ano_aluno'],
    turma: ['turma'],
    escola: ['escola'],
    ee_nome_completo: [
        'ee_nome_completo',
        'encarregado_nome',
        'nome_encarregado',
        'encarregado',
    ],
    ee_email: ['ee_email', 'email_encarregado'],
    ee_cartao_cidadao: ['ee_cartao_cidadao', 'cc_encarregado'],
    ee_nif: ['ee_nif', 'nif_encarregado'],
    ee_morada: ['ee_morada', 'morada_encarregado'],
    ee_localidade: ['ee_localidade', 'localidade_encarregado'],
    ee_codigo_postal: ['ee_codigo_postal', 'cod_postal_encarregado'],
    ee_telemovel: ['ee_telemovel', 'telemovel_encarregado'],
    ee_telefone: ['ee_telefone', 'telefone_encarregado'],
    ee_parentesco: ['ee_parentesco', 'parentesco'],
};

// função para normalizar uma data de importação, verificando se a string corresponde ao formato ISO (YYYY-MM-DD) ou ao formato português (DD/MM/YYYY), e convertendo para o formato ISO caso seja necessário, garantindo que as datas sejam processadas corretamente durante a importação, e retornando a string original caso o formato seja desconhecido ou inválido
function normalizeImportDate(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return raw;
    }

    const ptMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ptMatch) {
        const [, day, month, year] = ptMatch;
        return `${year}-${month}-${day}`;
    }

    return raw;
}

// função para mapear uma linha de dados importados para o formato esperado pela API, normalizando as chaves dos campos usando a função normalizeHeaderKey, e usando a função getValueForField para obter o valor correto para cada campo esperado, verificando os aliases definidos em IMPORT_FIELD_ALIASES, garantindo que os dados sejam corretamente identificados e processados durante a importação, mesmo que os cabeçalhos do arquivo de importação usem variações de nomenclatura ou estejam em uma ordem diferente
function mapImportRowToPayload(row) {
    const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [
        normalizeHeaderKey(key),
        value,
    ]);
    const normalizedMap = new Map(normalizedEntries);

    function getValueForField(fieldName) {
        const aliases = IMPORT_FIELD_ALIASES[fieldName] || [fieldName];

        for (const alias of aliases) {
            const value = normalizedMap.get(alias);
            if (value !== undefined && String(value).trim() !== '') {
                return String(value).trim();
            }
        }

        return '';
    }

    return {
        nome_completo: getValueForField('nome_completo'),
        email: getValueForField('email').toLowerCase(),
        data_nascimento: normalizeImportDate(
            getValueForField('data_nascimento')
        ),
        cartao_cidadao: getValueForField('cartao_cidadao'),
        nif: getValueForField('nif'),
        morada: getValueForField('morada'),
        localidade: getValueForField('localidade'),
        codigo_postal: getValueForField('codigo_postal'),
        telemovel: getValueForField('telemovel'),
        telefone: getValueForField('telefone'),
        ano_escolar: getValueForField('ano_escolar'),
        turma: getValueForField('turma'),
        escola: getValueForField('escola'),
        ee_nome_completo: getValueForField('ee_nome_completo'),
        ee_email: getValueForField('ee_email').toLowerCase(),
        ee_cartao_cidadao: getValueForField('ee_cartao_cidadao'),
        ee_nif: getValueForField('ee_nif'),
        ee_morada: getValueForField('ee_morada'),
        ee_localidade: getValueForField('ee_localidade'),
        ee_codigo_postal: getValueForField('ee_codigo_postal'),
        ee_telemovel: getValueForField('ee_telemovel'),
        ee_telefone: getValueForField('ee_telefone'),
        ee_parentesco: getValueForField('ee_parentesco'),
    };
}

// função para parsear um arquivo CSV usando a biblioteca PapaParse, lendo o conteúdo do arquivo como texto, corrigindo possíveis problemas de formatação nos cabeçalhos, tentando diferentes delimitadores (vírgula e ponto e vírgula) caso o resultado inicial seja inválido, e convertendo os dados para uma lista de objetos usando os cabeçalhos como chaves, garantindo que os dados sejam processados corretamente mesmo que o arquivo CSV tenha variações de formatação ou delimitadores
async function parseCsvFile(file) {
    const { default: Papa } = await import('papaparse');
    return new Promise((resolve, reject) => {
        file.text()
            .then((rawText) => {
                let csvText = String(rawText || '').replace(/^\uFEFF/, '');

                const lines = csvText.split(/\r?\n/);
                if (lines.length) {
                    let headerLine = lines[0];

                    // Corrige cabeçalhos malformados: "nome_completo,""email"",...
                    if (
                        headerLine.startsWith('"') &&
                        headerLine.includes('""')
                    ) {
                        headerLine = headerLine.replace(/""/g, '"');
                        headerLine = headerLine.replace(
                            /^"([^",\r\n]+),"/,
                            '"$1","'
                        );
                        headerLine = headerLine.replace(/""$/, '"');
                        lines[0] = headerLine;
                        csvText = lines.join('\n');
                    }
                }

                function parseMatrix(extraConfig = {}) {
                    return Papa.parse(csvText, {
                        header: false,
                        skipEmptyLines: true,
                        delimiter: '',
                        ...extraConfig,
                    });
                }

                let result = parseMatrix();

                if (
                    (!Array.isArray(result.data) || result.data.length === 0) &&
                    csvText.includes(';')
                ) {
                    result = parseMatrix({ delimiter: ';' });
                }

                const matrix = Array.isArray(result.data) ? result.data : [];

                if (matrix.length < 2) {
                    reject(
                        new Error(
                            'Erro ao ler ficheiro CSV. Verifique se o separador e os cabeçalhos estão corretos.'
                        )
                    );
                    return;
                }

                const headers = (matrix[0] || []).map((header) =>
                    String(header || '')
                        .trim()
                        .replace(/^"|"$/g, '')
                );

                const rows = matrix.slice(1).map((rowArray) => {
                    const rowObject = {};
                    headers.forEach((header, index) => {
                        rowObject[header] = rowArray?.[index] ?? '';
                    });
                    return rowObject;
                });

                const nonEmptyRows = rows.filter((row) =>
                    Object.values(row || {}).some(
                        (value) => String(value || '').trim() !== ''
                    )
                );

                if (!nonEmptyRows.length) {
                    reject(
                        new Error(
                            'Erro ao ler ficheiro CSV. Verifique se o separador e os cabeçalhos estão corretos.'
                        )
                    );
                    return;
                }

                resolve(nonEmptyRows);
            })
            .catch(() => {
                reject(new Error('Erro ao processar ficheiro CSV.'));
            });
    });
}

// Lê a primeira folha de um .xlsx como lista de objetos (cabeçalhos da primeira linha como chaves).
async function parseExcelFile(file) {
    const { lerPrimeiraFolha } = await import('../../../utils/excel');
    return lerPrimeiraFolha(await file.arrayBuffer());
}

// função para obter o valor a ser exportado para um campo específico de uma linha de dados, aplicando formatações especiais para campos como encarregado, data_inicio, data_nascimento e ano, e retornando o valor original para outros campos, garantindo que os dados sejam apresentados de forma legível e consistente no arquivo exportado
function getExportValue(row, fieldId) {
    if (fieldId === 'encarregado') {
        return getEncarregadoLabel(row.encarregado);
    }

    if (fieldId === 'data_inicio' || fieldId === 'data_nascimento') {
        return formatDate(row[fieldId]);
    }

    if (fieldId === 'ano') {
        return row.ano ? `${row.ano}o` : '';
    }

    return row[fieldId] ?? '';
}

async function exportRowsToPdf(rows, selectedFields, fileName) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);
    const selectedColumns = EXPORTABLE_FIELDS.filter((field) =>
        selectedFields.includes(field.id)
    );

    const doc = new jsPDF({ orientation: 'landscape' });
    const dateLabel = new Date().toLocaleDateString('pt-PT');

    doc.setFontSize(16);
    doc.text('Lista de Alunos', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Gerado em ${dateLabel}`, 14, 22);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
        startY: 28,
        head: [selectedColumns.map((c) => c.label)],
        body: rows.map((row) =>
            selectedColumns.map((c) => String(getExportValue(row, c.id)))
        ),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [248, 250, 252], textColor: [31, 41, 55], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    const suggestedName = `${normalizeFileName(fileName || 'alunos')}.pdf`;
    doc.save(suggestedName);
    return true;
}

export async function downloadAlunoFichaPdf(aluno) {
    const response = await apiGet(`/api/gestor/alunos/${aluno.id_aluno}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível obter a ficha do aluno.');
    }

    const { gerarFichaAlunoPdf } = await import('../../../utils/fichaAlunoPdf');
    gerarFichaAlunoPdf(data.aluno);
}

/**
 * Exporta as linhas no formato escolhido. Devolve { mensagem } ou { erro }.
 */
export async function exportarAlunos(rows, { formato, nomeFicheiro, campos }) {
    if (rows.length === 0) {
        return { erro: 'Nao existem alunos para exportar.' };
    }

    if (campos.length === 0) {
        return { erro: 'Selecione pelo menos um campo para exportar.' };
    }

    const selectedColumns = EXPORTABLE_FIELDS.filter((field) =>
        campos.includes(field.id)
    );

    if (formato === 'pdf') {
        await exportRowsToPdf(rows, campos, nomeFicheiro);
        return { mensagem: 'PDF exportado com sucesso.' };
    }

    const baseFileName = normalizeFileName(nomeFicheiro);

    if (formato === 'csv') {
        const header = selectedColumns.map((column) => column.id);
        const lines = rows.map((aluno) =>
            selectedColumns
                .map((column) => celulaCsv(getExportValue(aluno, column.id)))
                .join(',')
        );
        const csvData = [header.join(','), ...lines].join('\n');

        const saveResult = await saveBlobToDisk(
            new Blob([csvData], { type: 'text/csv;charset=utf-8;' }),
            baseFileName,
            'csv',
            'text/csv'
        );
        return resultadoExportacao(saveResult, 'CSV');
    }

    const { linhasParaXlsx } = await import('../../../utils/excel');
    const wsData = [
        selectedColumns.map((column) => column.label),
        ...rows.map((aluno) =>
            selectedColumns.map((column) => getExportValue(aluno, column.id))
        ),
    ];
    const saveResult = await saveBlobToDisk(
        await linhasParaXlsx(wsData, 'Alunos'),
        baseFileName,
        'xlsx',
        MIME_XLSX
    );
    return resultadoExportacao(saveResult, 'XLSX');
}

export function descarregarModeloAlunos(formato) {
    return descarregarModeloImportacao({
        formato,
        cabecalhos: IMPORT_TEMPLATE_HEADERS,
        exemplo: [
            'Ana Costa',
            'ana.costa@exemplo.pt',
            '2010-05-13',
            '12345678',
            '234567890',
            'Rua da Escola, 10',
            'Porto',
            '4000-100',
            '912345678',
            '220000000',
            '8',
            'A',
            'Escola Secundaria Centro',
            'Maria Costa',
            'maria.costa@exemplo.pt',
            '87654321',
            '198765432',
            'Rua da Escola, 10',
            'Porto',
            '4000-100',
            '934567890',
            '220000001',
            'Mae',
        ],
        nomeFicheiro: 'modelo-importacao-alunos',
        folha: 'Alunos',
    });
}

/**
 * Lê o ficheiro de importação e devolve { payloads } com as linhas válidas
 * (com os campos obrigatórios), ou { erro }.
 */
export async function lerAlunosParaImportar(ficheiro, formato) {
    const erroFicheiro = validarFicheiroImportacao(ficheiro, formato);
    if (erroFicheiro) {
        return { erro: erroFicheiro };
    }

    try {
        const rows =
            formato === 'csv'
                ? await parseCsvFile(ficheiro)
                : await parseExcelFile(ficheiro);

        if (!rows.length) {
            return { erro: 'O ficheiro não contém linhas para importar.' };
        }

        const payloads = rows
            .map(mapImportRowToPayload)
            .filter(
                (payload) =>
                    payload.nome_completo &&
                    payload.email &&
                    payload.data_nascimento &&
                    payload.ee_nome_completo
            );

        if (!payloads.length) {
            return {
                erro: 'Nenhuma linha válida encontrada. Campos obrigatórios: nome_completo, email, data_nascimento e ee_nome_completo.',
            };
        }

        return { payloads };
    } catch (importError) {
        return { erro: importError.message || 'Erro ao importar alunos.' };
    }
}

/**
 * Cria os alunos um a um. Devolve { successCount, failed }, com a linha do
 * ficheiro e o erro de cada falha.
 */
export async function importarAlunos(payloads) {
    let successCount = 0;
    const failed = [];

    for (let index = 0; index < payloads.length; index += 1) {
        try {
            const response = await apiPost('/api/gestor/alunos', payloads[index]);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao criar aluno.');
            }

            successCount += 1;
        } catch (importError) {
            failed.push({ linha: index + 2, erro: importError.message });
        }
    }

    return { successCount, failed };
}
