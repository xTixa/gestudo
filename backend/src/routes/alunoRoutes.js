import express from 'express';
import {
    obterMeuPerfil,
    atualizarMeuPerfil,
} from '../controllers/alunoController.js';
import { listarMinhasPresencasAluno } from '../controllers/presencasController.js';
import {
    obterStatusRenovacao,
    renovarMatriculaAluno,
} from '../controllers/renovacaoMatriculaController.js';
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

// Rotas de renovação de matrícula
router.get('/renovacao/status', obterStatusRenovacao);
router.post('/renovacao/renovar', renovarMatriculaAluno);

// Rotas de reinscrição (nível/ano/turma/plano apenas)
router.get('/reinscricao/opcoes', listarOpcoesInscricao);
router.post('/reinscricao', criarReinscricaoAluno);

export default router;
