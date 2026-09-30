import express from 'express';
import {
    arquivarConversa,
    iniciarConversa,
    marcarLida,
    obterContactos,
    obterConversas,
    obterMensagens,
    obterNaoLidas,
    responder,
} from '../controllers/mensagensController.js';
import { requireModule } from '../config/plans.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { rateLimitMiddleware } from '../middlewares/securityMiddleware.js';
import { roleMiddlewareMultiple } from '../middlewares/roleMiddleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';

/**
 * ========================================
 * ROTAS: Mensagens internas
 * ========================================
 * Autenticação obrigatória para gestor, professor, aluno e encarregado.
 * Módulo "mensagens" (pacote Plus ou superior).
 * ========================================
 */

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddlewareMultiple(['gestor', 'professor', 'aluno', 'encarregado']));
router.use(requireModule('mensagens'));

// Limite de envio por utilizador (não por IP: num centro vários
// funcionários partilham o mesmo IP), para travar spam em massa.
const limiteEnvio = rateLimitMiddleware(60, 5, { keyFn: (req) => `user:${req.userId}` });

router.get('/contactos', obterContactos);
router.get('/nao-lidas', obterNaoLidas);
router.get('/conversas', obterConversas);
router.post(
    '/conversas',
    limiteEnvio,
    validateBody({
        mensagem: { type: 'string', required: true },
        assunto: { type: 'string' },
    }),
    iniciarConversa
);
router.get('/conversas/:id/mensagens', obterMensagens);
router.post(
    '/conversas/:id/mensagens',
    limiteEnvio,
    validateBody({ corpo: { type: 'string', required: true } }),
    responder
);
router.post('/conversas/:id/lida', marcarLida);
router.patch(
    '/conversas/:id',
    validateBody({ arquivada: { type: 'boolean', required: true } }),
    arquivarConversa
);

export default router;
