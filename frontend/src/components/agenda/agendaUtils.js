// Helpers partilhados pelas agendas (gestor, professor, aluno e encarregado).

// array dos meses do ano (para o calendário)
export const monthNames = [
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

// array dos dias da semana (para o calendário), começa no domingo para facilitar o cálculo do startFromSunday
export const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const weekDayNamesLong = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
];

// horas do dia para exibir na grid (8:00 às 21:00)
export const HOUR_LABELS = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8;
    return `${String(hour).padStart(2, '0')}:00`;
});

// Cores da agenda em classes da paleta (acompanham o modo escuro). Cada cor
// tem fundo, borda, borda esquerda, texto e badge; as classes estão escritas
// por extenso para o Tailwind as encontrar.
//
// Cores dos professores, pela ordem da paleta do backend
// (PROFESSOR_COLOR_PALETTE em professorController.js). "hex" lista os valores
// guardados na BD que correspondem a cada cor, incluindo os da migração 012.
const PROFESSOR_COLORS = [
    {
        hex: ['#14ad81', '#06b6d4'],
        bg: 'bg-ciano-50',
        border: 'border-ciano-500',
        borderL: 'border-l-ciano-500',
        text: 'text-ciano-700',
        badge: 'bg-ciano-500',
    },
    {
        hex: ['#1e3a5f', '#1e293b'],
        bg: 'bg-slate-50',
        border: 'border-slate-800',
        borderL: 'border-l-slate-800',
        text: 'text-slate-900',
        badge: 'bg-slate-800',
    },
    {
        hex: ['#63738c', '#64748b'],
        bg: 'bg-slate-50',
        border: 'border-slate-500',
        borderL: 'border-l-slate-500',
        text: 'text-slate-900',
        badge: 'bg-slate-500',
    },
    {
        hex: ['#f97316'],
        bg: 'bg-orange-50',
        border: 'border-orange-500',
        borderL: 'border-l-orange-500',
        text: 'text-orange-800',
        badge: 'bg-orange-500',
    },
    {
        hex: ['#8b5cf6'],
        bg: 'bg-violet-50',
        border: 'border-violet-500',
        borderL: 'border-l-violet-500',
        text: 'text-violet-800',
        badge: 'bg-violet-500',
    },
    {
        hex: ['#eab308'],
        bg: 'bg-yellow-50',
        border: 'border-yellow-500',
        borderL: 'border-l-yellow-500',
        text: 'text-yellow-800',
        badge: 'bg-yellow-500',
    },
];

// Atividade sem professor.
const SEM_PROFESSOR = PROFESSOR_COLORS[2];

const ACTIVITY_COLORS = {
    extra: {
        bg: 'bg-violet-100',
        border: 'border-violet-500',
        borderL: 'border-l-violet-500',
        text: 'text-violet-900',
        badge: 'bg-violet-500',
    },
    curricular: {
        bg: 'bg-blue-100',
        border: 'border-blue-500',
        borderL: 'border-l-blue-500',
        text: 'text-blue-900',
        badge: 'bg-emerald-500',
    },
    reposta: {
        bg: 'bg-amber-100',
        border: 'border-amber-500',
        borderL: 'border-l-amber-500',
        text: 'text-amber-900',
        badge: 'bg-amber-500',
    },
};

export function getProfessorName(atividade) {
    return String(atividade?.professor || atividade?.responsavel || '').trim();
}

function hashString(value) {
    return Array.from(String(value || '')).reduce(
        (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
        0
    );
}

function buildColorSetFromHex(hex) {
    const valor = String(hex || '').toLowerCase();
    return PROFESSOR_COLORS.find((set) => set.hex.includes(valor)) || null;
}

// Cor do professor da atividade: a cor guardada na ficha do professor ou, sem
// ela, uma cor fixa derivada do nome.
export function getProfessorColor(atividade) {
    const professor = getProfessorName(atividade);
    if (!professor) {
        return SEM_PROFESSOR;
    }

    const corPersistida = buildColorSetFromHex(atividade?.professorCor);
    if (corPersistida) {
        return corPersistida;
    }

    return PROFESSOR_COLORS[
        hashString(professor.toLowerCase()) % PROFESSOR_COLORS.length
    ];
}

/**
 * Cores de uma atividade: por professor no modo "equipa" (gestor e
 * professor), por tipo no modo "aluno" (aluno e encarregado).
 */
export function getCoresAtividade(atividade, modo) {
    return modo === 'equipa'
        ? getProfessorColor(atividade)
        : getAtividadeColors(atividade);
}

export function getAlunosList(atividade) {
    return Array.isArray(atividade?.alunos)
        ? atividade.alunos
              .map((aluno) => String(aluno || '').trim())
              .filter(Boolean)
        : [];
}

export function getAgendaCardTitle(atividade) {
    return (
        String(
            atividade?.disciplina ||
                atividade?.modalidade ||
                atividade?.tipo ||
                atividade?.titulo ||
                'Servico'
        ).trim() || 'Servico'
    );
}

export function isAtividadeReposta(atividade) {
    return String(atividade?.estado || '').toLowerCase() === 'reposta';
}

// Cores por tipo de atividade, usadas no modo "aluno".
export function getAtividadeColors(atividade) {
    if (isAtividadeReposta(atividade)) {
        return ACTIVITY_COLORS.reposta;
    }

    return ACTIVITY_COLORS[getAtividadeCategoria(atividade)];
}

// função para formatar a data no formato YYYY-MM-DD (para chaves e API)
export function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// função para extrair o domingo da semana de uma data (para alinhar a week view)
export function startFromSunday(date) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
}

// função para converter hora HH:MM em minutos totais (para o calculo do tamanho dos cartoes na grid)
export function timeToMinutes(timeStr) {
    const [hours, minutes] = (timeStr || '').split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// função para determinar se uma atividade é curricular ou extra-curricular com base nas propriedades
export function getAtividadeCategoria(atividade) {
    const categoria = String(
        atividade?.categoria || atividade?.tipo || atividade?.modalidade || ''
    ).toLowerCase();
    if (categoria.includes('extra')) {
        return 'extra';
    }
    return 'curricular';
}

// função para detectar serviços que colidem no tempo (para posicionar lado a lado)
export function detectAtividadeColisoes(atividades, targetAtividade) {
    const startMin = timeToMinutes(targetAtividade.hora);
    const endMin = targetAtividade.horaFim
        ? timeToMinutes(targetAtividade.horaFim)
        : startMin + 60;

    return atividades.filter((a) => {
        const aStart = timeToMinutes(a.hora);
        const aEnd = a.horaFim ? timeToMinutes(a.horaFim) : aStart + 60;
        return aStart < endMin && aEnd > startMin;
    });
}

// função para extrair lista de professores das atividades (para o filtro)
export function extrairProfessoresUnicos(atividadesPorDia) {
    const professores = new Set();
    Object.values(atividadesPorDia).forEach((atividades) => {
        atividades.forEach((a) => {
            if (a.professor || a.responsavel) {
                professores.add(a.professor || a.responsavel);
            }
        });
    });
    return Array.from(professores).sort();
}

// função para filtrar atividades por professor e tipo (curricular/extra) com base nos filtros selecionados
export function filtrarAtividades(atividades, filterProfessor, filterTipo) {
    return atividades.filter((a) => {
        const prof = a.professor || a.responsavel || '';
        const tipo = getAtividadeCategoria(a);

        if (filterProfessor && prof !== filterProfessor) return false;
        if (filterTipo && tipo !== filterTipo) return false;

        return true;
    });
}

// função para formatar a data no formato YYYY-MM (para o input month)
export function formatMonthPickerValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
