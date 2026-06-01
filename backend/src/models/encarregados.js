import { db } from '../config/db.js';

/**
 * MODEL: Encarregados
 * Operações de dados para tabela encarregados (responsáveis de educandos)
 *
 * Schema:
 * - id_encarregado (PK): Identificador único
 * - id_pessoa (FK): Referência para tabela pessoas (dados pessoais)
 * - relacao: Relação com educando (Pai, Mãe, Tutor, etc)
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo encarregado
 */
export async function criarEncarregado(idPessoa, relacao = 'Responsável') {
    const query = `
    INSERT INTO encarregados (id_pessoa, relacao)
    VALUES ($1, $2)
    RETURNING id_encarregado, id_pessoa, relacao, created_at
  `;
    const { rows } = await db.query(query, [idPessoa, relacao]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém encarregado por ID
 */
export async function obterEncarregado(idEncarregado) {
    const query = `
    SELECT
      e.id_encarregado, e.id_pessoa, e.relacao,
      p.nome, p.nif, p.telemovel,
      e.created_at
    FROM encarregados e
    INNER JOIN pessoas p ON p.id_pessoa = e.id_pessoa
    WHERE e.id_encarregado = $1
  `;
    const { rows } = await db.query(query, [idEncarregado]);
    return rows[0];
}

/**
 * Lista todos os encarregados
 */
export async function listarEncarregados() {
    const query = `
    SELECT
      e.id_encarregado, e.id_pessoa, e.relacao,
      p.nome, p.nif, p.telemovel,
      e.created_at
    FROM encarregados e
    INNER JOIN pessoas p ON p.id_pessoa = e.id_pessoa
    ORDER BY p.nome ASC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Obtém encarregado de um aluno
 */
export async function obterEncarregadoDeAluno(idAluno) {
    const query = `
    SELECT e.* FROM encarregados e
    INNER JOIN alunos a ON a.id_encarregado = e.id_encarregado
    WHERE a.id_aluno = $1
  `;
    const { rows } = await db.query(query, [idAluno]);
    return rows[0];
}

/**
 * Lista encarregados por relação
 */
export async function listarEncarregadosPorRelacao(relacao) {
    const query = `
    SELECT e.* FROM encarregados e
    WHERE LOWER(e.relacao) = LOWER($1)
    ORDER BY id_encarregado
  `;
    const { rows } = await db.query(query, [relacao]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de encarregado
 */
export async function atualizarEncarregado(idEncarregado, dados) {
    const { relacao } = dados;

    if (relacao === undefined) return null;

    const query = `
    UPDATE encarregados
    SET relacao = $1
    WHERE id_encarregado = $2
    RETURNING id_encarregado, id_pessoa, relacao, created_at
  `;

    const { rows } = await db.query(query, [relacao, idEncarregado]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove encarregado
 */
export async function removerEncarregado(idEncarregado) {
    const query = `DELETE FROM encarregados WHERE id_encarregado = $1 RETURNING id_encarregado`;
    const { rows } = await db.query(query, [idEncarregado]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se encarregado existe
 */
export async function encarregadoExiste(idEncarregado) {
    const query = `SELECT COUNT(*) as count FROM encarregados WHERE id_encarregado = $1`;
    const { rows } = await db.query(query, [idEncarregado]);
    return rows[0].count > 0;
}
