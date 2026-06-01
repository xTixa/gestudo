import { db } from '../config/db.js';

/**
 * MODEL: Professores
 * Operações de dados para tabela professores (docentes)
 *
 * Schema:
 * - id_professor (PK): Identificador único
 * - id_user (FK): Referência para tabela users
 * - id_pessoa (FK): Referência para tabela pessoas
 * - habilitacao: Qualificação académica
 * - area_ensino: Área de atuação (ex: Matemática)
 * - nivel: Nível de ensino
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo professor no sistema
 */
export async function criarProfessor(
    idUser,
    idPessoa,
    habilitacao,
    areaEnsino,
    nivel
) {
    const query = `
    INSERT INTO professores (id_user, id_pessoa, habilitacao, area_ensino, nivel)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_professor, id_user, id_pessoa, habilitacao, area_ensino, nivel, created_at
  `;
    const { rows } = await db.query(query, [
        idUser,
        idPessoa,
        habilitacao,
        areaEnsino,
        nivel,
    ]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém professor por ID
 */
export async function obterProfessor(idProfessor) {
    const query = `
    SELECT
      pr.id_professor, pr.id_user, p.nome, p.nif,
      p.telemovel AS contacto, u.email,
      pr.habilitacao, pr.area_ensino, pr.nivel,
      u.created_at AS data_entrada, u.status
    FROM professores pr
    INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
    INNER JOIN users u ON u.id_user = pr.id_user
    WHERE pr.id_professor = $1
  `;
    const { rows } = await db.query(query, [idProfessor]);
    return rows[0];
}

/**
 * Obtém professor por ID de utilizador
 */
export async function obterProfessorPorUserId(idUser) {
    const query = `
    SELECT pr.* FROM professores pr
    WHERE pr.id_user = $1
  `;
    const { rows } = await db.query(query, [idUser]);
    return rows[0];
}

/**
 * Lista todos os professores
 */
export async function listarProfessores() {
    const query = `
    SELECT
      pr.id_professor, pr.id_user, p.nome, p.nif,
      p.telemovel AS contacto, u.email,
      pr.habilitacao, pr.area_ensino, pr.nivel,
      u.created_at AS data_entrada, u.status
    FROM professores pr
    INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
    INNER JOIN users u ON u.id_user = pr.id_user
    ORDER BY p.nome ASC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista professores por área de ensino
 */
export async function listarProfessoresPorArea(areaEnsino) {
    const query = `
    SELECT pr.* FROM professores pr
    WHERE LOWER(pr.area_ensino) = LOWER($1)
    ORDER BY id_professor
  `;
    const { rows } = await db.query(query, [areaEnsino]);
    return rows;
}

/**
 * Lista professores por nível de ensino
 */
export async function listarProfessoresPorNivel(nivel) {
    const query = `
    SELECT pr.* FROM professores pr
    WHERE LOWER(pr.nivel) = LOWER($1)
    ORDER BY id_professor
  `;
    const { rows } = await db.query(query, [nivel]);
    return rows;
}

/**
 * Lista professores ativos
 */
export async function listarProfessoresAtivos() {
    const query = `
    SELECT pr.* FROM professores pr
    INNER JOIN users u ON u.id_user = pr.id_user
    WHERE u.status = true
    ORDER BY id_professor
  `;
    const { rows } = await db.query(query);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de professor
 */
export async function atualizarProfessor(idProfessor, dados) {
    const { habilitacao, area_ensino, nivel } = dados;

    const setClauses = [];
    const values = [];

    if (habilitacao !== undefined) {
        values.push(habilitacao);
        setClauses.push(`habilitacao = $${values.length}`);
    }
    if (area_ensino !== undefined) {
        values.push(area_ensino);
        setClauses.push(`area_ensino = $${values.length}`);
    }
    if (nivel !== undefined) {
        values.push(nivel);
        setClauses.push(`nivel = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idProfessor);

    const query = `
    UPDATE professores
    SET ${setClauses.join(', ')}
    WHERE id_professor = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove professor
 */
export async function removerProfessor(idProfessor) {
    const query = `DELETE FROM professores WHERE id_professor = $1 RETURNING id_professor`;
    const { rows } = await db.query(query, [idProfessor]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se professor existe
 */
export async function professorExiste(idProfessor) {
    const query = `SELECT COUNT(*) as count FROM professores WHERE id_professor = $1`;
    const { rows } = await db.query(query, [idProfessor]);
    return rows[0].count > 0;
}

/**
 * Verifica se já existe professor com este id_user
 */
export async function professorExistePorUserId(idUser) {
    const query = `SELECT COUNT(*) as count FROM professores WHERE id_user = $1`;
    const { rows } = await db.query(query, [idUser]);
    return rows[0].count > 0;
}
