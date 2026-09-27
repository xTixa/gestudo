import express from 'express';
import {
    carregarEducando,
    listarEducandos,
    obterAgendaEducando,
    obterContaCorrenteEducando,
    atualizarPerfilEncarregado,
    obterPerfilEncarregado,
    obterPresencasEducando,
} from '../controllers/encarregadoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import { requireModule } from '../config/plans.js';

/**
 * ========================================
 * ENCARREGADO ROUTES
 * ========================================
 * Área do encarregado de educação (role='encarregado'). Todas as rotas
 * /educandos/:idAluno/* validam que o aluno pertence ao encarregado.
 *
 * Endpoints:
 * - GET/PATCH /api/encarregado/perfil
 * - GET /api/encarregado/educandos
 * - GET /api/encarregado/educandos/:idAluno/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - GET /api/encarregado/educandos/:idAluno/presencas
 * - GET /api/encarregado/educandos/:idAluno/conta-corrente (módulo financeiro)
 * ========================================
 */

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('encarregado'));

router.get('/perfil', obterPerfilEncarregado);
router.patch('/perfil', atualizarPerfilEncarregado);
router.get('/educandos', listarEducandos);

router.use('/educandos/:idAluno', carregarEducando);
router.get('/educandos/:idAluno/agenda', obterAgendaEducando);
router.get('/educandos/:idAluno/presencas', obterPresencasEducando);
router.get(
    '/educandos/:idAluno/conta-corrente',
    requireModule('financeiro'),
    obterContaCorrenteEducando
);

export default router;
