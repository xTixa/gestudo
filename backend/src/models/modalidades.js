import { db } from '../config/db.js';

/**
 * MODEL: Modalidades
 * Operações de dados para tabela modalidades (formas de ensino)
 *
 * Schema:
 * - id_modalidade (PK): Identificador único
 * - nome: Nome da modalidade (ex: Presencial, Online, Híbrida)
 * - descricao: Descrição detalhada
 * - ativa: Status da modalidade
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria nova modalidade
 */
export async function criarModalidade(nome, descricao = '', ativa = true) {
    const query = `
    INSERT INTO modalidades (nome, descricao, ativa)
    VALUES ($1, $2, $3)
    RETURNING id_modalidade, nome, descricao, ativa, created_at
  `;
    const { rows } = await db.query(query, [nome, descricao, ativa]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém modalidade por ID
 */
export async function obterModalidade(idModalidade) {
    const query = `SELECT * FROM modalidades WHERE id_modalidade = $1`;
    const { rows } = await db.query(query, [idModalidade]);
    return rows[0];
}

/**
 * Lista todas as modalidades
 */
export async function listarModalidades() {
    const query = `SELECT * FROM modalidades ORDER BY nome ASC`;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista modalidades ativas
 */
export async function listarModalidadesAtivas() {
    const query = `
    SELECT * FROM modalidades
    WHERE COALESCE(ativa, true) = true
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Procura modalidades por nome
 */
export async function procurarModalidadesPorNome(nome) {
    const query = `
    SELECT * FROM modalidades
    WHERE LOWER(nome) LIKE LOWER($1)
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query, [`%${nome}%`]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de modalidade
 */
export async function atualizarModalidade(idModalidade, dados) {
    const { nome, descricao, ativa } = dados;

    const setClauses = [];
    const values = [];

    if (nome !== undefined) {
        values.push(nome);
        setClauses.push(`nome = $${values.length}`);
    }
    if (descricao !== undefined) {
        values.push(descricao);
        setClauses.push(`descricao = $${values.length}`);
    }
    if (ativa !== undefined) {
        values.push(ativa);
        setClauses.push(`ativa = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idModalidade);

    const query = `
    UPDATE modalidades
    SET ${setClauses.join(', ')}
    WHERE id_modalidade = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

/**
 * Altera status de modalidade
 */
export async function alterarStatusModalidade(idModalidade, ativa) {
    const query = `
    UPDATE modalidades
    SET ativa = $1
    WHERE id_modalidade = $2
    RETURNING id_modalidade, ativa
  `;
    const { rows } = await db.query(query, [ativa, idModalidade]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove modalidade (soft delete)
 */
export async function removerModalidade(idModalidade) {
    const query = `
    UPDATE modalidades
    SET ativa = false
    WHERE id_modalidade = $1
    RETURNING id_modalidade
  `;
    const { rows } = await db.query(query, [idModalidade]);
    return rows[0];
}

/**
 * Remove modalidade permanentemente
 */
export async function removerModalidadePermanente(idModalidade) {
    const query = `DELETE FROM modalidades WHERE id_modalidade = $1 RETURNING id_modalidade`;
    const { rows } = await db.query(query, [idModalidade]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se modalidade existe
 */
export async function modalidadeExiste(idModalidade) {
    const query = `SELECT COUNT(*) as count FROM modalidades WHERE id_modalidade = $1`;
    const { rows } = await db.query(query, [idModalidade]);
    return rows[0].count > 0;
}
