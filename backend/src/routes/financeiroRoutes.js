import express from 'express';
import {
    anularMensalidade,
    anularPagamento,
    atualizarMensalidade,
    criarMensalidade,
    gerarMensalidades,
    listarMensalidades,
    listarPagamentos,
    obterContaCorrenteAluno,
    obterMensalidade,
    obterResumoFinanceiro,
    previsualizarGeracao,
    registarPagamento,
} from '../controllers/financeiroController.js';
import {
    anularFechoProfessor,
    fecharMes,
    guardarTarifa,
    listarCustosProfessores,
    listarTarifas,
    marcarPagoProfessor,
    obterDetalheProfessor,
} from '../controllers/custosProfessoresController.js';
import {
    validateBody,
    validateParams,
} from '../middlewares/validationMiddleware.js';

/**
 * ========================================
 * FINANCEIRO ROUTES
 * ========================================
 * Montadas em /api/gestor/financeiro (dentro de gestorRoutes, que já exige
 * autenticação e role='gestor').
 * ========================================
 */

const router = express.Router();

const geracaoSchema = {
    mes: { type: 'string', required: true },
    data_vencimento: { type: 'string', required: true },
};

const motivoSchema = { motivo: { type: 'string', required: true, min: 3, max: 500 } };

router.get('/resumo', obterResumoFinanceiro);

router.get('/mensalidades', listarMensalidades);
router.post('/mensalidades', validateBody({ ...geracaoSchema, id_aluno: { type: 'number', required: true } }), criarMensalidade);
router.post('/mensalidades/gerar/previsualizar', validateBody(geracaoSchema), previsualizarGeracao);
router.post('/mensalidades/gerar', validateBody(geracaoSchema), gerarMensalidades);
router.get('/mensalidades/:id', validateParams({ id: 'number' }), obterMensalidade);
router.patch(
    '/mensalidades/:id',
    validateParams({ id: 'number' }),
    validateBody({
        data_vencimento: { type: 'string', required: false },
        observacoes: { type: 'string', required: false, max: 1000 },
    }),
    atualizarMensalidade
);
router.post('/mensalidades/:id/anular', validateParams({ id: 'number' }), validateBody(motivoSchema), anularMensalidade);
router.post(
    '/mensalidades/:id/pagamentos',
    validateParams({ id: 'number' }),
    validateBody({
        valor: { type: 'number', required: true },
        data_pagamento: { type: 'string', required: true },
        metodo: { type: 'string', required: true },
        referencia: { type: 'string', required: false, max: 120 },
        observacoes: { type: 'string', required: false, max: 1000 },
    }),
    registarPagamento
);

router.get('/pagamentos', listarPagamentos);
router.post('/pagamentos/:id/anular', validateParams({ id: 'number' }), validateBody(motivoSchema), anularPagamento);

// Custos com professores (a rota /professores/tarifas tem de vir antes de /professores/:id)
router.get('/professores/tarifas', listarTarifas);
router.patch(
    '/professores/tarifas',
    validateBody({ id_modalidade: { type: 'number', required: true } }),
    guardarTarifa
);
router.get('/professores', listarCustosProfessores);
router.post('/professores/fechar', validateBody({ mes: { type: 'string', required: true } }), fecharMes);
router.post(
    '/professores/pagamentos/:id/pagar',
    validateParams({ id: 'number' }),
    validateBody({
        data_pagamento: { type: 'string', required: true },
        metodo: { type: 'string', required: true },
        referencia: { type: 'string', required: false, max: 120 },
        observacoes: { type: 'string', required: false, max: 1000 },
    }),
    marcarPagoProfessor
);
router.post('/professores/pagamentos/:id/anular', validateParams({ id: 'number' }), validateBody(motivoSchema), anularFechoProfessor);
router.get('/professores/:id', validateParams({ id: 'number' }), obterDetalheProfessor);

router.get('/alunos/:id/conta-corrente', validateParams({ id: 'number' }), obterContaCorrenteAluno);

export default router;
