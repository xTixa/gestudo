import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import {
    enviarEmailPasswordAlterada,
    enviarEmailPasswordAlteradaEE,
    enviarEmailRecuperacaoPassword,
    enviarEmailRecuperacaoPasswordEE,
} from '../services/emailService.js';
import {
    createCsrfToken,
    setCsrfCookie,
    clearCsrfCookie,
} from '../middlewares/securityMiddleware.js';

/**
 * ========================================
 * AUTH CONTROLLER
 * ========================================
 * Responsável pela autenticação de utilizadores no sistema.
 * Fornece funcionalidades de login com validação de credenciais e suporte a hashing de passwords.
 * ========================================
 */

/**
 * Configurações de autenticação - permitem flexibilidade para diferentes esquemas de base de dados
 * As propriedades podem ser sobrescritas por variáveis de ambiente para adaptação a diferentes estruturas de tabelas
 */
const userTable = process.env.AUTH_TABLE || 'users';
const idColumn = process.env.AUTH_ID_COLUMN || 'id_user';
const emailColumn = process.env.AUTH_EMAIL_COLUMN || 'email';
const passwordColumn = process.env.AUTH_PASSWORD_COLUMN || 'password';
const roleColumn = process.env.AUTH_ROLE_COLUMN || 'role';
const statusColumn = process.env.AUTH_STATUS_COLUMN || 'status';
const requireActiveUser = process.env.AUTH_REQUIRE_ACTIVE !== 'false';
const nameColumn = process.env.AUTH_NAME_COLUMN || '';
const profileImageColumn = process.env.AUTH_IMAGE_COLUMN || 'imagem_perfil_url';
const firstLoginColumn =
    process.env.AUTH_FIRST_LOGIN_COLUMN || 'primeira_login';

let firstLoginColumnExistsCache;
let profileImageColumnExistsCache;

const failedLoginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;

function getAuthCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
        domain: isProduction ? '.blocodenotas.pt' : undefined,
        maxAge: Number(
            process.env.JWT_COOKIE_MAX_AGE_MS || 12 * 60 * 60 * 1000
        ),
    };
}

function setAuthCookie(res, token) {
    res.cookie('mc_token', token, getAuthCookieOptions());
}

function clearAuthCookie(res) {
    res.clearCookie('mc_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
}

function refreshCsrfCookie(res) {
    const csrfToken = createCsrfToken();
    setCsrfCookie(res, csrfToken);
    return csrfToken;
}

function getClientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getLoginThrottleKey(req, email) {
    return `${String(email || '').toLowerCase()}::${getClientIp(req)}`;
}

function isLoginBlocked(key) {
    const current = failedLoginAttempts.get(key);
    if (!current) {
        return { blocked: false, retryAfterSeconds: 0 };
    }

    if (current.blockedUntil && current.blockedUntil > Date.now()) {
        return {
            blocked: true,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((current.blockedUntil - Date.now()) / 1000)
            ),
        };
    }

    if (current.blockedUntil && current.blockedUntil <= Date.now()) {
        failedLoginAttempts.delete(key);
    }

    return { blocked: false, retryAfterSeconds: 0 };
}

function registerLoginFailure(key) {
    const now = Date.now();
    const current = failedLoginAttempts.get(key) || {
        count: 0,
        firstAttemptAt: now,
        blockedUntil: null,
    };

    if (now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
        current.count = 0;
        current.firstAttemptAt = now;
        current.blockedUntil = null;
    }

    current.count += 1;

    if (current.count >= LOGIN_MAX_ATTEMPTS) {
        current.blockedUntil = now + LOGIN_BLOCK_MS;
    }

    failedLoginAttempts.set(key, current);
}

function clearLoginFailures(key) {
    failedLoginAttempts.delete(key);
}

function getJwtConfig() {
    const secret = String(process.env.JWT_SECRET || '').trim();
    const expiresIn = String(process.env.JWT_EXPIRES_IN || '12h').trim();
    return { secret, expiresIn };
}

function signAuthToken(payload) {
    const { secret, expiresIn } = getJwtConfig();
    if (!secret) {
        throw new Error('JWT_SECRET não configurado');
    }

    return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Sanitiza identificadores de base de dados (nomes de tabelas, colunas) para evitar SQL injection
 * Remove todos os caracteres que não sejam alfanuméricos ou underscore
 *
 * @param {string} identifier - O identificador a sanitizar
 * @returns {string} Identificador seguro
 */
function sanitizeIdentifier(identifier) {
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

function gerarPasswordTemporaria() {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function hasFirstLoginColumn(safeTable, safeFirstLoginColumn) {
    if (!safeFirstLoginColumn) {
        return false;
    }

    if (typeof firstLoginColumnExistsCache === 'boolean') {
        return firstLoginColumnExistsCache;
    }

    try {
        const existsQuery = `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = $1
        AND column_name = $2
      LIMIT 1
    `;

        const { rowCount } = await db.query(existsQuery, [
            safeTable,
            safeFirstLoginColumn,
        ]);
        firstLoginColumnExistsCache = rowCount > 0;
        return firstLoginColumnExistsCache;
    } catch (error) {
        // Se não for possível verificar metadata, desativa a funcionalidade de primeira login sem bloquear auth.
        console.warn(
            'Aviso ao verificar coluna de primeira login:',
            error.message
        );
        firstLoginColumnExistsCache = false;
        return false;
    }
}

async function hasProfileImageColumn(safeTable, safeProfileImageColumn) {
    if (!safeProfileImageColumn) {
        return false;
    }

    if (typeof profileImageColumnExistsCache === 'boolean') {
        return profileImageColumnExistsCache;
    }

    try {
        const existsQuery = `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = $1
        AND column_name = $2
      LIMIT 1
    `;

        const { rowCount } = await db.query(existsQuery, [
            safeTable,
            safeProfileImageColumn,
        ]);
        profileImageColumnExistsCache = rowCount > 0;
        return profileImageColumnExistsCache;
    } catch (error) {
        console.warn(
            'Aviso ao verificar coluna de imagem de perfil:',
            error.message
        );
        profileImageColumnExistsCache = false;
        return false;
    }
}

/**
 * Autentica um utilizador validando email e password
 * Retorna dados do utilizador (ID, email, nome, role) se autenticação bem-sucedida
 * Suporta passwords em plaintext ou hasheadas com bcrypt
 *
 * @param {Object} req - Objecto de requisição com body {email, password}
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Dados do utilizador autenticado ou erro 401/500
 */
export async function login(req, res) {
    const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();
    const password = req.body?.password;

    if (!email || !password) {
        return res
            .status(400)
            .json({ message: 'Email e password são obrigatórios.' });
    }

    const loginThrottleKey = getLoginThrottleKey(req, email);
    const throttleState = isLoginBlocked(loginThrottleKey);
    if (throttleState.blocked) {
        return res.status(429).json({
            message:
                'Demasiadas tentativas de login. Tente novamente mais tarde.',
            retryAfter: throttleState.retryAfterSeconds,
        });
    }

    const safeTable = sanitizeIdentifier(userTable);
    const safeId = sanitizeIdentifier(idColumn);
    const safeEmail = sanitizeIdentifier(emailColumn);
    const safePassword = sanitizeIdentifier(passwordColumn);
    const safeRole = sanitizeIdentifier(roleColumn);
    const safeStatus = sanitizeIdentifier(statusColumn);
    const safeName = sanitizeIdentifier(nameColumn || '');
    const safeProfileImage = sanitizeIdentifier(profileImageColumn || '');
    const safeFirstLogin = sanitizeIdentifier(firstLoginColumn || '');
    const hasFirstLogin = await hasFirstLoginColumn(safeTable, safeFirstLogin);
    const hasProfileImage = await hasProfileImageColumn(
        safeTable,
        safeProfileImage
    );

    const selectNameFragment = safeName ? `, ${safeName} AS nome` : '';
    const selectProfileImageFragment = hasProfileImage
        ? `, ${safeProfileImage} AS imagem_perfil_url`
        : `, NULL::text AS imagem_perfil_url`;
    const selectFirstLoginFragment = hasFirstLogin
        ? `, ${safeFirstLogin} AS primeira_login`
        : `, false AS primeira_login`;
    const statusFilter = requireActiveUser ? ` AND ${safeStatus} = true` : '';

    try {
        const query = `
      SELECT ${safeId} AS id,
             ${safeEmail} AS email,
             ${safePassword} AS password,
              ${safeRole} AS role
              ${selectFirstLoginFragment}
          ${selectProfileImageFragment}
             ${selectNameFragment}
      FROM public.${safeTable}
            WHERE LOWER(${safeEmail}) = LOWER($1)${statusFilter}
      LIMIT 1
    `;

        const { expiresIn } = getJwtConfig();
        console.log('Tabela:', safeTable);
        console.log('Query:', query);
        const { rows } = await db.query(query, [email]);

        if (!rows.length) {
            registerLoginFailure(loginThrottleKey);
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const user = rows[0];
        const isHash =
            typeof user.password === 'string' && user.password.startsWith('$2');
        const isValidPassword = isHash
            ? await bcrypt.compare(password, user.password)
            : password === String(user.password);

        if (!isValidPassword) {
            registerLoginFailure(loginThrottleKey);
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        clearLoginFailures(loginThrottleKey);

        const authToken = signAuthToken({
            id: user.id,
            role: user.role,
            email: user.email,
        });
        setAuthCookie(res, authToken);
        const csrfToken = refreshCsrfCookie(res);

        return res.status(200).json({
            message: 'Login efetuado com sucesso.',
            tokenExpiresIn: expiresIn,
            token: authToken,
            csrfToken,
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome || null,
                imagem_perfil_url: user.imagem_perfil_url || null,
                role: user.role,
                primeiraLogin: user.primeira_login === true,
            },
        });
    } catch (error) {
        console.error('ERRO COMPLETO:', error);
        return res.status(500).json({
            message: 'Erro interno no login.',
            error: error.message,
        });
    }
}

/**
 * Altera a password do utilizador
 * Valida a password atual antes de permitir mudança
 * Marca primeira_login como false após sucesso
 *
 * @param {Object} req - Objecto de requisição (body: {passwordAtual, passwordNova, passwordNovaConfirm}, req.userId via middleware)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Mensagem de sucesso ou erro
 */
export async function alterarPassword(req, res) {
    const userId = req.userId; // Do middleware de autenticação
    const { passwordAtual, passwordNova, passwordNovaConfirm } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'Não autenticado.' });
    }

    if (!passwordAtual || !passwordNova || !passwordNovaConfirm) {
        return res.status(400).json({ message: 'Preencha todos os campos.' });
    }

    if (passwordNova !== passwordNovaConfirm) {
        return res
            .status(400)
            .json({ message: 'A nova password não coincide.' });
    }

    if (passwordNova.length < 8) {
        return res
            .status(400)
            .json({ message: 'A password deve ter pelo menos 8 caracteres.' });
    }

    try {
        const safeTable = sanitizeIdentifier(userTable);
        const safeId = sanitizeIdentifier(idColumn);
        const safePassword = sanitizeIdentifier(passwordColumn);
        const safeRole = sanitizeIdentifier(roleColumn);
        const safeEmail = sanitizeIdentifier(emailColumn);
        const safeFirstLogin = sanitizeIdentifier(firstLoginColumn || '');
        const hasFirstLogin = await hasFirstLoginColumn(
            safeTable,
            safeFirstLogin
        );

        const firstLoginSelect = hasFirstLogin
            ? `, ${safeFirstLogin} AS primeira_login`
            : '';

        // Buscar password atual do utilizador
        const userQuery = `
      SELECT ${safePassword} AS password, ${safeRole} AS role, ${safeEmail} AS email${firstLoginSelect}
      FROM ${safeTable}
      WHERE ${safeId} = $1
      LIMIT 1
    `;

        const { rows: userRows } = await db.query(userQuery, [userId]);

        if (!userRows.length) {
            return res
                .status(404)
                .json({ message: 'Utilizador não encontrado.' });
        }

        const user = userRows[0];
        const isHash =
            typeof user.password === 'string' && user.password.startsWith('$2');
        const isValidPassword = isHash
            ? await bcrypt.compare(passwordAtual, user.password)
            : passwordAtual === String(user.password);

        if (!isValidPassword) {
            return res
                .status(401)
                .json({ message: 'Password atual inválida.' });
        }

        // Fazer hash e atualizar
        const novaPasswordHash = await bcrypt.hash(passwordNova, 10);
        const updateFirstLoginFragment = hasFirstLogin
            ? `, ${safeFirstLogin} = false`
            : '';
        const updateQuery = `
      UPDATE ${safeTable}
      SET ${safePassword} = $1${updateFirstLoginFragment}
      WHERE ${safeId} = $2
      RETURNING ${safeId} AS id
    `;

        const { rows: updateRows } = await db.query(updateQuery, [
            novaPasswordHash,
            userId,
        ]);

        if (!updateRows.length) {
            return res
                .status(500)
                .json({ message: 'Erro ao atualizar password.' });
        }

        // Notificar aluno e encarregado de educação no primeiro login
        if (hasFirstLogin && user.primeira_login && String(user.role || '').toLowerCase() === 'aluno') {
            try {
                const { rows: guardianRows } = await db.query(
                    `SELECT p.nome AS aluno_nome, ue.email AS ee_email
                     FROM alunos a
                     INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                     INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
                     LEFT JOIN users ue ON ue.id_user = e.id_user
                     WHERE a.id_user = $1
                     LIMIT 1`,
                    [userId]
                );
                const guardianInfo = guardianRows[0];
                const nomeAluno = guardianInfo?.aluno_nome || user.email;

                await enviarEmailPasswordAlterada(nomeAluno, user.email, passwordNova).catch(() => {});

                if (guardianInfo?.ee_email && !guardianInfo.ee_email.includes('@placeholder.local')) {
                    await enviarEmailPasswordAlteradaEE(
                        nomeAluno,
                        guardianInfo.ee_email,
                        passwordNova
                    ).catch(() => {});
                }
            } catch (guardianErr) {
                console.error('Erro ao notificar após primeiro login:', guardianErr.message);
            }
        }

        const refreshedToken = signAuthToken({
            id: userId,
            role: req.userRole || null,
        });
        setAuthCookie(res, refreshedToken);
        const csrfToken = refreshCsrfCookie(res);

        return res.status(200).json({
            message: 'Password alterada com sucesso.',
            tokenExpiresIn: getJwtConfig().expiresIn,
            csrfToken,
        });
    } catch (error) {
        console.error('Erro ao alterar password:', error.message);
        return res.status(500).json({ message: 'Erro ao alterar password.' });
    }
}

export async function logout(req, res) {
    clearAuthCookie(res);
    clearCsrfCookie(res);
    return res.status(200).json({
        message: 'Sessão terminada com sucesso.',
    });
}

export async function obterCsrfToken(req, res) {
    const csrfToken = refreshCsrfCookie(res);
    return res.status(200).json({ csrfToken });
}

export async function recuperarPassword(req, res) {
    const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();

    if (!email) {
        return res.status(400).json({ message: 'Email é obrigatório.' });
    }

    const safeTable = sanitizeIdentifier(userTable);
    const safeId = sanitizeIdentifier(idColumn);
    const safeEmail = sanitizeIdentifier(emailColumn);
    const safePassword = sanitizeIdentifier(passwordColumn);
    const safeName = sanitizeIdentifier(nameColumn || '');
    const safeFirstLogin = sanitizeIdentifier(firstLoginColumn || '');

    const selectNameFragment = safeName ? `, ${safeName} AS nome` : '';
    const hasFirstLogin = await hasFirstLoginColumn(safeTable, safeFirstLogin);

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const safeRole = sanitizeIdentifier(roleColumn);
        const userQuery = `
            SELECT ${safeId} AS id, ${safeEmail} AS email, ${safeRole} AS role${selectNameFragment}
            FROM ${safeTable}
            WHERE LOWER(${safeEmail}) = LOWER($1)
            LIMIT 1
        `;

        const { rows } = await client.query(userQuery, [email]);

        if (!rows.length) {
            await client.query('COMMIT');
            return res.status(200).json({
                message:
                    'Se existir uma conta associada a este email, vai receber instruções de recuperação.',
            });
        }

        const user = rows[0];
        const passwordTemporaria = gerarPasswordTemporaria();
        const passwordHash = await bcrypt.hash(passwordTemporaria, 10);
        const updateFirstLoginFragment = hasFirstLogin
            ? `, ${safeFirstLogin} = true`
            : '';

        const updateQuery = `
            UPDATE ${safeTable}
            SET ${safePassword} = $1${updateFirstLoginFragment}
            WHERE ${safeId} = $2
        `;

        await client.query(updateQuery, [passwordHash, user.id]);

        const nome = user.nome || 'Utilizador';
        const emailResult = await enviarEmailRecuperacaoPassword(
            nome,
            user.email,
            passwordTemporaria
        );

        if (!emailResult.ok) {
            throw new Error(
                emailResult.error || 'Não foi possível enviar o email.'
            );
        }

        // Se for aluno, notificar também o encarregado de educação
        if (String(user.role || '').toLowerCase() === 'aluno') {
            try {
                const { rows: guardianRows } = await client.query(
                    `SELECT ue.email AS ee_email
                     FROM alunos a
                     INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
                     LEFT JOIN users ue ON ue.id_user = e.id_user
                     WHERE a.id_user = $1
                     LIMIT 1`,
                    [user.id]
                );
                const eeEmail = guardianRows[0]?.ee_email || '';
                if (eeEmail && !eeEmail.includes('@placeholder.local')) {
                    await enviarEmailRecuperacaoPasswordEE(nome, eeEmail, passwordTemporaria).catch(() => {});
                }
            } catch (eeErr) {
                console.error('Erro ao notificar encarregado na recuperação de password:', eeErr.message);
            }
        }

        await client.query('COMMIT');

        return res.status(200).json({
            message:
                'Se existir uma conta associada a este email, vai receber instruções de recuperação.',
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao recuperar password:', error.message);
        return res.status(500).json({
            message: 'Não foi possível processar a recuperação de password.',
        });
    } finally {
        client.release();
    }
}
