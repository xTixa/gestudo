import express from 'express';
import {
    criarPedidoReagendamentoProfessor,
    listarPedidosReagendamentoProfessor,
    listarServicosProfessorResumo,
    listarAlunosParaProfessor,
    obterPerfilProfessorLogado,
    atualizarMeuPerfilProfessor,
} from '../controllers/professorController.js';
import {
    guardarPresencasProfessor,
    obterPresencaProfessor,
    listarServicosParaPresencaProfessor,
    obterHistoricoPresencasServicoProfessor,
    listarTabelaAssiduidadeProfessor,
} from '../controllers/presencasController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('professor'));

router.get('/perfil', obterPerfilProfessorLogado);
router.patch('/perfil', atualizarMeuPerfilProfessor);
router.get('/servicos', listarServicosProfessorResumo);
router.get('/alunos', listarAlunosParaProfessor);
router.get('/presencas/servicos', listarServicosParaPresencaProfessor);
router.get('/presencas/assiduidade', listarTabelaAssiduidadeProfessor);
router.get('/presencas/:id_servico/historico', obterHistoricoPresencasServicoProfessor);
router.get('/presencas/:id_servico', obterPresencaProfessor);
router.post('/presencas', guardarPresencasProfessor);
router.get('/reagendamentos', listarPedidosReagendamentoProfessor);
router.post('/reagendamentos', criarPedidoReagendamentoProfessor);

export default router;
