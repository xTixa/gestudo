import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Search,
    Download,
    FileSearch,
    Upload,
    Plus,
    Eye,
    EyeOff,
    Trash,
    MoreVertical,
    Pencil,
    X,
    UserRound,
    Users,
    Funnel,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import { read, utils, write } from 'xlsx';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../../utils/api';
import { gerarFichaAlunoPdf } from '../../../utils/fichaAlunoPdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

// função para formatar uma data em formato ISO para o formato de data local em português, usando o método toLocaleDateString com a localidade 'pt-PT', e retornando uma string vazia caso a data seja inválida ou não fornecida
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-PT');
}

// função para formatar um valor numérico como moeda em euros, usando o Intl.NumberFormat com a localidade 'pt-PT' e o estilo 'currency', e retornando '€0,00' caso o valor seja nulo ou indefinido
function formatCurrency(value) {
    if (value === null || value === undefined) return '€0,00';
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
    }).format(value);
}

// função para converter uma string de tempo no formato "HH:MM" para o total de minutos, dividindo a string em horas e minutos, convertendo-os para números e calculando o total em minutos, retornando 0 caso a string seja inválida ou não fornecida
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// função para formatar a duração entre um horário de início e um horário de fim, calculando a diferença em minutos usando a função parseTimeToMinutes, e formatando o resultado como uma string no formato "XhYm" ou "Xh" caso os minutos sejam zero, retornando uma string vazia caso os horários sejam inválidos ou a diferença seja negativa
function formatDurationLabel(horaInicio, horaFim) {
    if (!horaInicio || !horaFim) return '';
    const inicio = parseTimeToMinutes(horaInicio);
    const fim = parseTimeToMinutes(horaFim);
    const diff = fim - inicio;
    if (diff <= 0) return '';
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}`;
}

// função para obter a URL da imagem de perfil de um aluno, verificando várias propriedades do objeto aluno em ordem de prioridade, e construindo a URL completa usando a variável API_URL caso a imagem seja fornecida como um caminho relativo, retornando uma string vazia caso nenhuma imagem seja encontrada ou o valor seja inválido
function getAlunoProfileImage(aluno) {
    const raw =
        aluno?.imagem_perfil_url ||
        aluno?.pessoa?.imagem_perfil_url ||
        aluno?.pessoa?.user?.imagem_perfil_url ||
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

// função para obter o nome de um aluno, verificando várias propriedades do objeto aluno em ordem de prioridade, e retornando uma string limpa e formatada, ou '-' caso nenhuma propriedade contenha um nome válido
function getAlunoNome(aluno) {
    const nome = String(aluno?.nome || aluno?.pessoa?.nome || '').trim();
    return nome || '-';
}

// função para obter o NIF de um aluno, verificando várias propriedades do objeto aluno em ordem de prioridade, e retornando uma string limpa e formatada, ou '-' caso nenhuma propriedade contenha um NIF válido
function getAlunoNif(aluno) {
    const nif = String(aluno?.nif || aluno?.pessoa?.nif || '').trim();
    return nif || '-';
}

// função para obter o rótulo do encarregado de educação de um aluno, verificando várias propriedades do objeto encarregado em ordem de prioridade, e retornando uma string limpa e formatada, ou '-' caso nenhuma propriedade contenha um nome ou email válido
function getEncarregadoLabel(value) {
    if (value === null || value === undefined) return '-';

    if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        return text || '-';
    }

    if (typeof value === 'object') {
        const nomePessoa = String(value?.pessoa?.nome || '').trim();
        if (nomePessoa) return nomePessoa;

        const emailPessoa = String(value?.pessoa?.user?.email || '').trim();
        if (emailPessoa) return emailPessoa;

        const nomeDireto = String(value?.nome || '').trim();
        if (nomeDireto) return nomeDireto;
    }

    return '-';
}

// opções de formato para exportação de dados, com identificadores, rótulos legíveis e extensões de arquivo correspondentes, usadas para configurar o processo de exportação e para validar os arquivos selecionados pelo usuário
const EXPORT_FORMAT_OPTIONS = [
    { id: 'csv', label: 'CSV', extension: 'csv' },
    { id: 'excel', label: 'Excel', extension: 'xlsx' },
    { id: 'pdf', label: 'PDF', extension: 'pdf' },
];

// opções de formato para importação de dados, com identificadores, rótulos legíveis e extensões de arquivo correspondentes, usadas para configurar o processo de importação e para validar os arquivos selecionados pelo usuário
const IMPORT_FORMAT_OPTIONS = [
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
const EXPORTABLE_FIELDS = [
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

// função para escapar caracteres especiais em uma string, substituindo caracteres como &, <, >, " e ' por suas entidades HTML correspondentes, garantindo que os dados sejam exibidos corretamente em contextos HTML e evitando problemas de formatação ou segurança
function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// função para normalizar um nome de arquivo, removendo espaços em branco, substituindo caracteres inválidos por hífens e garantindo que o nome resultante seja seguro para uso como nome de arquivo, retornando 'alunos' como nome padrão caso o resultado seja vazio ou inválido
function normalizeFileName(fileName) {
    const clean = (fileName || 'alunos').trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    return clean || 'alunos';
}

// função para obter a string de aceitação de arquivos para um formato específico, retornando as extensões e tipos MIME correspondentes para os formatos CSV, Excel e PDF, usados para configurar os inputs de arquivo e validar os arquivos selecionados pelo usuário
function getFileAcceptByFormat(format) {
    if (format === 'csv') {
        return '.csv,text/csv';
    }

    if (format === 'excel') {
        return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return '.pdf,application/pdf';
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
function parseCsvFile(file) {
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

// função para parsear um arquivo Excel usando a biblioteca SheetJS (xlsx), lendo o conteúdo do arquivo como um array buffer, carregando o workbook, selecionando a primeira planilha, e convertendo os dados para uma lista de objetos usando os cabeçalhos da planilha como chaves, garantindo que os dados sejam processados corretamente mesmo que o arquivo Excel tenha variações de formatação ou estrutura
async function parseExcelFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    return utils.sheet_to_json(worksheet, {
        defval: '',
    });
}

// função para salvar um blob no disco do usuário, usando a API File System Access se disponível para oferecer uma experiência de salvamento mais integrada, e caindo para o método tradicional de criar um link de download caso a API não esteja disponível ou o usuário cancele a ação, garantindo que o arquivo seja salvo corretamente e que o nome sugerido seja usado
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

function exportRowsToPdf(rows, selectedFields, fileName) {
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

async function downloadAlunoFichaPdf(aluno) {
    const response = await apiGet(`/api/gestor/alunos/${aluno.id_aluno}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível obter a ficha do aluno.');
    }

    gerarFichaAlunoPdf(data.aluno);
}

export default function GestaoAlunos() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [alunoSelecionado, setAlunoSelecionado] = useState(null);
    const [alunoFullData, setAlunoFullData] = useState(null);
    const [loadingModalData, setLoadingModalData] = useState(false);
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const dropdownRef = useRef(null);
    const [exportFormat, setExportFormat] = useState('csv');
    const [importFormat, setImportFormat] = useState('csv');
    const [selectedExportFields, setSelectedExportFields] = useState(
        EXPORTABLE_FIELDS.map((field) => field.id)
    );
    const [importing, setImporting] = useState(false);
    const [exportFileName, setExportFileName] = useState('alunos');
    const [selectedImportFile, setSelectedImportFile] = useState(null);
    const [actionMessage, setActionMessage] = useState('');
    const [actionError, setActionError] = useState('');
    const [rowConfirmModal, setRowConfirmModal] = useState({
        open: false,
        mode: null,
        aluno: null,
        keyword: '',
    });
    const [rowActionLoading, setRowActionLoading] = useState(false);
    const [filters, setFilters] = useState({
        search: '',
        ano: 'Todos',
        escola: 'Todos',
    });
    const [sort, setSort] = useState({ field: null, dir: 'asc' });

    function handleSort(field) {
        setSort((prev) =>
            prev.field === field
                ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { field, dir: 'asc' }
        );
    }

    const filterOptions = useMemo(
        () => ({
            ano: uniqueValues(alunos, 'ano'),
            escola: uniqueValues(alunos, 'escola'),
        }),
        [alunos]
    );

    function updateFilter(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }

    useEffect(() => {
        updateFilter('search', searchParams.get('q') || '');
    }, [searchParams]);

    useEffect(() => {
        let isMounted = true;

        async function carregarAlunos() {
            setLoading(true);
            setError('');

            try {
                const response = await apiGet('/api/gestor/alunos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Não foi possível obter alunos.'
                    );
                }

                if (isMounted) {
                    setAlunos(data.alunos || []);
                }
            } catch (fetchError) {
                if (isMounted) {
                    setError(fetchError.message || 'Erro ao carregar alunos.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregarAlunos();

        return () => {
            isMounted = false;
        };
    }, []);

    const alunosFiltrados = useMemo(() => {
        const term = filters.search.trim().toLowerCase();

        const filtered = alunos.filter((aluno) => {
            const matchesSearch =
                !term ||
                [aluno.nome, aluno.nif, aluno.ano, aluno.escola].some((value) =>
                    String(value).toLowerCase().includes(term)
                );

            const matchesAno =
                filters.ano === 'Todos' ||
                String(aluno.ano) === String(filters.ano);
            const matchesEscola =
                filters.escola === 'Todos' || aluno.escola === filters.escola;

            return matchesSearch && matchesAno && matchesEscola;
        });

        if (!sort.field) return filtered;
        const mod = sort.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            let av = a[sort.field];
            let bv = b[sort.field];
            if (av == null && bv == null) return 0;
            if (av == null) return mod;
            if (bv == null) return -mod;
            if (typeof av === 'string' && /^\d{4}-\d{2}-\d{2}/.test(av))
                return (new Date(av) - new Date(bv)) * mod;
            if (!isNaN(Number(av)) && !isNaN(Number(bv)))
                return (Number(av) - Number(bv)) * mod;
            return String(av).localeCompare(String(bv), 'pt') * mod;
        });
    }, [alunos, filters, sort]);

    useEffect(() => {
        if (!alunoSelecionado) {
            setAlunoFullData(null);
            return;
        }

        let isMounted = true;

        async function loadFullAlunoData() {
            setLoadingModalData(true);
            try {
                const response = await apiGet(
                    `/api/gestor/alunos/${alunoSelecionado.id_aluno}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error('Erro ao carregar dados do aluno');
                }

                if (isMounted) {
                    setAlunoFullData({
                        ...alunoSelecionado,
                        ...(data.aluno || {}),
                    });
                }
            } catch {
                if (isMounted) {
                    setAlunoFullData(alunoSelecionado);
                }
            } finally {
                if (isMounted) {
                    setLoadingModalData(false);
                }
            }
        }

        loadFullAlunoData();

        return () => {
            isMounted = false;
        };
    }, [alunoSelecionado]);

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

    function handleOpenDropdown(event, aluno) {
        if (openDropdown?.id === aluno.id_aluno) {
            setOpenDropdown(null);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const dropdownWidth = 192; // w-48
        const left =
            rect.left + dropdownWidth > window.innerWidth
                ? Math.max(8, rect.right - dropdownWidth)
                : rect.left;
        setDropdownPos({
            top: rect.bottom + 4,
            left,
            triggerTop: rect.top,
            triggerBottom: rect.bottom,
        });
        setOpenDropdown({ id: aluno.id_aluno, aluno });
    }

    useLayoutEffect(() => {
        if (openDropdown === null || !dropdownRef.current) return;

        const height = dropdownRef.current.getBoundingClientRect().height;

        setDropdownPos((prev) => {
            if (prev.triggerBottom == null) return prev;

            const spaceBelow = window.innerHeight - prev.triggerBottom;
            const fitsBelow = spaceBelow >= height + 8;

            if (fitsBelow) return prev;

            const openUpwardTop = prev.triggerTop - height - 4;
            return {
                ...prev,
                top: Math.max(8, openUpwardTop),
            };
        });
    }, [openDropdown]);

    const modalAluno = alunoFullData || alunoSelecionado;
    const modalAlunoImage = getAlunoProfileImage(modalAluno);

    async function handleExportSubmit(event) {
        event.preventDefault();
        setActionMessage('');
        setActionError('');

        if (alunosFiltrados.length === 0) {
            setActionError('Nao existem alunos para exportar.');
            return;
        }

        if (selectedExportFields.length === 0) {
            setActionError('Selecione pelo menos um campo para exportar.');
            return;
        }

        const selectedColumns = EXPORTABLE_FIELDS.filter((field) =>
            selectedExportFields.includes(field.id)
        );

        if (exportFormat === 'pdf') {
            exportRowsToPdf(alunosFiltrados, selectedExportFields, exportFileName);
            setActionMessage('PDF exportado com sucesso.');
            setShowExportModal(false);
            return;
        }

        const baseFileName = normalizeFileName(exportFileName);

        if (exportFormat === 'csv') {
            const header = selectedColumns.map((column) => column.id);
            const lines = alunosFiltrados.map((aluno) =>
                selectedColumns
                    .map((column) => getExportValue(aluno, column.id))
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

        const wsData = [
            selectedColumns.map((column) => column.label),
            ...alunosFiltrados.map((aluno) =>
                selectedColumns.map((column) => getExportValue(aluno, column.id))
            ),
        ];
        const worksheet = utils.aoa_to_sheet(wsData);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Alunos');
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

    async function refreshAlunos() {
        const response = await apiGet('/api/gestor/alunos');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Erro ao atualizar lista de alunos.'
            );
        }

        setAlunos(data.alunos || []);
    }

    function abrirConfirmacaoLinha(mode, aluno) {
        setRowConfirmModal({ open: true, mode, aluno, keyword: '' });
    }

    function fecharConfirmacaoLinha() {
        if (rowActionLoading) return;
        setRowConfirmModal({ open: false, mode: null, aluno: null, keyword: '' });
    }

    async function confirmarAcaoLinha() {
        const { mode, aluno } = rowConfirmModal;
        if (!aluno) return;

        if (mode === 'delete' && rowConfirmModal.keyword !== 'ELIMINAR') {
            setActionError('Confirmação inválida. Escreve ELIMINAR para continuar.');
            return;
        }

        setRowActionLoading(true);
        setActionError('');
        setActionMessage('');

        try {
            if (mode === 'delete') {
                const response = await apiDelete(
                    `/api/gestor/alunos/${aluno.id_aluno}`
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Não foi possível eliminar o aluno.'
                    );
                }

                setActionMessage(
                    data?.message || 'Aluno eliminado definitivamente.'
                );
            } else {
                const novoStatus = !aluno.status;
                const response = await apiPatch(
                    `/api/gestor/alunos/${aluno.id_aluno}/status`,
                    { status: novoStatus }
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Não foi possível alterar o estado do aluno.'
                    );
                }

                setActionMessage(
                    data?.message ||
                        (novoStatus
                            ? 'Aluno reativado com sucesso.'
                            : 'Aluno colocado em stand by com sucesso.')
                );
            }

            await refreshAlunos();
            setRowConfirmModal({ open: false, mode: null, aluno: null, keyword: '' });
        } catch (err) {
            setActionError(err?.message || 'Não foi possível concluir a ação.');
        } finally {
            setRowActionLoading(false);
        }
    }

    async function handleDownloadImportTemplate() {
        setActionMessage('');
        setActionError('');

        const sampleRow = [
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
                'modelo-importacao-alunos',
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
        utils.book_append_sheet(workbook, worksheet, 'Alunos');

        const excelArrayBuffer = write(workbook, {
            bookType: 'xlsx',
            type: 'array',
        });

        const saveResult = await saveBlobToDisk(
            new Blob([excelArrayBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
            'modelo-importacao-alunos',
            'xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        if (saveResult === 'cancelled') {
            setActionError('Download do modelo cancelado.');
            return;
        }

        setActionMessage('Modelo Excel descarregado com sucesso.');
    }

    async function handleImportSubmit(event) {
        event.preventDefault();
        setActionMessage('');
        setActionError('');

        if (!selectedImportFile) {
            setActionError('Selecione um ficheiro para importar.');
            return;
        }

        const fileName = selectedImportFile.name.toLowerCase();
        const isCsv = fileName.endsWith('.csv');
        const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

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

        setImporting(true);

        try {
            const rows =
                importFormat === 'csv'
                    ? await parseCsvFile(selectedImportFile)
                    : await parseExcelFile(selectedImportFile);

            if (!rows.length) {
                setActionError('O ficheiro não contém linhas para importar.');
                return;
            }

            const payloads = rows.map(mapImportRowToPayload);
            const validPayloads = payloads.filter(
                (payload) =>
                    payload.nome_completo &&
                    payload.email &&
                    payload.data_nascimento &&
                    payload.ee_nome_completo
            );

            if (!validPayloads.length) {
                setActionError(
                    'Nenhuma linha válida encontrada. Campos obrigatórios: nome_completo, email, data_nascimento e ee_nome_completo.'
                );
                return;
            }

            let successCount = 0;
            const failed = [];

            for (let index = 0; index < validPayloads.length; index += 1) {
                const payload = validPayloads[index];

                try {
                    const response = await apiPost(
                        '/api/gestor/alunos',
                        payload
                    );
                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Erro ao criar aluno.');
                    }

                    successCount += 1;
                } catch (importError) {
                    failed.push({
                        linha: index + 2,
                        erro: importError.message,
                    });
                }
            }

            await refreshAlunos();

            if (failed.length) {
                const firstErrors = failed
                    .slice(0, 3)
                    .map((item) => `linha ${item.linha}: ${item.erro}`)
                    .join(' | ');

                setActionError(
                    `${failed.length} registo(s) falharam (${firstErrors}).`
                );
            }

            setActionMessage(
                `${successCount} aluno(s) importado(s) com sucesso.`
            );
            setShowImportModal(false);
            setSelectedImportFile(null);
        } catch (importError) {
            setActionError(importError.message || 'Erro ao importar alunos.');
        } finally {
            setImporting(false);
        }
    }

    return (
        <div className="space-y-5">
            <AdminPageHeader
                eyebrow="Alunos"
                title="Gestão de Alunos"
                subtitle="Gerir informações dos alunos e encarregados de educação"
                icon={Users}
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
                            onClick={() => navigate('/gestor/alunos/addAluno')}
                            className="flex items-center gap-2 rounded-lg bg-[#14ad81] px-4 py-2 text-sm text-white hover:bg-[#0f8d69]"
                        >
                            <Plus size={16} />
                            Novo Aluno
                        </button>
                    </div>
                }
            />

            {actionMessage ? (
                <p className="mt-4 text-sm text-emerald-700">{actionMessage}</p>
            ) : null}
            {actionError ? (
                <p className="mt-4 text-sm text-red-600">{actionError}</p>
            ) : null}

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
                                placeholder="Pesquisar em nome, NIF, ano..."
                                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-spindle"
                            />
                        </div>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Ano Escolar
                        </span>
                        <select
                            value={filters.ano}
                            onChange={(event) =>
                                updateFilter('ano', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.ano.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1 block text-xs text-slate-500">
                            Escola
                        </span>
                        <select
                            value={filters.escola}
                            onChange={(event) =>
                                updateFilter('escola', event.target.value)
                            }
                            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-spindle"
                        >
                            {filterOptions.escola.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                {error ? (
                    <p className="mb-4 text-sm text-red-600">{error}</p>
                ) : null}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 border-b">
                            <tr>
                                {[
                                    { label: 'Nome Completo', field: 'nome' },
                                    { label: 'NIF', field: 'nif' },
                                    { label: 'Ano Escolar', field: 'ano' },
                                    { label: 'Escola', field: 'escola' },
                                    { label: 'Encarregado Educação', field: null },
                                    { label: 'Contacto', field: null },
                                    { label: 'Data Início', field: 'data_inicio' },
                                ].map(({ label, field }) =>
                                    field ? (
                                        <th
                                            key={label}
                                            className="py-3 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                                            onClick={() => handleSort(field)}
                                        >
                                            <span className="flex items-center gap-1">
                                                {label}
                                                {sort.field === field ? (
                                                    sort.dir === 'asc' ? <ChevronUp size={13} className="text-indigo-500 shrink-0" /> : <ChevronDown size={13} className="text-indigo-500 shrink-0" />
                                                ) : (
                                                    <ChevronsUpDown size={13} className="opacity-30 shrink-0" />
                                                )}
                                            </span>
                                        </th>
                                    ) : (
                                        <th key={label} className="py-3">{label}</th>
                                    )
                                )}
                                <th className="text-center py-3">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        A carregar alunos...
                                    </td>
                                </tr>
                            ) : null}

                            {!loading
                                ? alunosFiltrados.map((aluno) => (
                                      <tr
                                          key={aluno.id_aluno}
                                          className={`border-b transition ${
                                              aluno.status === false
                                                  ? 'bg-slate-100 text-slate-500 shadow-inner opacity-75 hover:bg-slate-100'
                                                  : 'hover:bg-gray-50'
                                          }`}
                                      >
                                          <td
                                              className={`py-3 font-medium ${
                                                  aluno.status === false
                                                      ? 'text-slate-500'
                                                      : 'text-gray-800'
                                              }`}
                                          >
                                              {aluno.nome}
                                          </td>
                                          <td>{aluno.nif}</td>
                                          <td>{aluno.ano}º</td>
                                          <td>{aluno.escola}</td>
                                          <td>
                                              {getEncarregadoLabel(
                                                  aluno.encarregado
                                              )}
                                          </td>
                                          <td>{aluno.contacto}</td>
                                          <td>
                                              {new Date(
                                                  aluno.data_inicio
                                              ).toLocaleDateString('pt-PT')}
                                          </td>
                                          <td className="flex justify-center gap-3 py-3">
                                              <button
                                                  className="text-gray-500 hover:text-sky-600"
                                                  title="Preview aluno"
                                                  onClick={() =>
                                                      setAlunoSelecionado(aluno)
                                                  }
                                              >
                                                  <FileSearch size={16} />
                                              </button>
                                              <button
                                                  className="text-gray-500 hover:text-indigo-600"
                                                  title="Ações"
                                                  onClick={(e) => handleOpenDropdown(e, aluno)}
                                              >
                                                  <MoreVertical size={16} />
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                                : null}

                            {!loading && alunosFiltrados.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-6 text-gray-400"
                                    >
                                        Nenhum aluno encontrado.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>

            {alunoSelecionado ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">
                                    Ficha do Aluno
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Preview rápida dos dados.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setAlunoSelecionado(null)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Fechar ficha"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto">
                            {loadingModalData ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="text-slate-500">
                                        Carregando dados...
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-4 px-5 py-5 text-sm border-b border-slate-200">
                                        <div className="flex items-center gap-4 pb-2">
                                            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                                                {modalAlunoImage ? (
                                                    <img
                                                        src={modalAlunoImage}
                                                        alt="Foto de perfil do aluno"
                                                        className="h-full w-full object-cover"
                                                        onError={(event) => {
                                                            const img =
                                                                event.currentTarget;
                                                            img.style.display =
                                                                'none';
                                                            const fallback =
                                                                img.parentElement?.querySelector(
                                                                    '[data-modal-profile-fallback="1"]'
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
                                                    data-modal-profile-fallback="1"
                                                    className={
                                                        modalAlunoImage
                                                            ? 'hidden'
                                                            : ''
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
                                                    {getAlunoNome(modalAluno)}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Preview rápida do aluno
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <p className="text-slate-700">
                                                <strong>Nome:</strong>{' '}
                                                {getAlunoNome(modalAluno)}
                                            </p>
                                            <p className="text-slate-700">
                                                <strong>NIF:</strong>{' '}
                                                {getAlunoNif(modalAluno)}
                                            </p>
                                            <p className="text-slate-700">
                                                <strong>Ano Escolar:</strong>{' '}
                                                {modalAluno.ano}º
                                            </p>
                                            <p className="text-slate-700">
                                                <strong>Escola:</strong>{' '}
                                                {modalAluno.escola}
                                            </p>
                                            <p className="text-slate-700">
                                                <strong>Encarregado:</strong>{' '}
                                                {getEncarregadoLabel(
                                                    modalAluno.encarregado
                                                )}
                                            </p>
                                            <p className="text-slate-700">
                                                <strong>Contacto:</strong>{' '}
                                                {modalAluno.contacto}
                                            </p>
                                            <p className="text-slate-700 md:col-span-2">
                                                <strong>Data de Início:</strong>{' '}
                                                {formatDate(
                                                    modalAluno.data_inicio
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {alunoFullData?.servicosSubscritos &&
                                    alunoFullData.servicosSubscritos.length >
                                        0 ? (
                                        <div className="px-5 py-4 border-t border-slate-200">
                                            <h3 className="font-semibold text-slate-800 mb-3">
                                                Serviços Subscritos
                                            </h3>
                                            <div className="space-y-3">
                                                {alunoFullData.servicosSubscritos.map(
                                                    (servico, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                                                        >
                                                            <p className="font-semibold text-slate-800 mb-2">
                                                                {servico.tipo_servico ||
                                                                    servico.modalidade ||
                                                                    'Serviço'}
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                                                                {servico.modalidade && (
                                                                    <p>
                                                                        <strong>
                                                                            Modalidade:
                                                                        </strong>{' '}
                                                                        {
                                                                            servico.modalidade
                                                                        }
                                                                    </p>
                                                                )}
                                                                {servico.disciplina && (
                                                                    <p>
                                                                        <strong>
                                                                            Disciplina:
                                                                        </strong>{' '}
                                                                        {
                                                                            servico.disciplina
                                                                        }
                                                                    </p>
                                                                )}
                                                                {servico.valor !==
                                                                    null && (
                                                                    <p>
                                                                        <strong>
                                                                            Preço:
                                                                        </strong>{' '}
                                                                        {formatCurrency(
                                                                            servico.valor
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {servico.horaInicio &&
                                                                    servico.horaFim && (
                                                                        <p>
                                                                            <strong>
                                                                                Duração:
                                                                            </strong>{' '}
                                                                            {formatDurationLabel(
                                                                                servico.horaInicio,
                                                                                servico.horaFim
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                {servico.dataInscricao && (
                                                                    <p>
                                                                        <strong>
                                                                            Data
                                                                            Inscrição:
                                                                        </strong>{' '}
                                                                        {formatDate(
                                                                            servico.dataInscricao
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {servico.dataInicio && (
                                                                    <p>
                                                                        <strong>
                                                                            Data
                                                                            Início:
                                                                        </strong>{' '}
                                                                        {formatDate(
                                                                            servico.dataInicio
                                                                        )}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ) : loadingModalData === false ? (
                                        <div className="px-5 py-4 border-t border-slate-200 text-center text-slate-500">
                                            Não existem serviços subscritos para
                                            este aluno.
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>

                        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setAlunoSelecionado(null)}
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
                                    Exportar alunos
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
                                    {EXPORT_FORMAT_OPTIONS.map((option) => (
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
                                    placeholder="alunos"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-700">
                                    Dados a exportar
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {EXPORTABLE_FIELDS.map((field) => {
                                        const checked =
                                            selectedExportFields.includes(
                                                field.id
                                            );

                                        return (
                                            <label
                                                key={field.id}
                                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        if (
                                                            event.target.checked
                                                        ) {
                                                            setSelectedExportFields(
                                                                (current) => [
                                                                    ...current,
                                                                    field.id,
                                                                ]
                                                            );
                                                            return;
                                                        }

                                                        setSelectedExportFields(
                                                            (current) =>
                                                                current.filter(
                                                                    (id) =>
                                                                        id !==
                                                                        field.id
                                                                )
                                                        );
                                                    }}
                                                    className="h-4 w-4 rounded border-slate-300"
                                                />
                                                {field.label}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <p className="text-xs text-slate-500">
                                Nos browsers compatíveis, poderá escolher a
                                pasta de gravação. Caso contrário, o ficheiro
                                será descarregado automaticamente.
                            </p>

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
                                    Importar alunos
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
                                        setSelectedImportFile(
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
                            navigate(`/gestor/alunos/ficha/${openDropdown.id}`);
                            setOpenDropdown(null);
                        }}
                    >
                        <UserRound size={14} />
                        Ver ficha completa
                    </button>
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                            navigate(`/gestor/alunos/update/${openDropdown.id}`);
                            setOpenDropdown(null);
                        }}
                    >
                        <Pencil size={14} />
                        Editar
                    </button>
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={async () => {
                            const aluno = openDropdown.aluno;
                            setOpenDropdown(null);
                            try {
                                await downloadAlunoFichaPdf(aluno);
                            } catch (err) {
                                setActionError(
                                    err?.message ||
                                        'Não foi possível gerar o PDF da ficha.'
                                );
                            }
                        }}
                    >
                        <Download size={14} />
                        Download
                    </button>
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                            const aluno = openDropdown.aluno;
                            setOpenDropdown(null);
                            abrirConfirmacaoLinha('status', aluno);
                        }}
                    >
                        {openDropdown.aluno.status ? (
                            <EyeOff size={14} />
                        ) : (
                            <Eye size={14} />
                        )}
                        {openDropdown.aluno.status ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        onClick={() => {
                            const aluno = openDropdown.aluno;
                            setOpenDropdown(null);
                            abrirConfirmacaoLinha('delete', aluno);
                        }}
                    >
                        <Trash size={14} />
                        Eliminar definitivamente
                    </button>
                </div>
            )}

            {rowConfirmModal.open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45"
                        onClick={fecharConfirmacaoLinha}
                        aria-label="Fechar confirmação"
                    />

                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Confirmação
                            </p>
                            <h3
                                className={`mt-1 text-lg font-semibold ${
                                    rowConfirmModal.mode === 'delete'
                                        ? 'text-red-700'
                                        : 'text-slate-800'
                                }`}
                            >
                                {rowConfirmModal.mode === 'delete'
                                    ? 'Eliminar aluno definitivamente?'
                                    : rowConfirmModal.aluno?.status
                                      ? 'Colocar aluno em stand by?'
                                      : 'Reativar aluno?'}
                            </h3>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            <p className="text-sm text-slate-600">
                                {rowConfirmModal.mode === 'delete'
                                    ? 'Esta ação é irreversível e remove os dados do aluno. Para continuar, confirma explicitamente abaixo.'
                                    : rowConfirmModal.aluno?.status
                                      ? 'O aluno ficará inativo e deixará de aceder à plataforma até ser reativado.'
                                      : 'O aluno volta a ter acesso à plataforma.'}
                            </p>

                            {rowConfirmModal.mode === 'delete' ? (
                                <div className="space-y-2">
                                    <label
                                        htmlFor="confirmar-eliminar-aluno-linha"
                                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                    >
                                        Escreve ELIMINAR para confirmar
                                    </label>
                                    <input
                                        id="confirmar-eliminar-aluno-linha"
                                        type="text"
                                        value={rowConfirmModal.keyword}
                                        onChange={(event) =>
                                            setRowConfirmModal((prev) => ({
                                                ...prev,
                                                keyword: event.target.value || '',
                                            }))
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                        placeholder="ELIMINAR"
                                        autoComplete="off"
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={fecharConfirmacaoLinha}
                                disabled={rowActionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                                    rowConfirmModal.mode === 'delete'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-amber-600 hover:bg-amber-700'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                onClick={confirmarAcaoLinha}
                                disabled={
                                    rowActionLoading ||
                                    (rowConfirmModal.mode === 'delete' &&
                                        rowConfirmModal.keyword !== 'ELIMINAR')
                                }
                            >
                                {rowActionLoading
                                    ? 'A processar...'
                                    : rowConfirmModal.mode === 'delete'
                                      ? 'Eliminar definitivamente'
                                      : rowConfirmModal.aluno?.status
                                        ? 'Confirmar stand by'
                                        : 'Confirmar reativação'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
