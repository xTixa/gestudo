const KEY_LABELS = {
    id_user: 'ID do utilizador',
    id_aluno: 'ID do aluno',
    id_professor: 'ID do professor',
    nome: 'Nome',
    nome_completo: 'Nome completo',
    email: 'Email',
    role: 'Perfil',
    status: 'Estado',
    estado: 'Estado',
    origem: 'Origem',
    tipo: 'Periodicidade',
    periodicidade: 'Periodicidade',
    tipo_canonical: 'Periodicidade',
    id_tiposervico: 'Tipo de serviço',
    tipo_servico: 'Tipo de serviço',
    id_modalidade: 'Modalidade',
    modalidade: 'Modalidade',
    entidade: 'Entidade',
    acao: 'Ação',
    entidade_id: 'ID da entidade',
    data_nasc: 'Data de nascimento',
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
    telemovel: 'Telemóvel',
    telefone: 'Telefone',
    morada: 'Morada',
    localidade: 'Localidade',
    cod_postal: 'Código postal',
    habilitacao: 'Habilitação',
    habilitacoes: 'Habilitações',
    area: 'Área',
    area_ensino: 'Área de ensino',
    nivel: 'Nível',
    criterio: 'Critério',
    dias: 'Dias',
    removidas: 'Removidas',
};

const IGNORE_KEYS = new Set([
    'created_at',
    'updated_at',
    'password',
    'token',
    'hash',
]);

const DETAIL_KEY_ALIASES = {
    tipo: 'periodicidade',
    tipo_canonical: 'periodicidade',
};

function parseDetailsObject(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const plainJson = raw.startsWith('{') || raw.startsWith('[') ? raw : null;
    const newRecordMatch = raw.match(/^novo registo:\s*(\{.*\})$/i);
    const removedRecordMatch = raw.match(/^remocao de registo:\s*(\{.*\})$/i);

    const jsonCandidate =
        plainJson || newRecordMatch?.[1] || removedRecordMatch?.[1] || null;

    if (!jsonCandidate) return null;

    try {
        return JSON.parse(jsonCandidate);
    } catch {
        return null;
    }
}

function humanizeKey(key) {
    const normalized = String(key || '').trim();
    return KEY_LABELS[normalized] || normalized.replaceAll('_', ' ');
}

function getLogicalKey(key) {
    const normalized = String(key || '')
        .trim()
        .toLowerCase();
    return DETAIL_KEY_ALIASES[normalized] || normalized;
}

function getKeyPriority(key) {
    const normalized = String(key || '')
        .trim()
        .toLowerCase();
    if (normalized === 'periodicidade') {
        return 10;
    }
    return 1;
}

function getDisplayValue(val) {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function getDisplayValueByKey(key, val) {
    const normalizedKey = String(key || '')
        .trim()
        .toLowerCase();
    const raw = getDisplayValue(val);

    if (normalizedKey === 'periodicidade') {
        const normalizedValue = String(val || '')
            .trim()
            .toLowerCase();

        if (normalizedValue === 'periodico') {
            return 'Periódico';
        }
        if (normalizedValue === 'unico') {
            return 'Único';
        }
    }

    return raw;
}

function getComparableValue(val) {
    if (val === null || val === undefined || val === '') {
        return '';
    }

    if (typeof val === 'string') {
        return val
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    if (typeof val === 'object') {
        try {
            return JSON.stringify(val);
        } catch {
            return String(val);
        }
    }

    return String(val).toLowerCase().trim();
}

function areValuesEqual(left, right) {
    if (left === right) {
        return true;
    }

    if (typeof left === 'object' || typeof right === 'object') {
        try {
            return JSON.stringify(left) === JSON.stringify(right);
        } catch {
            return false;
        }
    }

    return false;
}

function buildDetailsLines(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return [];
    }

    if (parsed.antes && parsed.depois) {
        const linesByLogicalKey = new Map();
        const allKeys = new Set([
            ...Object.keys(parsed.antes || {}),
            ...Object.keys(parsed.depois || {}),
        ]);

        for (const key of allKeys) {
            if (IGNORE_KEYS.has(String(key).toLowerCase())) {
                continue;
            }

            const beforeVal = parsed.antes?.[key];
            const afterVal = parsed.depois?.[key];

            if (areValuesEqual(beforeVal, afterVal)) {
                continue;
            }

            const logicalKey = getLogicalKey(key);
            const comparablePair = `${getComparableValue(beforeVal)}::${getComparableValue(afterVal)}`;
            const nextLine = `${humanizeKey(logicalKey)}: ${getDisplayValueByKey(logicalKey, beforeVal)} -> ${getDisplayValueByKey(logicalKey, afterVal)}`;
            const nextPriority = getKeyPriority(key);
            const previous = linesByLogicalKey.get(logicalKey);

            if (!previous) {
                linesByLogicalKey.set(logicalKey, {
                    line: nextLine,
                    pair: comparablePair,
                    priority: nextPriority,
                });
                continue;
            }

            if (previous.pair !== comparablePair) {
                linesByLogicalKey.set(`${logicalKey}_${key}`, {
                    line: `${humanizeKey(key)}: ${getDisplayValue(beforeVal)} -> ${getDisplayValue(afterVal)}`,
                    pair: comparablePair,
                    priority: nextPriority,
                });
                continue;
            }

            if (nextPriority > previous.priority) {
                linesByLogicalKey.set(logicalKey, {
                    line: nextLine,
                    pair: comparablePair,
                    priority: nextPriority,
                });
            }
        }

        return Array.from(linesByLogicalKey.values()).map((item) => item.line);
    }

    const linesByLogicalKey = new Map();

    for (const [key, value] of Object.entries(parsed)) {
        if (IGNORE_KEYS.has(String(key).toLowerCase())) {
            continue;
        }

        const logicalKey = getLogicalKey(key);
        const comparableValue = getComparableValue(value);
        const nextLine = `${humanizeKey(logicalKey)}: ${getDisplayValueByKey(logicalKey, value)}`;
        const nextPriority = getKeyPriority(key);
        const previous = linesByLogicalKey.get(logicalKey);

        if (!previous) {
            linesByLogicalKey.set(logicalKey, {
                line: nextLine,
                value: comparableValue,
                priority: nextPriority,
            });
            continue;
        }

        if (previous.value !== comparableValue) {
            linesByLogicalKey.set(`${logicalKey}_${key}`, {
                line: `${humanizeKey(key)}: ${getDisplayValue(value)}`,
                value: comparableValue,
                priority: nextPriority,
            });
            continue;
        }

        if (nextPriority > previous.priority) {
            linesByLogicalKey.set(logicalKey, {
                line: nextLine,
                value: comparableValue,
                priority: nextPriority,
            });
        }
    }

    return Array.from(linesByLogicalKey.values()).map((item) => item.line);
}

export default function LogDetailsCell({ details }) {
    const parsed = parseDetailsObject(details);

    if (!parsed) {
        return (
            <span className="text-slate-500">{details || 'Sem detalhes'}</span>
        );
    }

    const lines = buildDetailsLines(parsed);
    if (!lines.length) {
        return <span className="text-slate-500">Sem alterações detetadas</span>;
    }

    const detailsText = lines.join(' | ');

    return (
        <span className="block max-w-[28rem] break-words text-sm leading-5 text-slate-600">
            {detailsText}
        </span>
    );
}
