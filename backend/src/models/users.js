import { db } from '../config/db.js';

/**
 * MODEL: Users
 * Operações de dados para tabela users (autenticação e controlo de acesso)
 *
 * Schema:
 * - id_user (PK): Identificador único
 * - email: Email único do utilizador
 * - password: Password (plaintext ou bcrypt hash)
 * - role: Papel do utilizador (aluno, professor, gestor, admin)
 * - status: Status da conta (ativo, inativo, bloqueado)
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo utilizador no sistema
 * @param {string} email - Email único
 * @param {string} password - Password (será hasheada pelo controller)
 * @param {string} role - Papel (aluno, professor, gestor, admin)
 * @param {boolean} status - Status ativo/inativo
 * @returns {Object} Utilizador criado
 */
export async function criarUser(email, password, role, status = true) {
    const query = `
    INSERT INTO users (email, password, role, status)
    VALUES ($1, $2, $3, $4)
    RETURNING id_user, email, role, status, imagem_perfil_url, created_at
  `;
    const { rows } = await db.query(query, [email, password, role, status]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém utilizador por ID
 */
export async function obterUserPorId(idUser) {
    const query = `SELECT id_user, email, role, status, imagem_perfil_url, created_at FROM users WHERE id_user = $1`;
    const { rows } = await db.query(query, [idUser]);
    return rows[0];
}

/**
 * Obtém utilizador por email
 */
export async function obterUserPorEmail(email) {
    const query = `SELECT id_user, email, password, role, status, imagem_perfil_url, created_at FROM users WHERE email = $1`;
    const { rows } = await db.query(query, [email]);
    return rows[0];
}

/**
 * Lista todos os utilizadores
 */
export async function listarUsers() {
    const query = `
    SELECT id_user, email, role, status, imagem_perfil_url, created_at
    FROM users
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista utilizadores por role
 */
export async function listarUsersPorRole(role) {
    const query = `
    SELECT id_user, email, role, status, imagem_perfil_url, created_at
    FROM users
    WHERE role = $1
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query, [role]);
    return rows;
}

/**
 * Lista utilizadores ativos
 */
export async function listarUsersAtivos() {
    const query = `
    SELECT id_user, email, role, status, imagem_perfil_url, created_at
    FROM users
    WHERE status = true
    ORDER BY created_at DESC
  `;
    const { rows } = await db.query(query);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de utilizador
 */
export async function atualizarUser(idUser, dados) {
    const { email, password, role, status, imagem_perfil_url } = dados;

    const setClauses = [];
    const values = [];

    if (email !== undefined) {
        values.push(email);
        setClauses.push(`email = $${values.length}`);
    }
    if (password !== undefined) {
        values.push(password);
        setClauses.push(`password = $${values.length}`);
    }
    if (role !== undefined) {
        values.push(role);
        setClauses.push(`role = $${values.length}`);
    }
    if (status !== undefined) {
        values.push(status);
        setClauses.push(`status = $${values.length}`);
    }
    if (imagem_perfil_url !== undefined) {
        values.push(imagem_perfil_url);
        setClauses.push(`imagem_perfil_url = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idUser);

    const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id_user = $${values.length}
    RETURNING id_user, email, role, status, imagem_perfil_url, created_at
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

/**
 * Altera password de utilizador
 */
export async function alterarPassword(idUser, novaPassword) {
    const query = `
    UPDATE users
    SET password = $1
    WHERE id_user = $2
    RETURNING id_user, email, role, imagem_perfil_url
  `;
    const { rows } = await db.query(query, [novaPassword, idUser]);
    return rows[0];
}

/**
 * Altera status de utilizador
 */
export async function alterarStatus(idUser, novoStatus) {
    const query = `
    UPDATE users
    SET status = $1
    WHERE id_user = $2
    RETURNING id_user, email, role, status, imagem_perfil_url
  `;
    const { rows } = await db.query(query, [novoStatus, idUser]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove utilizador (soft delete)
 */
export async function removerUser(idUser) {
    const query = `
    UPDATE users
    SET status = false
    WHERE id_user = $1
    RETURNING id_user, email, role, status, imagem_perfil_url
  `;
    const { rows } = await db.query(query, [idUser]);
    return rows[0];
}

/**
 * Remove utilizador de forma permanente
 */
export async function removerUserPermanente(idUser) {
    const query = `DELETE FROM users WHERE id_user = $1 RETURNING id_user`;
    const { rows } = await db.query(query, [idUser]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se email já existe
 */
export async function emailJaExiste(email) {
    const query = `SELECT COUNT(*) as count FROM users WHERE email = $1`;
    const { rows } = await db.query(query, [email]);
    return rows[0].count > 0;
}

/**
 * Verifica se utilizador existe
 */
export async function userExiste(idUser) {
    const query = `SELECT COUNT(*) as count FROM users WHERE id_user = $1`;
    const { rows } = await db.query(query, [idUser]);
    return rows[0].count > 0;
}
