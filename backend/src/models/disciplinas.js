import { db } from '../config/db.js';

/**
 * MODEL: Disciplinas
 * Operações de dados para tabela disciplinas (matérias/cursos)
 *
 * Schema:
 * - id_disciplina (PK): Identificador único
 * - nome: Nome da disciplina
 * - id_nivel: Nível de ensino (referência)
 * - area: Área de conhecimento
 * - ativa: Status da disciplina
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria nova disciplina
 */
export async function criarDisciplina(nome, idNivel, area = '', ativa = true) {
    const query = `
    INSERT INTO disciplinas (nome, id_nivel, area, ativa)
    VALUES ($1, $2, $3, $4)
    RETURNING id_disciplina, nome, id_nivel, area, ativa, created_at
  `;
    const { rows } = await db.query(query, [nome, idNivel, area, ativa]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém disciplina por ID
 */
export async function obterDisciplina(idDisciplina) {
    const query = `SELECT * FROM disciplinas WHERE id_disciplina = $1`;
    const { rows } = await db.query(query, [idDisciplina]);
    return rows[0];
}

/**
 * Lista todas as disciplinas
 */
export async function listarDisciplinas() {
    const query = `SELECT * FROM disciplinas ORDER BY nome ASC`;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista disciplinas ativas
 */
export async function listarDisciplinasAtivas() {
    const query = `
    SELECT * FROM disciplinas
    WHERE COALESCE(ativa, true) = true
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Procura disciplinas por nome
 */
export async function procurarDisciplinasPorNome(nome) {
    const query = `
    SELECT * FROM disciplinas
    WHERE LOWER(nome) LIKE LOWER($1)
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query, [`%${nome}%`]);
    return rows;
}

/**
 * Lista disciplinas por nível de ensino
 */
export async function listarDisciplinasPorNivel(idNivel) {
    const query = `
    SELECT * FROM disciplinas
    WHERE id_nivel = $1 AND COALESCE(ativa, true) = true
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query, [idNivel]);
    return rows;
}

/**
 * Lista disciplinas por área
 */
export async function listarDisciplinasPorArea(area) {
    const query = `
    SELECT * FROM disciplinas
    WHERE LOWER(area) = LOWER($1) AND COALESCE(ativa, true) = true
    ORDER BY nome ASC
  `;
    const { rows } = await db.query(query, [area]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de disciplina
 */
export async function atualizarDisciplina(idDisciplina, dados) {
    const { nome, id_nivel, area, ativa } = dados;

    const setClauses = [];
    const values = [];

    if (nome !== undefined) {
        values.push(nome);
        setClauses.push(`nome = $${values.length}`);
    }
    if (id_nivel !== undefined) {
        values.push(id_nivel);
        setClauses.push(`id_nivel = $${values.length}`);
    }
    if (area !== undefined) {
        values.push(area);
        setClauses.push(`area = $${values.length}`);
    }
    if (ativa !== undefined) {
        values.push(ativa);
        setClauses.push(`ativa = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idDisciplina);

    const query = `
    UPDATE disciplinas
    SET ${setClauses.join(', ')}
    WHERE id_disciplina = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

/**
 * Altera status de disciplina
 */
export async function alterarStatusDisciplina(idDisciplina, ativa) {
    const query = `
    UPDATE disciplinas
    SET ativa = $1
    WHERE id_disciplina = $2
    RETURNING id_disciplina, ativa
  `;
    const { rows } = await db.query(query, [ativa, idDisciplina]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove disciplina (soft delete)
 */
export async function removerDisciplina(idDisciplina) {
    const query = `
    UPDATE disciplinas
    SET ativa = false
    WHERE id_disciplina = $1
    RETURNING id_disciplina
  `;
    const { rows } = await db.query(query, [idDisciplina]);
    return rows[0];
}

/**
 * Remove disciplina permanentemente
 */
export async function removerDisciplinaPermanente(idDisciplina) {
    const query = `DELETE FROM disciplinas WHERE id_disciplina = $1 RETURNING id_disciplina`;
    const { rows } = await db.query(query, [idDisciplina]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se disciplina existe
 */
export async function disciplinaExiste(idDisciplina) {
    const query = `SELECT COUNT(*) as count FROM disciplinas WHERE id_disciplina = $1`;
    const { rows } = await db.query(query, [idDisciplina]);
    return rows[0].count > 0;
}

/**
 * Conta disciplinas por nível
 */
export async function contarDisciplinasPorNivel(idNivel) {
    const query = `
    SELECT COUNT(*) as total FROM disciplinas
    WHERE id_nivel = $1 AND COALESCE(ativa, true) = true
  `;
    const { rows } = await db.query(query, [idNivel]);
    return rows[0].total;
}

/**
 * Conta total de disciplinas ativas
 */
export async function contarDisciplinasAtivas() {
    const query = `
    SELECT COUNT(*) as total FROM disciplinas
    WHERE COALESCE(ativa, true) = true
  `;
    const { rows } = await db.query(query);
    return rows[0].total;
}
