import express from 'express';
import {
    enviarNotificacao,
    listarNotificacoes,
} from '../controllers/manutencaoController.js';
import {
    registarDeviceToken,
    removerDeviceToken,
} from '../controllers/notificacoesController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

/**
 * ========================================
 * NOTIFICACOES ROUTES
 * ========================================
 * Rotas para gestão de notificações do sistema (broadcast)
 *
 * Endpoints:
 * - GET /api/notificacoes: Lista notificações (público)
 * - POST /api/notificacoes/broadcast: Envia notificação (apenas gestor)
 *
 * Notas:
 * - Leitura: pública (sem autenticação)
 * - Escrita: restrita a gestor autenticado
 * ========================================
 */

const router = express.Router();

/**
 * GET /api/notificacoes
 * Lista últimas 100 notificações broadcast do sistema
 * Permite utilizadores acompanhar avisos e notificações gerais
 *
 * Query: (nenhum parâmetro obrigatório)
 * Response: [{id, tipo, titulo, descricao, nivel, createdAt}]
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/', listarNotificacoes);

router.post('/device-token', authMiddleware, registarDeviceToken);

router.post('/device-token/remover', authMiddleware, removerDeviceToken);

/**
 * POST /api/notificacoes/broadcast
 * Envia notificação para todos os utilizadores registados do sistema
 * Apenas gestores autenticados podem enviar notificações broadcast
 *
 * Headers: {X-User-Id: number} + {Authorization: Bearer <token>}
 * Body: {
 *   tipo?: string (ex: 'manutencao', 'aviso', 'geral'),
 *   titulo: string (obrigatório),
 *   descricao?: string,
 *   nivel?: 'info' | 'warning' | 'danger' (default: 'info')
 * }
 * Response: {
 *   success: boolean,
 *   message: string,
 *   notification: {id, tipo, titulo, descricao, nivel, createdAt}
 * }
 * Status: 201 Created | 400 Bad Request | 401 Unauthorized | 403 Forbidden | 500 Internal Server Error
 */
router.post(
    '/broadcast',
    authMiddleware,
    roleMiddleware('gestor'),
    enviarNotificacao
);

export default router;
