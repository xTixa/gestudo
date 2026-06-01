import { db } from '../config/db.js';

/**
 * MODEL: Alunos
 * Operações de dados para tabela alunos (estudantes)
 *
 * Schema:
 * - id_aluno (PK): Identificador único
 * - id_user (FK): Referência para tabela users
 * - id_pessoa (FK): Referência para tabela pessoas (dados pessoais)
 * - id_encarregado (FK): Referência para tabela encarregados
 * - ano: Ano de escolaridade
 * - turma: Turma/secção
 * - escola: Nome da escola
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo aluno no sistema
 */
export async function criarAluno(
    idUser,
    idPessoa,
    idEncarregado,
    ano,
    turma,
    escola
) {
    const query = `
    INSERT INTO alunos (id_user, id_pessoa, id_encarregado, ano, turma, escola)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id_aluno, id_user, id_pessoa, id_encarregado, ano, turma, escola, created_at
  `;
    const { rows } = await db.query(query, [
        idUser,
        idPessoa,
        idEncarregado,
        ano,
        turma,
        escola,
    ]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém aluno por ID
 */
export async function obterAluno(idAluno) {
    const query = `
    SELECT
      a.id_aluno, a.id_user, a.id_pessoa, a.id_encarregado,
      p.nome, p.nif, p.telemovel,
      a.ano, a.turma, a.escola,
      u.email, u.status,
      a.created_at
    FROM alunos a
    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
    INNER JOIN users u ON u.id_user = a.id_user
    WHERE a.id_aluno = $1
  `;
    const { rows } = await db.query(query, [idAluno]);
    return rows[0];
}

/**
 * Obtém aluno por ID de utilizador
 */
export async function obterAlunoPorUserId(idUser) {
    const query = `
    SELECT a.* FROM alunos a
    WHERE a.id_user = $1
  `;
    const { rows } = await db.query(query, [idUser]);
    return rows[0];
}

/**
 * Lista todos os alunos
 */
export async function listarAlunos() {
    const query = `
    SELECT
      a.id_aluno, a.id_user, p.nome, p.nif,
      a.ano, a.turma, a.escola,
      pe.nome AS encarregado, p.telemovel AS contacto,
      u.created_at AS data_inicio, u.email, u.status
    FROM alunos a
    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
    INNER JOIN users u ON u.id_user = a.id_user
    INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
    INNER JOIN pessoas pe ON pe.id_pessoa = e.id_pessoa
    ORDER BY p.nome ASC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista alunos por turma
 */
export async function listarAlunosPorTurma(turma) {
    const query = `
    SELECT * FROM alunos
    WHERE turma = $1
    ORDER BY id_aluno
  `;
    const { rows } = await db.query(query, [turma]);
    return rows;
}

/**
 * Lista alunos por ano de escolaridade
 */
export async function listarAlunosPorAno(ano) {
    const query = `
    SELECT * FROM alunos
    WHERE ano = $1
    ORDER BY turma, id_aluno
  `;
    const { rows } = await db.query(query, [ano]);
    return rows;
}

/**
 * Lista alunos por escola
 */
export async function listarAlunosPorEscola(escola) {
    const query = `
    SELECT * FROM alunos
    WHERE escola = $1
    ORDER BY ano, turma
  `;
    const { rows } = await db.query(query, [escola]);
    return rows;
}

/**
 * Lista alunos ativos
 */
export async function listarAlunosAtivos() {
    const query = `
    SELECT a.* FROM alunos a
    INNER JOIN users u ON u.id_user = a.id_user
    WHERE u.status = true
    ORDER BY id_aluno
  `;
    const { rows } = await db.query(query);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de aluno
 */
export async function atualizarAluno(idAluno, dados) {
    const { ano, turma, escola, id_encarregado } = dados;

    const setClauses = [];
    const values = [];

    if (ano !== undefined) {
        values.push(ano);
        setClauses.push(`ano = $${values.length}`);
    }
    if (turma !== undefined) {
        values.push(turma);
        setClauses.push(`turma = $${values.length}`);
    }
    if (escola !== undefined) {
        values.push(escola);
        setClauses.push(`escola = $${values.length}`);
    }
    if (id_encarregado !== undefined) {
        values.push(id_encarregado);
        setClauses.push(`id_encarregado = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idAluno);

    const query = `
    UPDATE alunos
    SET ${setClauses.join(', ')}
    WHERE id_aluno = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove aluno
 */
export async function removerAluno(idAluno) {
    const query = `DELETE FROM alunos WHERE id_aluno = $1 RETURNING id_aluno`;
    const { rows } = await db.query(query, [idAluno]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se aluno existe
 */
export async function alunoExiste(idAluno) {
    const query = `SELECT COUNT(*) as count FROM alunos WHERE id_aluno = $1`;
    const { rows } = await db.query(query, [idAluno]);
    return rows[0].count > 0;
}

/**
 * Verifica se já existe aluno com este id_user
 */
export async function alunoExistePorUserId(idUser) {
    const query = `SELECT COUNT(*) as count FROM alunos WHERE id_user = $1`;
    const { rows } = await db.query(query, [idUser]);
    return rows[0].count > 0;
}
