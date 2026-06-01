import express from 'express';
import {
    obterDefinicoes,
    obterMinhasPreferencias,
    atualizarPreferencias,
    marcarLido,
    listarEventos,
} from '../controllers/alertasController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

/**
 * ========================================
 * ALERTAS ROUTES
 * ========================================
 * Rotas para gestão de notificações e preferências de alertas
 *
 * Endpoints:
 * - GET /api/alertas: Lista definições (público)
 * - GET /api/alertas/minhas-preferencias: Obtém preferências do utilizador
 * - POST /api/alertas/preferencias: Atualiza preferências
 * - POST /api/alertas/marcar-lido: Marca evento como lido
 * - GET /api/alertas/eventos: Lista eventos com paginação
 *
 * Notas:
 * - Leitura de definições: pública (sem autenticação obrigatória)
 * - Resto das operações: autenticação obrigatória
 * - Utilizador extraído via req.userId (set via authMiddleware)
 * ========================================
 */

const router = express.Router();

/**
 * GET /api/alertas
 * Lista todas as definições de alertas disponíveis (catalog base)
 * Público - sem autenticação obrigatória
 *
 * Retorna alertas agrupados por categoria (grupo):
 * - financeiro
 * - academico
 * - operacional
 * - sistema
 *
 * Response: {
 *   success: true,
 *   data: {
 *     financeiro: [{id, codigo, titulo, descricao, icone, ...}],
 *     academico: [...],
 *     operacional: [...],
 *     sistema: [...]
 *   }
 * }
 *
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/', obterDefinicoes);

// Rotas abaixo requerem utilizador autenticado
router.use(authMiddleware);

/**
 * GET /api/alertas/minhas-preferencias
 * Obtém preferências pessoais do utilizador autenticado
 * Combina dados do catalog (alertas_definicoes) com preferências do user (alertas_preferencias_utilizador)
 *
 * Requer: X-User-Id header ou Authorization Bearer token
 *
 * Response: {
 *   success: true,
 *   data: [
 *     {
 *       id_alerta_preferencia: 1,
 *       id_alerta_definicao: 1,
 *       codigo: 'faturas-vencidas',
 *       titulo: 'Faturas Vencidas',
 *       grupo: 'financeiro',
 *       icone: 'CreditCard',
 *       canal_app: true,
 *       canal_email: false,
 *       ativo: true
 *     },
 *     ...
 *   ]
 * }
 *
 * Status: 200 OK | 401 Unauthorized | 500 Internal Server Error
 */
router.get('/minhas-preferencias', obterMinhasPreferencias);

/**
 * GET /api/alertas/eventos
 * Lista eventos de alertas emitidos para o utilizador autenticado
 * Suporta paginação e filtros opcionais
 *
 * Requer: X-User-Id header ou Authorization Bearer token
 *
 * Query params (optional):
 * - limite: number (max rows per page, default 50)
 * - offset: number (pagination offset, default 0)
 * - lido: boolean (filter by read status, default: all)
 * - grupo: string (filter by alert group, ex: 'financeiro')
 *
 * Response: {
 *   success: true,
 *   data: [
 *     {
 *       id_alerta_evento: 1,
 *       id_alerta_definicao: 1,
 *       codigo: 'faturas-vencidas',
 *       titulo: 'Faturas Vencidas',
 *       grupo: 'financeiro',
 *       icone: 'CreditCard',
 *       nivel: 'warning',
 *       payload: {...},
 *       lido: false,
 *       lido_em: null,
 *       criado_em: '2026-04-07T10:30:00.000Z'
 *     },
 *     ...
 *   ],
 *   total: 150,
 *   limite: 50,
 *   offset: 0
 * }
 *
 * Status: 200 OK | 401 Unauthorized | 500 Internal Server Error
 */
router.get('/eventos', listarEventos);

/**
 * POST /api/alertas/preferencias
 * Atualiza ou cria preferência de alerta específica para o utilizador
 * Utiliza função PL/pgSQL: fn_upsert_alerta_preferencia()
 *
 * Requer: X-User-Id header ou Authorization Bearer token
 *
 * Body: {
 *   codigo: string (obrigatório, ex: 'faturas-vencidas'),
 *   canal_app?: boolean (override default, ex: true),
 *   canal_email?: boolean (override default, ex: false),
 *   ativo?: boolean (enable/disable this alert for user, ex: true)
 * }
 *
 * Exemplos de chamada:
 * 1. Ativar alerta e receber via app:
 *    { "codigo": "faturas-vencidas", "canal_app": true, "ativo": true }
 *
 * 2. Desativar email mas manter app:
 *    { "codigo": "ausencias", "canal_email": false }
 *
 * 3. Desativar alerta completamente:
 *    { "codigo": "pagamentos-recebidos", "ativo": false }
 *
 * Response: {
 *   success: true,
 *   data: {
 *     id_alerta_preferencia: 1,
 *     id_user: 5,
 *     id_alerta_definicao: 1,
 *     canal_app: true,
 *     canal_email: false,
 *     ativo: true,
 *     atualizado_em: '2026-04-07T10:30:00.000Z'
 *   }
 * }
 *
 * Status: 200 OK | 400 Bad Request | 401 Unauthorized | 404 Not Found | 500 Internal Server Error
 */
router.post('/preferencias', atualizarPreferencias);

/**
 * POST /api/alertas/marcar-lido
 * Marca um evento específico de alerta como lido
 * Atualiza campos: lido = true, lido_em = NOW()
 *
 * Requer: X-User-Id header ou Authorization Bearer token
 *
 * Body: {
 *   id_alerta_evento: number (obrigatório)
 * }
 *
 * Response: {
 *   success: true,
 *   message: "Evento marcado como lido"
 * }
 *
 * Status: 200 OK | 400 Bad Request | 401 Unauthorized | 404 Not Found | 500 Internal Server Error
 */
router.post('/marcar-lido', marcarLido);

export default router;
