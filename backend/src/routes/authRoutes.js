import express from 'express';
import {
    login,
    alterarPassword,
    recuperarPassword,
    redefinirPassword,
    logout,
    terminarTodasSessoes,
    obterCsrfToken,
} from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireSession } from '../middlewares/roleMiddleware.js';
import {
    csrfProtectionMiddleware,
    rateLimitMiddleware,
} from '../middlewares/securityMiddleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';

/**
 * ========================================
 * AUTH ROUTES
 * ========================================
 * Rotas de autenticação e gestão de sessões de utilizadores
 *
 * Endpoints:
 * - POST /api/auth/login: Autentica utilizador (email + password)
 * - POST /api/auth/alterar-password: Altera password (requer autenticação JWT)
 *
 * Notas:
 * - Rota de login é pública (não requer autenticação prévia)
 * - Rota de alterar password requer autenticação prévia
 * ========================================
 */

const router = express.Router();

router.get('/csrf-token', obterCsrfToken);

/**
 * POST /api/auth/login
 * Autentica utilizador com email e password
 *
 * Body: {email: string, password: string}
 * Response: {user: {id, email, nome, role, primeiraLogin}, message: string}
 * Status: 200 OK | 401 Unauthorized | 500 Internal Server Error
 */
router.post(
    '/login',
    rateLimitMiddleware(10, 15),
    validateBody({
        email: { type: 'email', required: true },
        password: { type: 'string', required: true, min: 1 },
    }),
    login
);
router.post(
    '/recuperar-password',
    rateLimitMiddleware(5, 15),
    validateBody({
        email: { type: 'email', required: true },
    }),
    recuperarPassword
);

/**
 * POST /api/auth/redefinir-password
 * Define uma nova password com o token do link enviado por email
 *
 * Body: {token: string, passwordNova: string, passwordNovaConfirm: string}
 * Status: 200 OK | 400 Bad Request (token inválido/expirado) | 500
 */
router.post(
    '/redefinir-password',
    rateLimitMiddleware(10, 15),
    validateBody({
        token: { type: 'string', required: true, min: 20, max: 200 },
        passwordNova: { type: 'string', required: true, min: 8 },
        passwordNovaConfirm: { type: 'string', required: true, min: 8 },
    }),
    redefinirPassword
);

/**
 * POST /api/auth/alterar-password
 * Altera a password do utilizador autenticado
 * Requer: autenticação JWT válida
 *
 * Body: {passwordAtual: string, passwordNova: string, passwordNovaConfirm: string}
 * Response: {message: string}
 * Status: 200 OK | 400 Bad Request | 401 Unauthorized | 500 Internal Server Error
 *
 * Nota: Este endpoint deve estar protegido por middleware de autenticação JWT
 */
router.post(
    '/alterar-password',
    authMiddleware,
    requireSession(),
    validateBody({
        passwordAtual: { type: 'string', required: true, min: 1 },
        passwordNova: { type: 'string', required: true, min: 8 },
        passwordNovaConfirm: { type: 'string', required: true, min: 8 },
    }),
    alterarPassword
);

router.post('/logout', logout);

/**
 * POST /api/auth/terminar-sessoes
 * Termina a sessão em todos os dispositivos do utilizador autenticado
 * (incluindo o atual) e desativa os dispositivos de notificações push.
 */
router.post(
    '/terminar-sessoes',
    authMiddleware,
    csrfProtectionMiddleware(),
    requireSession(),
    terminarTodasSessoes
);

export default router;
