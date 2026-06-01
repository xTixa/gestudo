import { db } from '../config/db.js';

/**
 * MODEL: Renovação de Matrícula
 * Operações para gerenciar a renovação de matrícula de alunos
 */

/**
 * Renova a matrícula de um aluno para um novo ano letivo
 * @param {number} idAluno - ID do aluno
 * @param {string} anoLetivo - Ano letivo (formato: YYYY/YYYY)
 * @returns {Object} Aluno com dados de renovação atualizados
 */
export async function renovarMatricula(idAluno, anoLetivo) {
    const query = `
        SELECT
            id_aluno,
            id_user,
            data_renovacao_ultima,
            ano_letivo_renovacao
        FROM public.fn_renovar_matricula($1, $2)
    `;

    const { rows } = await db.query(query, [idAluno, anoLetivo]);
    return rows[0] || null;
}

/**
 * Obtém informações de renovação de um aluno
 * @param {number} idAluno - ID do aluno
 * @returns {Object} Dados de renovação
 */
export async function obterDadosRenovacao(idAluno) {
    const query = `
        SELECT 
            id_aluno,
            data_renovacao_ultima,
            ano_letivo_renovacao
        FROM alunos
        WHERE id_aluno = $1
    `;

    const { rows } = await db.query(query, [idAluno]);
    return rows[0] || null;
}

/**
 * Verifica se a matrícula de um aluno está ativa (renovada para o ano letivo atual)
 * @param {number} idAluno - ID do aluno
 * @param {string} anoLetivoAtual - Ano letivo atual (formato: YYYY/YYYY)
 * @returns {boolean} True se a matrícula está renovada
 */
export async function isMatriculaAtiva(idAluno, anoLetivoAtual) {
    const query = `
        SELECT 1
        FROM alunos
        WHERE id_aluno = $1
            AND ano_letivo_renovacao = $2
    `;

    const { rows } = await db.query(query, [idAluno, anoLetivoAtual]);
    return rows.length > 0;
}

/**
 * Lista alunos com matrícula expirada (não renovada para o ano letivo atual)
 * @param {string} anoLetivoAtual - Ano letivo atual
 * @returns {Array} Lista de alunos com matrícula expirada
 */
export async function listarAlunosComMatriculaExpirada(anoLetivoAtual) {
    const query = `
        SELECT 
            id_aluno,
            id_user,
            ano_letivo_renovacao,
            aluno AS nome,
            email,
            conta_ativa AS status,
            email AS user_email
        FROM public.vw_matriculas_estado
        WHERE estado_matricula = 'expirada'
          AND ano_letivo_atual = $1
        ORDER BY aluno ASC
    `;

    const { rows } = await db.query(query, [anoLetivoAtual]);
    return rows;
}

/**
 * Suspende contas de alunos com matrícula expirada
 * @param {string} anoLetivoAtual - Ano letivo atual
 * @returns {number} Número de contas suspensas
 */
export async function suspenderAlunosComMatriculaExpirada(anoLetivoAtual) {
    const query = `
        SELECT public.fn_suspender_matriculas_expiradas($1) AS total
    `;

    const { rows } = await db.query(query, [anoLetivoAtual]);
    return Number(rows[0]?.total || 0);
}

/**
 * Ativa contas de alunos que renovaram a matrícula
 * @param {number} idAluno - ID do aluno
 * @returns {Object} Utilizador com status ativado
 */
export async function ativarContaAluno(idAluno) {
    const query = `
        UPDATE users
        SET status = true
        WHERE id_user = (
            SELECT id_user FROM alunos WHERE id_aluno = $1
        )
        RETURNING id_user, status
    `;

    const { rows } = await db.query(query, [idAluno]);
    return rows[0] || null;
}

/**
 * Conta quantos alunos precisam renovar a matrícula
 * @param {string} anoLetivoAtual - Ano letivo atual
 * @returns {number} Quantidade de alunos com matrícula expirada
 */
export async function contarAlunosComMatriculaExpirada(anoLetivoAtual) {
    const query = `
        SELECT COUNT(*) as total
        FROM alunos a
        WHERE a.ano_letivo_renovacao != $1
            OR a.ano_letivo_renovacao IS NULL
    `;

    const { rows } = await db.query(query, [anoLetivoAtual]);
    return rows[0]?.total ?? 0;
}
