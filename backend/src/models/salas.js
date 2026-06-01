import { db } from '../config/db.js';

/**
 * MODEL: Salas
 * Operações de dados para tabela salas (espaços para atividades)
 *
 * Schema:
 * - id_sala (PK): Identificador único
 * - nome: Nome/designação da sala
 * - capacidade: Número máximo de pessoas
 * - ativa: Status da sala
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria nova sala
 */
export async function criarSala(nome, capacidade, ativa = true) {
    const query = `
    INSERT INTO salas (nome, capacidade, ativa)
    VALUES ($1, $2, $3)
    RETURNING id_sala, nome, capacidade, ativa, created_at
  `;
    const { rows } = await db.query(query, [nome, capacidade, ativa]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém sala por ID
 */
export async function obterSala(idSala) {
    const query = `SELECT * FROM salas WHERE id_sala = $1`;
    const { rows } = await db.query(query, [idSala]);
    return rows[0];
}

/**
 * Lista todas as salas
 */
export async function listarSalas() {
    const query = `SELECT * FROM salas ORDER BY nome ASC`;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista salas ativas
 */
export async function listarSalasAtivas() {
    const query = `
    SELECT * FROM salas
    WHERE COALESCE(ativa, true) = true
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Procura salas por nome
 */
export async function procurarSalasPorNome(nome) {
    const query = `
    SELECT * FROM salas
    WHERE LOWER(nome) LIKE LOWER($1)
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query, [`%${nome}%`]);
    return rows;
}

/**
 * Lista salas por capacidade mínima
 */
export async function listarSalasPorCapacidade(capacidadeMinima) {
    const query = `
    SELECT * FROM salas
    WHERE capacidade >= $1
    ORDER BY capacidade ASC
  `;
    const { rows } = await db.query(query, [capacidadeMinima]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de sala
 */
export async function atualizarSala(idSala, dados) {
    const { nome, capacidade, ativa } = dados;

    const setClauses = [];
    const values = [];

    if (nome !== undefined) {
        values.push(nome);
        setClauses.push(`nome = $${values.length}`);
    }
    if (capacidade !== undefined) {
        values.push(capacidade);
        setClauses.push(`capacidade = $${values.length}`);
    }
    if (ativa !== undefined) {
        values.push(ativa);
        setClauses.push(`ativa = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idSala);

    const query = `
    UPDATE salas
    SET ${setClauses.join(', ')}
    WHERE id_sala = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

/**
 * Altera status de sala
 */
export async function alterarStatusSala(idSala, ativa) {
    const query = `
    UPDATE salas
    SET ativa = $1
    WHERE id_sala = $2
    RETURNING id_sala, ativa
  `;
    const { rows } = await db.query(query, [ativa, idSala]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove sala (soft delete)
 */
export async function removerSala(idSala) {
    const query = `
    UPDATE salas
    SET ativa = false
    WHERE id_sala = $1
    RETURNING id_sala
  `;
    const { rows } = await db.query(query, [idSala]);
    return rows[0];
}

/**
 * Remove sala permanentemente
 */
export async function removerSalaPermanente(idSala) {
    const query = `DELETE FROM salas WHERE id_sala = $1 RETURNING id_sala`;
    const { rows } = await db.query(query, [idSala]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se sala existe
 */
export async function salaExiste(idSala) {
    const query = `SELECT COUNT(*) as count FROM salas WHERE id_sala = $1`;
    const { rows } = await db.query(query, [idSala]);
    return rows[0].count > 0;
}

/**
 * Verifica disponibilidade de sala (se tem espaço)
 */
export async function salaTemCapacidade(idSala, alunosNecessarios) {
    const query = `SELECT capacidade FROM salas WHERE id_sala = $1`;
    const { rows } = await db.query(query, [idSala]);

    if (!rows[0]) return false;

    return rows[0].capacidade >= alunosNecessarios;
}
