import { db } from './db.js';

/**
 * ========================================
 * PACOTES COMERCIAIS
 * ========================================
 * O pacote contratado é definido por instalação na variável de ambiente
 * GESTUDO_PLANO (basico | plus | profissional | completo). Por omissão é
 * 'completo', para que instalações existentes não percam funcionalidades.
 *
 * Manter alinhado com frontend/src/pages/Infos/pricingPlans.js (página
 * comercial) — este ficheiro é a fonte de verdade para o que é bloqueado.
 * ========================================
 */

export const PLAN_ORDER = ['basico', 'plus', 'profissional', 'completo'];

export const PLANS = {
    basico: { nome: 'Básico', limites: { alunos: 40, gestores: 1 } },
    plus: { nome: 'Plus', limites: { alunos: 120, gestores: 2 } },
    profissional: { nome: 'Profissional', limites: { alunos: 300, gestores: 5 } },
    completo: { nome: 'Completo', limites: { alunos: null, gestores: null } },
};

// Módulo → pacote mínimo em que fica disponível.
export const MODULES = {
    exportacoes: { nome: 'Exportação PDF e Excel', desde: 'plus' },
    assiduidade: { nome: 'Assiduidade dos professores', desde: 'plus' },
    calendario_sync: { nome: 'Sincronização de calendário', desde: 'plus' },
    inscricoes_online: { nome: 'Inscrições online', desde: 'plus' },
    notificacoes_push: { nome: 'Notificações push', desde: 'plus' },
    renovacoes: { nome: 'Reinscrição e renovações online', desde: 'profissional' },
    textos_inscricao: { nome: 'Textos do formulário de inscrição', desde: 'profissional' },
    financeiro: { nome: 'Mensalidades e pagamentos', desde: 'profissional' },
    alertas: { nome: 'Alertas configuráveis', desde: 'profissional' },
    relatorios: { nome: 'Relatórios', desde: 'profissional' },
    custos_professores: { nome: 'Custos e tarifas de professores', desde: 'completo' },
    modelos_email: { nome: 'Modelos de email personalizáveis', desde: 'completo' },
    auditoria: { nome: 'Registo de auditoria', desde: 'completo' },
};

export function getCurrentPlanKey() {
    const raw = String(process.env.GESTUDO_PLANO || '')
        .trim()
        .toLowerCase();
    return PLANS[raw] ? raw : 'completo';
}

export function isValidPlanKey(value) {
    return Boolean(PLANS[String(value || '').trim().toLowerCase()]);
}

export function hasModule(moduleKey, planKey = getCurrentPlanKey()) {
    const moduleDef = MODULES[moduleKey];
    if (!moduleDef) return false;
    return PLAN_ORDER.indexOf(planKey) >= PLAN_ORDER.indexOf(moduleDef.desde);
}

export function getPlanSummary() {
    const key = getCurrentPlanKey();
    return {
        plano: key,
        nome: PLANS[key].nome,
        limites: PLANS[key].limites,
        modulos: Object.fromEntries(
            Object.keys(MODULES).map((moduleKey) => [moduleKey, hasModule(moduleKey, key)])
        ),
        // Nome e pacote mínimo de cada módulo, para mensagens de upgrade.
        catalogo: Object.fromEntries(
            Object.entries(MODULES).map(([moduleKey, def]) => [
                moduleKey,
                { nome: def.nome, desde: def.desde, desdeNome: PLANS[def.desde].nome },
            ])
        ),
    };
}

export function planUnavailableError(moduleKey) {
    const moduleDef = MODULES[moduleKey];
    const error = new Error(
        `A funcionalidade "${moduleDef?.nome || moduleKey}" não está incluída no pacote ${PLANS[getCurrentPlanKey()].nome}.`
    );
    error.status = 403;
    error.code = 'PLAN_MODULE_UNAVAILABLE';
    error.details = {
        modulo: moduleKey,
        planoAtual: getCurrentPlanKey(),
        planoNecessario: moduleDef?.desde || null,
    };
    return error;
}

/**
 * Middleware: bloqueia a rota se o módulo não estiver incluído no pacote.
 */
export function requireModule(moduleKey) {
    return (req, res, next) => {
        if (hasModule(moduleKey)) return next();
        const error = planUnavailableError(moduleKey);
        return res.status(error.status).json({
            code: error.code,
            message: error.message,
            ...error.details,
        });
    };
}

// ── Limites ────────────────────────────────────────────────────────────────

export async function countActiveUsers(role, client = db) {
    const { rows } = await client.query(
        `SELECT COUNT(*)::int AS total FROM users WHERE role = $1 AND status = true`,
        [role]
    );
    return rows[0]?.total ?? 0;
}

export async function getPlanUsage(client = db) {
    const [alunos, gestores] = await Promise.all([
        countActiveUsers('aluno', client),
        countActiveUsers('gestor', client),
    ]);
    return { alunos, gestores };
}

const LIMIT_LABELS = {
    alunos: { role: 'aluno', nome: 'alunos ativos' },
    gestores: { role: 'gestor', nome: 'contas de gestor ativas' },
};

/**
 * Lança um erro 409 (code PLAN_LIMIT_REACHED) se ativar mais um utilizador
 * ultrapassar o limite do pacote. Aceita um client de transação.
 */
export async function assertWithinLimit(limitKey, client = db) {
    const limit = PLANS[getCurrentPlanKey()].limites[limitKey];
    if (limit == null) return;

    const { role, nome } = LIMIT_LABELS[limitKey];
    const total = await countActiveUsers(role, client);
    if (total < limit) return;

    const error = new Error(
        `Atingiu o limite de ${limit} ${nome} do pacote ${PLANS[getCurrentPlanKey()].nome}. Desative contas que já não usa ou mude para um pacote superior.`
    );
    error.status = 409;
    error.code = 'PLAN_LIMIT_REACHED';
    error.details = { limite: limitKey, maximo: limit, atual: total };
    throw error;
}

export function sendPlanError(res, error) {
    return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...error.details,
    });
}

export function isPlanError(error) {
    return error?.code === 'PLAN_LIMIT_REACHED' || error?.code === 'PLAN_MODULE_UNAVAILABLE';
}
