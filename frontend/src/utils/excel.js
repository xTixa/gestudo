// Leitura e escrita de ficheiros Excel (.xlsx) com exceljs.
// A biblioteca só é carregada quando é usada (import dinâmico), para não
// pesar no carregamento inicial da aplicação.

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function carregarExcelJS() {
    const mod = await import('exceljs');
    return mod.default ?? mod;
}

function dataIso(data) {
    // O exceljs devolve as datas das células em UTC.
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/**
 * Valor "simples" de uma célula: texto, número, booleano ou data em
 * AAAA-MM-DD. Fórmulas dão o resultado; texto formatado e links dão o texto.
 */
export function valorCelula(valor) {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) return dataIso(valor);
    if (typeof valor !== 'object') return valor;
    if ('result' in valor) return valorCelula(valor.result);
    if (Array.isArray(valor.richText)) return valor.richText.map((parte) => parte.text).join('');
    if ('text' in valor) return valorCelula(valor.text);
    if ('error' in valor) return '';
    return String(valor);
}

/**
 * Lê a primeira folha e devolve uma lista de objetos, usando a primeira
 * linha como cabeçalho. Células vazias ficam '' e linhas vazias são
 * ignoradas.
 */
export async function lerPrimeiraFolha(arrayBuffer) {
    const ExcelJS = await carregarExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const folha = workbook.worksheets[0];
    if (!folha) return [];

    const cabecalhos = [];
    folha.getRow(1).eachCell({ includeEmpty: true }, (celula, coluna) => {
        cabecalhos[coluna] = String(valorCelula(celula.value)).trim();
    });

    const linhas = [];
    folha.eachRow({ includeEmpty: false }, (linha, numero) => {
        if (numero === 1) return;
        const objeto = {};
        let temValores = false;
        cabecalhos.forEach((cabecalho, coluna) => {
            if (!cabecalho) return;
            const valor = valorCelula(linha.getCell(coluna).value);
            if (valor !== '') temValores = true;
            objeto[cabecalho] = valor;
        });
        if (temValores) linhas.push(objeto);
    });
    return linhas;
}

/**
 * Cria um .xlsx a partir de uma lista de linhas (a primeira é o cabeçalho,
 * que fica a negrito). Devolve um Blob.
 */
export async function linhasParaXlsx(linhas, nomeFolha = 'Folha1') {
    const ExcelJS = await carregarExcelJS();
    const workbook = new ExcelJS.Workbook();
    // O Excel não aceita estes caracteres nem nomes com mais de 31.
    const folha = workbook.addWorksheet(String(nomeFolha).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    linhas.forEach((linha) => folha.addRow(linha));

    if (linhas.length) {
        folha.getRow(1).font = { bold: true };
        folha.columns.forEach((coluna) => {
            let largura = 10;
            coluna.eachCell({ includeEmpty: false }, (celula) => {
                largura = Math.max(largura, String(celula.value ?? '').length + 2);
            });
            coluna.width = Math.min(largura, 50);
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: XLSX_MIME });
}

export function descarregarBlob(blob, nomeFicheiro) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeFicheiro;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
