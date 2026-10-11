import { createHash, randomBytes } from 'node:crypto';
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
    getCookieDomain,
} from '../middlewares/securityMiddleware.js';
import { notificarGestoresAtividadeSuspeita } from '../services/alertasDispatchService.js';

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
        domain: getCookieDomain(),
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
        domain: getCookieDomain(),
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

function registerLoginFailure(key, email, ip) {
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

    const justBlocked =
        current.count === LOGIN_MAX_ATTEMPTS && !current.blockedUntil;

    if (current.count >= LOGIN_MAX_ATTEMPTS) {
        current.blockedUntil = now + LOGIN_BLOCK_MS;
    }

    failedLoginAttempts.set(key, current);

    if (justBlocked) {
        notificarGestoresAtividadeSuspeita({ email, ip }).catch(() => {});
    }
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

/**
 * Só aceita hashes bcrypt. As passwords antigas em texto simples foram
 * convertidas na migração 027_passwords_bcrypt.sql.
 */
async function passwordConfere(password, hash) {
    if (typeof hash !== 'string' || !hash.startsWith('$2')) {
        return false;
    }
    return bcrypt.compare(String(password), hash);
}

const RESET_TOKEN_VALIDADE_MINUTOS = 30;
// Intervalo mínimo entre dois emails de recuperação para a mesma conta.
const RESET_TOKEN_INTERVALO_MINUTOS = 2;

export function hashResetToken(token) {
    return createHash('sha256').update(String(token)).digest('hex');
}

function isEmailPlaceholder(email) {
    return !email || String(email).includes('@placeholder.local');
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
 * Só aceita passwords guardadas com bcrypt
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
              ${safeRole} AS role,
             token_version
              ${selectFirstLoginFragment}
          ${selectProfileImageFragment}
             ${selectNameFragment}
      FROM public.${safeTable}
            WHERE LOWER(${safeEmail}) = LOWER($1)${statusFilter}
      LIMIT 1
    `;

        const { expiresIn } = getJwtConfig();
        const { rows } = await db.query(query, [email]);

        if (!rows.length) {
            registerLoginFailure(loginThrottleKey, email, getClientIp(req));
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const user = rows[0];
        const isValidPassword = await passwordConfere(password, user.password);

        if (!isValidPassword) {
            registerLoginFailure(loginThrottleKey, email, getClientIp(req));
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        clearLoginFailures(loginThrottleKey);

        const authToken = signAuthToken({
            id: user.id,
            role: user.role,
            email: user.email,
            tv: Number(user.token_version || 0),
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
        console.error('Erro no login:', error);
        return res.status(500).json({
            message: 'Erro interno no login.',
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
        const isValidPassword = await passwordConfere(
            passwordAtual,
            user.password
        );

        if (!isValidPassword) {
            // 400 e não 401: o frontend trata 401 como sessão expirada e
            // faria logout por um simples engano na password atual.
            return res
                .status(400)
                .json({ message: 'Password atual inválida.' });
        }

        if (passwordNova === passwordAtual) {
            return res.status(400).json({
                message: 'A nova password não pode ser igual à password atual.',
            });
        }

        // Fazer hash e atualizar
        const novaPasswordHash = await bcrypt.hash(passwordNova, 10);
        const updateFirstLoginFragment = hasFirstLogin
            ? `, ${safeFirstLogin} = false`
            : '';
        const updateQuery = `
      UPDATE ${safeTable}
      SET ${safePassword} = $1${updateFirstLoginFragment},
          token_version = token_version + 1
      WHERE ${safeId} = $2
      RETURNING ${safeId} AS id, token_version
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

                await enviarEmailPasswordAlterada(nomeAluno, user.email).catch(() => {});

                if (guardianInfo?.ee_email && !guardianInfo.ee_email.includes('@placeholder.local')) {
                    await enviarEmailPasswordAlteradaEE(
                        nomeAluno,
                        guardianInfo.ee_email
                    ).catch(() => {});
                }
            } catch (guardianErr) {
                console.error('Erro ao notificar após primeiro login:', guardianErr.message);
            }
        }

        // As outras sessões deste utilizador deixam de valer (token_version
        // foi incrementado); esta continua com um token na versão nova.
        const refreshedToken = signAuthToken({
            id: userId,
            role: req.userRole || null,
            email: user.email,
            tv: Number(updateRows[0].token_version),
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

/**
 * Termina a sessão em todos os dispositivos (incluindo este): incrementa o
 * token_version, o que invalida todos os JWT emitidos, e desativa os
 * dispositivos registados para notificações push.
 */
export async function terminarTodasSessoes(req, res) {
    try {
        await db.query(
            `UPDATE users SET token_version = token_version + 1 WHERE id_user = $1`,
            [req.userId]
        );
        await db.query(
            `UPDATE notificacoes_device_tokens
             SET ativo = false, updated_at = NOW()
             WHERE id_user = $1 AND ativo = true`,
            [req.userId]
        );

        clearAuthCookie(res);
        clearCsrfCookie(res);
        return res.status(200).json({
            message: 'Sessão terminada em todos os dispositivos.',
        });
    } catch (error) {
        console.error('Erro ao terminar todas as sessões:', error.message);
        return res
            .status(500)
            .json({ message: 'Não foi possível terminar as sessões.' });
    }
}

export async function obterCsrfToken(req, res) {
    const csrfToken = refreshCsrfCookie(res);
    return res.status(200).json({ csrfToken });
}

// Email do encarregado de um aluno, ou '' se não tiver (ou for placeholder).
async function obterEmailEncarregado(client, idUserAluno) {
    const { rows } = await client.query(
        `SELECT ue.email AS ee_email
         FROM alunos a
         INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
         LEFT JOIN users ue ON ue.id_user = e.id_user
         WHERE a.id_user = $1
         LIMIT 1`,
        [idUserAluno]
    );
    const email = rows[0]?.ee_email || '';
    return isEmailPlaceholder(email) ? '' : email;
}

const MENSAGEM_RECUPERACAO =
    'Se existir uma conta associada a este email, vai receber instruções de recuperação.';

/**
 * Envia um link de uso único para redefinir a password.
 * A password atual não é alterada aqui: só muda quando o link é usado
 * (redefinirPassword). A resposta é sempre a mesma, exista ou não a conta.
 */
export async function recuperarPassword(req, res) {
    const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();

    if (!email) {
        return res.status(400).json({ message: 'Email é obrigatório.' });
    }

    try {
        const { rows } = await db.query(
            `SELECT u.id_user AS id, u.email, LOWER(COALESCE(u.role, '')) AS role, v.nome
             FROM users u
             LEFT JOIN vw_utilizadores_nome v ON v.id_user = u.id_user
             WHERE LOWER(u.email) = $1
               AND u.status IS NOT FALSE
             LIMIT 1`,
            [email]
        );

        if (!rows.length) {
            return res.status(200).json({ message: MENSAGEM_RECUPERACAO });
        }

        const user = rows[0];

        // Evita encher a caixa de correio de alguém com pedidos repetidos.
        const { rowCount: pedidosRecentes } = await db.query(
            `SELECT 1 FROM password_reset_tokens
             WHERE id_user = $1
               AND used_at IS NULL
               AND created_at > NOW() - make_interval(mins => $2)
             LIMIT 1`,
            [user.id, RESET_TOKEN_INTERVALO_MINUTOS]
        );
        if (pedidosRecentes > 0) {
            return res.status(200).json({ message: MENSAGEM_RECUPERACAO });
        }

        const token = randomBytes(32).toString('base64url');
        await db.query(
            `INSERT INTO password_reset_tokens (id_user, token_hash, expires_at)
             VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
            [user.id, hashResetToken(token), RESET_TOKEN_VALIDADE_MINUTOS]
        );

        const nome = user.role === 'gestor' ? 'Utilizador' : user.nome || 'Utilizador';
        const linkPath = `/redefinir-password?token=${token}`;
        const destinatarios = [];

        if (!isEmailPlaceholder(user.email)) {
            destinatarios.push(
                enviarEmailRecuperacaoPassword(nome, user.email, linkPath, RESET_TOKEN_VALIDADE_MINUTOS)
            );
        }

        // Alunos menores podem não ter email próprio: o encarregado também recebe o link.
        if (user.role === 'aluno') {
            const eeEmail = await obterEmailEncarregado(db, user.id);
            if (eeEmail) {
                destinatarios.push(
                    enviarEmailRecuperacaoPasswordEE(nome, eeEmail, linkPath, RESET_TOKEN_VALIDADE_MINUTOS)
                );
            }
        }

        const resultados = await Promise.all(destinatarios);
        if (!resultados.some((resultado) => resultado.ok)) {
            // Não se responde com erro para não revelar que a conta existe.
            console.error(
                `Recuperação de password: nenhum email enviado para o utilizador ${user.id}.`
            );
        }

        return res.status(200).json({ message: MENSAGEM_RECUPERACAO });
    } catch (error) {
        console.error('Erro ao recuperar password:', error.message);
        return res.status(500).json({
            message: 'Não foi possível processar a recuperação de password.',
        });
    }
}

/**
 * Define uma nova password a partir do link enviado por recuperarPassword.
 * Body: { token, passwordNova, passwordNovaConfirm }
 */
export async function redefinirPassword(req, res) {
    const token = String(req.body?.token || '').trim();
    const { passwordNova, passwordNovaConfirm } = req.body || {};

    if (passwordNova !== passwordNovaConfirm) {
        return res
            .status(400)
            .json({ message: 'A nova password não coincide.' });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT t.id_token, t.id_user, u.email, LOWER(COALESCE(u.role, '')) AS role, v.nome
             FROM password_reset_tokens t
             INNER JOIN users u ON u.id_user = t.id_user
             LEFT JOIN vw_utilizadores_nome v ON v.id_user = t.id_user
             WHERE t.token_hash = $1
               AND t.used_at IS NULL
               AND t.expires_at > NOW()
               AND u.status IS NOT FALSE
             FOR UPDATE OF t`,
            [hashResetToken(token)]
        );

        if (!rows.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                code: 'RESET_TOKEN_INVALIDO',
                message:
                    'O link de recuperação é inválido ou expirou. Peça um novo.',
            });
        }

        const pedido = rows[0];
        const passwordHash = await bcrypt.hash(passwordNova, 10);

        await client.query(
            `UPDATE users
             SET password = $1, primeira_login = false, token_version = token_version + 1
             WHERE id_user = $2`,
            [passwordHash, pedido.id_user]
        );

        // O link usado e quaisquer outros pendentes deixam de funcionar.
        await client.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE id_user = $1 AND used_at IS NULL`,
            [pedido.id_user]
        );

        await client.query('COMMIT');

        const nome =
            pedido.role === 'gestor' ? 'Utilizador' : pedido.nome || 'Utilizador';
        if (!isEmailPlaceholder(pedido.email)) {
            enviarEmailPasswordAlterada(nome, pedido.email).catch(() => {});
        }
        if (pedido.role === 'aluno') {
            obterEmailEncarregado(db, pedido.id_user)
                .then((eeEmail) =>
                    eeEmail ? enviarEmailPasswordAlteradaEE(nome, eeEmail) : null
                )
                .catch(() => {});
        }

        return res.status(200).json({
            message: 'Password redefinida com sucesso. Já pode iniciar sessão.',
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao redefinir password:', error.message);
        return res
            .status(500)
            .json({ message: 'Não foi possível redefinir a password.' });
    } finally {
        client.release();
    }
}
