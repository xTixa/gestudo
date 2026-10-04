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

const PROFESSOR_COLORS = [
    { bg: '#eaf9f5', border: '#06b6d4', text: '#0e7490', badge: '#06b6d4' },
    { bg: '#f8fafc', border: '#1e293b', text: '#0f172a', badge: '#1e293b' },
    { bg: '#f8fafc', border: '#64748b', text: '#0f172a', badge: '#64748b' },
    { bg: '#fff7ed', border: '#f97316', text: '#9a3412', badge: '#f97316' },
    { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6', badge: '#8b5cf6' },
    { bg: '#fefce8', border: '#eab308', text: '#854d0e', badge: '#eab308' },
];

const ACTIVITY_COLORS = {
    extra: {
        bg: 'bg-violet-100',
        border: 'border-violet-500',
        text: 'text-violet-900',
        badge: 'bg-violet-500',
    },
    curricular: {
        bg: 'bg-blue-100',
        border: 'border-blue-500',
        text: 'text-blue-900',
        badge: 'bg-emerald-500',
    },
    reposta: {
        bg: 'bg-amber-100',
        border: 'border-amber-500',
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
    const match = PROFESSOR_COLORS.find(
        (set) => set.border.toLowerCase() === String(hex || '').toLowerCase()
    );
    return match || null;
}

// Cores (hex) do professor da atividade: a cor guardada na ficha do professor
// ou, sem ela, uma cor fixa derivada do nome.
export function getProfessorColor(atividade) {
    const professor = getProfessorName(atividade);
    if (!professor) {
        return {
            bg: '#f8fafc',
            border: '#64748b',
            text: '#0f172a',
            badge: '#64748b',
        };
    }

    const corPersistida = buildColorSetFromHex(atividade?.professorCor);
    if (corPersistida) {
        return corPersistida;
    }

    return PROFESSOR_COLORS[
        hashString(professor.toLowerCase()) % PROFESSOR_COLORS.length
    ];
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

// Cores (classes Tailwind) por tipo de atividade, usadas no modo "aluno".
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
