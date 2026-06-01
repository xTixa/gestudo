import express from 'express';
import { buscarGlobal } from '../controllers/searchController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddlewareMultiple } from '../middlewares/roleMiddleware.js';

/**
 * ROTAS: Busca Global
 * ========================================
 * Endpoint público para procurar alunos, professores e serviços
 *
 * Autenticação: OBRIGATÓRIA (todos os utilizadores)
 * ========================================
 */

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddlewareMultiple(['gestor', 'professor', 'aluno']));

/**
 * GET /api/busca
 * Buscar alunos, professores e serviços
 * Query: ?q=termo
 *
 * Resposta:
 * {
 *   "success": true,
 *   "data": {
 *     "alunos": [{ "id", "nome", "tipo" }],
 *     "professores": [{ "id", "nome", "tipo" }],
 *     "servicos": [{ "id", "nome", "tipo" }]
 *   }
 * }
 */
router.get('/', buscarGlobal);

export default router;
