// Formatação partilhada pela página de alunos e pela exportação.

// função para formatar uma data em formato ISO para o formato de data local em português, usando o método toLocaleDateString com a localidade 'pt-PT', e retornando uma string vazia caso a data seja inválida ou não fornecida
export function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-PT');
}

// função para obter o rótulo do encarregado de educação de um aluno, verificando várias propriedades do objeto encarregado em ordem de prioridade, e retornando uma string limpa e formatada, ou '-' caso nenhuma propriedade contenha um nome ou email válido
export function getEncarregadoLabel(value) {
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
