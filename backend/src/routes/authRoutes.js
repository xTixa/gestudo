import express from 'express';
import {
    login,
    alterarPassword,
    recuperarPassword,
    logout,
    obterCsrfToken,
} from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { rateLimitMiddleware } from '../middlewares/securityMiddleware.js';
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
    validateBody({
        passwordAtual: { type: 'string', required: true, min: 1 },
        passwordNova: { type: 'string', required: true, min: 8 },
        passwordNovaConfirm: { type: 'string', required: true, min: 8 },
    }),
    alterarPassword
);

router.post('/logout', logout);

export default router;
