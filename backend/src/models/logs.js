import { db } from '../config/db.js';

/**
 * MODEL: Logs
 * Operações de dados para tabela logs (auditoria e histórico)
 *
 * Schema:
 * - id_log (PK): Identificador único
 * - id_user (FK): ID do utilizador que executou a ação
 * - acao: Tipo de ação (INSERT, UPDATE, DELETE)
 * - entidade: Tipo de entidade afetada (ex: 'alunos', 'servicos')
 * - entidade_id: ID da entidade afetada
 * - detalhes: Dados JSON com informações da operação
 * - created_at: Data/hora da ação
 */

// =============== CREATE ===============

/**
 * Insere novo registo de log
 */
export async function criarLog(idUser, acao, entidade, entidadeId, detalhes) {
    const query = `
    INSERT INTO logs (id_user, acao, entidade, entidade_id, detalhes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_log, id_user, acao, entidade, entidade_id, detalhes, created_at
  `;

    const detalhesJSON =
        typeof detalhes === 'string'
            ? detalhes
            : JSON.stringify(detalhes || {});

    const { rows } = await db.query(query, [
        idUser || null,
        String(acao || 'INSERT').toUpperCase(),
        entidade,
        entidadeId || null,
        detalhesJSON,
    ]);

    return rows[0];
}

// =============== READ ===============

/**
 * Obtém log por ID
 */
export async function obterLog(idLog) {
    const query = `
    SELECT
      l.id_log, l.id_user, l.acao, l.entidade, l.entidade_id,
      l.detalhes, l.created_at,
      u.email AS utilizador
    FROM logs l
    LEFT JOIN users u ON u.id_user = l.id_user
    WHERE l.id_log = $1
  `;
    const { rows } = await db.query(query, [idLog]);
    return rows[0];
}

/**
 * Lista todos os logs (últimos 500)
 */
export async function listarLogs(limite = 500) {
    const query = `
    SELECT
      l.id_log, l.id_user, l.acao, l.entidade, l.entidade_id,
      l.detalhes, l.created_at,
      COALESCE(u.email, CONCAT('ID ', l.id_user::text), 'Sistema') AS utilizador
    FROM logs l
    LEFT JOIN users u ON u.id_user = l.id_user
    ORDER BY l.created_at DESC
    LIMIT $1
  `;
    const { rows } = await db.query(query, [limite]);
    return rows;
}

/**
 * Lista logs por utilizador
 */
export async function listarLogsPorUtilizador(idUser) {
    const query = `
    SELECT * FROM logs
    WHERE id_user = $1
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query, [idUser]);
    return rows;
}

/**
 * Lista logs por entidade
 */
export async function listarLogsPorEntidade(entidade) {
    const query = `
    SELECT * FROM logs
    WHERE entidade = $1
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query, [entidade]);
    return rows;
}

/**
 * Lista logs de uma entidade específica
 */
export async function listarLogsDaEntidade(entidade, entidadeId) {
    const query = `
    SELECT * FROM logs
    WHERE entidade = $1 AND entidade_id = $2
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query, [entidade, entidadeId]);
    return rows;
}

/**
 * Lista logs por tipo de ação
 */
export async function listarLogsPorAcao(acao) {
    const query = `
    SELECT * FROM logs
    WHERE UPPER(acao) = UPPER($1)
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query, [acao]);
    return rows;
}

/**
 * Lista logs num intervalo de datas
 */
export async function listarLogsEntreDatas(dataInicio, dataFim) {
    const query = `
    SELECT * FROM logs
    WHERE created_at >= $1 AND created_at <= $2
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query, [dataInicio, dataFim]);
    return rows;
}

// =============== DELETE ===============

/**
 * Remove log permanentemente
 */
export async function removerLog(idLog) {
    const query = `DELETE FROM logs WHERE id_log = $1 RETURNING id_log`;
    const { rows } = await db.query(query, [idLog]);
    return rows[0];
}

/**
 * Remove todos os logs (cuidado! operção irreversível)
 */
export async function limparLogs() {
    const query = `DELETE FROM logs RETURNING COUNT(*) as removidos`;
    const { rows } = await db.query(query);
    return rows[0];
}

// =============== ESTATÍSTICAS ===============

/**
 * Conta total de logs
 */
export async function contarLogs() {
    const query = `SELECT COUNT(*) as total FROM logs`;
    const { rows } = await db.query(query);
    return rows[0].total;
}

/**
 * Obtém estatísticas de logs por entidade
 */
export async function estatisticasLogsPorEntidade() {
    const query = `
    SELECT
      entidade,
      COUNT(*) as total,
      COUNT(DISTINCT id_user) as utilizadores,
      MAX(created_at) as ultima_acao
    FROM logs
    GROUP BY entidade
    ORDER BY total DESC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Obtém estatísticas de logs por ação
 */
export async function estatisticasLogsPorAcao() {
    const query = `
    SELECT
      acao,
      COUNT(*) as total,
      COUNT(DISTINCT id_user) as utilizadores
    FROM logs
    GROUP BY acao
    ORDER BY total DESC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Obtém utilizadores mais ativos
 */
export async function utilizadoresMaisAtivos(limite = 10) {
    const query = `
    SELECT
      l.id_user,
      u.email,
      COUNT(*) as num_acoes,
      MAX(l.created_at) as ultima_acao
    FROM logs l
    LEFT JOIN users u ON u.id_user = l.id_user
    WHERE l.id_user IS NOT NULL
    GROUP BY l.id_user, u.email
    ORDER BY num_acoes DESC
    LIMIT $1
  `;
    const { rows } = await db.query(query, [limite]);
    return rows;
}
