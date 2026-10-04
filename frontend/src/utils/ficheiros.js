// Gravação de ficheiros gerados no browser (exportações, modelos de
// importação) e helpers comuns aos formulários de importação.

export const MIME_XLSX =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Nome de ficheiro seguro: sem espaços nem caracteres especiais.
export function normalizeFileName(fileName, porOmissao = 'ficheiro') {
    const clean = (fileName || porOmissao)
        .trim()
        .replace(/[^a-zA-Z0-9-_]/g, '-');
    return clean || porOmissao;
}

// Valor de "accept" do input de ficheiro para cada formato.
export function getFileAcceptByFormat(format) {
    if (format === 'csv') {
        return '.csv,text/csv';
    }

    if (format === 'excel') {
        return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return '.pdf,application/pdf';
}

// Célula de CSV entre aspas, com as aspas internas duplicadas.
export function celulaCsv(value) {
    return `"${String(value || '').replaceAll('"', '""')}"`;
}

/**
 * Grava um blob no disco. Usa o seletor de ficheiros do browser quando
 * existe (File System Access API) e, senão, descarrega diretamente.
 * Devolve 'saved', 'downloaded' ou 'cancelled'.
 */
export async function saveBlobToDisk(blob, fileName, extension, mimeType) {
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

// Mensagem para o utilizador depois de gravar uma exportação.
export function resultadoExportacao(saveResult, tipo) {
    if (saveResult === 'cancelled') {
        return { erro: 'Exportacao cancelada.' };
    }
    return {
        mensagem:
            saveResult === 'saved'
                ? `Ficheiro ${tipo} guardado no local escolhido.`
                : `Ficheiro ${tipo} descarregado (browser sem seletor de pasta).`,
    };
}

/**
 * Descarrega o modelo de importação (cabeçalhos + linha de exemplo) em CSV ou
 * Excel. Devolve { mensagem } ou { erro }.
 */
export async function descarregarModeloImportacao({
    formato,
    cabecalhos,
    exemplo,
    nomeFicheiro,
    folha,
}) {
    let saveResult;

    if (formato === 'csv') {
        const csvRows = [cabecalhos, exemplo].map((row) =>
            row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')
        );
        saveResult = await saveBlobToDisk(
            new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }),
            nomeFicheiro,
            'csv',
            'text/csv'
        );
    } else {
        const { linhasParaXlsx } = await import('./excel');
        saveResult = await saveBlobToDisk(
            await linhasParaXlsx([cabecalhos, exemplo], folha),
            nomeFicheiro,
            'xlsx',
            MIME_XLSX
        );
    }

    if (saveResult === 'cancelled') {
        return { erro: 'Download do modelo cancelado.' };
    }
    return {
        mensagem:
            formato === 'csv'
                ? 'Modelo CSV descarregado com sucesso.'
                : 'Modelo Excel descarregado com sucesso.',
    };
}

/**
 * Confirma que o ficheiro escolhido corresponde ao formato. Devolve a
 * mensagem de erro ou null.
 */
export function validarFicheiroImportacao(ficheiro, formato) {
    if (!ficheiro) {
        return 'Selecione um ficheiro para importar.';
    }

    const fileName = ficheiro.name.toLowerCase();

    if (formato === 'csv' && !fileName.endsWith('.csv')) {
        return 'Formato invalido: escolha um ficheiro .csv.';
    }

    if (formato === 'excel' && !fileName.endsWith('.xlsx')) {
        return fileName.endsWith('.xls')
            ? 'O formato .xls (Excel 97-2003) não é suportado. Abra o ficheiro no Excel e guarde-o como .xlsx.'
            : 'Formato invalido: escolha um ficheiro .xlsx.';
    }

    return null;
}
