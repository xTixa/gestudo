import express from 'express';
import {
    obterMeuPerfil,
    atualizarMeuPerfil,
} from '../controllers/alunoController.js';
import { listarMinhasPresencasAluno } from '../controllers/presencasController.js';
import {
    listarOpcoesInscricao,
    criarReinscricaoAluno,
} from '../controllers/inscricaoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('aluno'));

router.get('/perfil', obterMeuPerfil);
router.patch('/perfil', atualizarMeuPerfil);
router.get('/presencas', listarMinhasPresencasAluno);

// Rotas de reinscrição (nível/ano/turma/plano apenas). A renovação da
// matrícula acontece quando o gestor aprova o pedido de reinscrição
// (ver atualizarEstadoInscricaoPublica em inscricaoController.js).
router.get('/reinscricao/opcoes', listarOpcoesInscricao);
router.post('/reinscricao', criarReinscricaoAluno);

export default router;
