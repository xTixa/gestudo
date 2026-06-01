import { db } from '../config/db.js';

/**
 * MODEL: Pessoas
 * Operações de dados para tabela pessoas (informações pessoais)
 *
 * Schema:
 * - id_pessoa (PK): Identificador único
 * - nome: Nome completo
 * - nif: Número de identificação fiscal (único)
 * - telemovel: Contacto telefónico
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo registo de pessoa
 */
export async function criarPessoa(nome, nif, telemovel) {
    const query = `
    INSERT INTO pessoas (nome, nif, telemovel)
    VALUES ($1, $2, $3)
    RETURNING id_pessoa, nome, nif, telemovel, created_at
  `;
    const { rows } = await db.query(query, [nome, nif, telemovel]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém pessoa por ID
 */
export async function obterPessoa(idPessoa) {
    const query = `SELECT * FROM pessoas WHERE id_pessoa = $1`;
    const { rows } = await db.query(query, [idPessoa]);
    return rows[0];
}

/**
 * Obtém pessoa por NIF
 */
export async function obterPessoaPorNIF(nif) {
    const query = `SELECT * FROM pessoas WHERE nif = $1`;
    const { rows } = await db.query(query, [nif]);
    return rows[0];
}

/**
 * Lista todas as pessoas
 */
export async function listarPessoas() {
    const query = `SELECT * FROM pessoas ORDER BY nome ASC`;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Procura pessoas por nome (like)
 */
export async function procurarPessoasPorNome(nome) {
    const query = `
    SELECT * FROM pessoas
    WHERE LOWER(nome) LIKE LOWER($1)
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query, [`%${nome}%`]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de pessoa
 */
export async function atualizarPessoa(idPessoa, dados) {
    const { nome, nif, telemovel } = dados;

    const setClauses = [];
    const values = [];

    if (nome !== undefined) {
        values.push(nome);
        setClauses.push(`nome = $${values.length}`);
    }
    if (nif !== undefined) {
        values.push(nif);
        setClauses.push(`nif = $${values.length}`);
    }
    if (telemovel !== undefined) {
        values.push(telemovel);
        setClauses.push(`telemovel = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idPessoa);

    const query = `
    UPDATE pessoas
    SET ${setClauses.join(', ')}
    WHERE id_pessoa = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove pessoa (soft delete)
 */
export async function removerPessoa(idPessoa) {
    // Pode implementar soft delete com coluna 'deleted_at' se necessário
    const query = `DELETE FROM pessoas WHERE id_pessoa = $1 RETURNING id_pessoa`;
    const { rows } = await db.query(query, [idPessoa]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se NIF já existe
 */
export async function nifJaExiste(nif) {
    const query = `SELECT COUNT(*) as count FROM pessoas WHERE nif = $1`;
    const { rows } = await db.query(query, [nif]);
    return rows[0].count > 0;
}

/**
 * Verifica se pessoa existe
 */
export async function pessoaExiste(idPessoa) {
    const query = `SELECT COUNT(*) as count FROM pessoas WHERE id_pessoa = $1`;
    const { rows } = await db.query(query, [idPessoa]);
    return rows[0].count > 0;
}
