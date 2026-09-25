import express from 'express';
import {
    listarAlunos,
    obterAluno,
    atualizarAluno,
    criarAluno,
    alterarEstadoAluno,
    eliminarAlunoDefinitivo,
    resetarPasswordAluno,
    adicionarServicoCurricularAluno,
    removerServicoAluno,
    atualizarDisciplinasPretendidasAluno,
} from '../controllers/alunoController.js';
import {
    listarProfessores,
    obterProfessor,
    atualizarProfessor,
    importarProfessores,
    criarProfessor,
    alterarEstadoProfessor,
    eliminarProfessorDefinitivo,
} from '../controllers/professorController.js';
import {
    obterGraficosDashboard,
    obterResumoDashboard,
} from '../controllers/dashboardController.js';
import { listarLogs } from '../controllers/logsController.js';
import { listarTabelaPresencasGestor } from '../controllers/presencasController.js';
import {
    listarDisciplinasCatalogo,
    criarDisciplinaCatalogo,
    atualizarDisciplinaCatalogo,
    eliminarDisciplinaCatalogo,
    listarModalidadesCatalogo,
    criarModalidadeCatalogo,
    atualizarModalidadeCatalogo,
    eliminarModalidadeCatalogo,
    listarSalasCatalogo,
    criarSalaCatalogo,
    atualizarSalaCatalogo,
    eliminarSalaCatalogo,
    listarPacotesCatalogo,
    criarPacoteCatalogo,
    atualizarPacoteCatalogo,
    eliminarPacoteCatalogo,
    listarTiposServicoCatalogo,
    criarTipoServicoCatalogo,
    atualizarTipoServicoCatalogo,
    eliminarTipoServicoCatalogo,
    listarTiposServicoExtraCatalogo,
    criarTipoServicoExtraCatalogo,
    atualizarTipoServicoExtraCatalogo,
    eliminarTipoServicoExtraCatalogo,
} from '../controllers/gestaoInternaController.js';
import {
    listarEmailTemplates,
    obterEmailTemplate,
    atualizarEmailTemplate,
    reporEmailTemplate,
} from '../controllers/emailTemplatesController.js';
import {
    listarInscricaoTextos,
    atualizarInscricaoTextos,
    reporInscricaoTexto,
} from '../controllers/inscricaoFormTextosController.js';
import {
    listarFeatureFlags,
    atualizarFeatureFlag,
} from '../controllers/featureFlagsController.js';
import {
    listarAlunosMatriculaExpirada,
    suspenderAlunosExpirados,
    renovarMatriculaAlunoPorGestor,
} from '../controllers/renovacaoMatriculaController.js';
import {
    listarRelatorioGestor,
    listarSalasDisponiveis,
} from '../controllers/relatoriosController.js';
import {
    listarServicosCurriculares,
    listarOpcoesServicoCurricular,
    criarServicoCurricular,
    atualizarServicoCurricular,
    eliminarServicoCurricular,
} from '../controllers/curricularController.js';
import {
    listarServicosExtraCurriculares,
    listarOpcoesServicoExtraCurricular,
    criarServicoExtraCurricular,
    atualizarServicoExtraCurricular,
    eliminarServicoExtraCurricular,
} from '../controllers/extraCurricularController.js';
import { terminarServicoImediatamente } from '../controllers/servicosTerminarController.js';
import {
    listarInscricoesPublicas,
    atualizarEstadoInscricaoPublica,
    atualizarCamposInscricaoPublica,
    apagarInscricoesPublicasPorEstado,
    apagarInscricoesPublicasEmLote,
} from '../controllers/inscricaoController.js';
import {
    listarGestores,
    criarGestor,
    alterarEstadoGestor,
    removerGestor,
} from '../controllers/gestorManagementController.js';
import { limparDadosEmMassa } from '../controllers/limpezaDadosController.js';
import { notificarFalhaParcialLote } from '../controllers/notificacoesGestorController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import {
    validateBody,
    validateParams,
    validateQuery,
} from '../middlewares/validationMiddleware.js';

/**
 * ========================================
 * GESTOR ROUTES
 * ========================================
 * Rotas de administração e gestão (acesso restrito a role='gestor')
 *
 * Seções:
 * 1. Dashboard & Auditoria
 * 2. Gestão de Pessoas (Alunos, Professores)
 * 3. Gestão de Catálogos (Disciplinas)
 * 4. Gestão de Serviços (Curriculares)
 * 5. Notificações & Configurações
 *
 * Autenticação: OBRIGATÓRIA
 * Autorização: OBRIGATÓRIA (role='gestor')
 * ========================================
 */

const router = express.Router();

// Aplicar middlewares de autenticação e autorização a TODAS as rotas
router.use(authMiddleware);
router.use(roleMiddleware('gestor'));

// =============== DASHBOARD & AUDITORIA ===============

/**
 * GET /api/gestor/dashboard-resumo
 * Retorna estatísticas gerais do sistema
 *
 * Response: {alunosAtivos: number, professores: number, servicosAtivos: number}
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/dashboard-resumo', obterResumoDashboard);
router.get('/dashboard-graficos', obterGraficosDashboard);
router.get(
    '/relatorios/:relatorio',
    validateParams({ relatorio: 'string' }),
    validateQuery({
        page: { type: 'number', required: false },
        limit: { type: 'number', required: false },
        estado: { type: 'string', required: false },
        role: { type: 'string', required: false },
    }),
    listarRelatorioGestor
);

/**
 * GET /api/gestor/logs
 * Lista histórico de auditoria (últimos 500 registos)
 *
 * Response: [{id_log, id_user, acao, entidade, entidade_id, detalhes, created_at, utilizador}]
 * Status: 200 OK | 500 Internal Server Error
 */
router.get(
    '/logs',
    validateQuery({
        page: { type: 'number', required: false },
        limit: { type: 'number', required: false },
        search: { type: 'string', required: false },
        action: { type: 'string', required: false },
        entity: { type: 'string', required: false },
        user: { type: 'string', required: false },
        from: { type: 'date', required: false },
        to: { type: 'date', required: false },
        format: { type: 'string', required: false },
    }),
    listarLogs
);

router.get(
    '/presencas',
    validateQuery({
        month: { type: 'string', required: false },
    }),
    listarTabelaPresencasGestor
);

// =============== GESTÃO DE PESSOAS ===============

/**
 * GET /api/gestor/alunos
 * Lista todos os alunos com detalhes: nome, turma, escola, encarregado, contacto, email
 *
 * Response: [{id_aluno, nome, nif, ano, turma, escola, encarregado, contacto, email, status}]
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/alunos', listarAlunos);
router.post(
    '/alunos',
    validateBody({
        nome_completo: { type: 'string', required: true, min: 3 },
        email: { type: 'email', required: true },
        data_nascimento: { type: 'string', required: true },
        ee_nome_completo: { type: 'string', required: true, min: 3 },
    }),
    criarAluno
);

/**
 * GET /api/gestor/alunos/:id
 * Obtém detalhes completos de um aluno específico
 *
 * Params: id (id_aluno)
 * Response: {aluno: {id_aluno, escola, ano, turma, pessoa: {...}, encarregado: {...}}}
 * Status: 200 OK | 400 Bad Request | 404 Not Found | 500 Internal Server Error
 */
router.get('/alunos/:id', validateParams({ id: 'number' }), obterAluno);

/**
 * PATCH /api/gestor/alunos/:id
 * Atualiza dados do aluno
 *
 * Params: id (id_aluno)
 * Body: {nome?, data_nasc?, cc?, nif?, morada?, localidade?, cod_postal?, telemovel?, telefone?, email?, escola?, ano?, turma?}
 * Response: {message, aluno}
 * Status: 200 OK | 400 Bad Request | 404 Not Found | 500 Internal Server Error
 */
router.patch(
    '/alunos/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 2 },
        data_nasc: { type: 'string', required: false },
        cc: { type: 'string', required: false },
        nif: { type: 'string', required: false },
        morada: { type: 'string', required: false },
        localidade: { type: 'string', required: false },
        cod_postal: { type: 'string', required: false },
        telemovel: { type: 'string', required: false },
        telefone: { type: 'string', required: false },
        email: { type: 'email', required: false },
        escola: { type: 'string', required: false },
        ano: { type: 'string', required: false },
        turma: { type: 'string', required: false },
        encarregado_nome: { type: 'string', required: false },
        encarregado_parentesco: { type: 'string', required: false },
        encarregado_morada: { type: 'string', required: false },
        encarregado_localidade: { type: 'string', required: false },
        encarregado_cod_postal: { type: 'string', required: false },
        encarregado_telemovel: { type: 'string', required: false },
        encarregado_telefone: { type: 'string', required: false },
        encarregado_email: { type: 'email', required: false },
    }),
    atualizarAluno
);
router.post(
    '/alunos/:id/reset-password',
    validateParams({ id: 'number' }),
    resetarPasswordAluno
);
router.post(
    '/alunos/:id/servicos-curriculares',
    validateParams({ id: 'number' }),
    validateBody({ id_servico: { type: 'number', required: true } }),
    adicionarServicoCurricularAluno
);
router.delete(
    '/alunos/:id/servicos/:idServico',
    validateParams({ id: 'number', idServico: 'number' }),
    removerServicoAluno
);
router.patch(
    '/alunos/:id/disciplinas-pretendidas',
    validateParams({ id: 'number' }),
    atualizarDisciplinasPretendidasAluno
);
router.patch(
    '/alunos/:id/status',
    validateParams({ id: 'number' }),
    validateBody({ status: { type: 'boolean', required: true } }),
    alterarEstadoAluno
);
router.delete(
    '/alunos/:id',
    validateParams({ id: 'number' }),
    eliminarAlunoDefinitivo
);

/**
 * GET /api/gestor/professores
 * Lista todos os professores com detalhes: nome, email, habilitação, área de ensino
 *
 * Response: [{id_professor, nome, email, habilitacao, area_ensino, nivel, data_entrada, status}]
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/professores', listarProfessores);
router.post(
    '/professores',
    validateBody({
        email: { type: 'email', required: true },
        nome_completo: { type: 'string', required: true, min: 3 },
        nif: { type: 'string', required: true },
    }),
    criarProfessor
);

/**
 * GET /api/gestor/professores/:id
 * Obtém detalhes completos de um professor específico
 */
router.get(
    '/professores/:id',
    validateParams({ id: 'number' }),
    obterProfessor
);

/**
 * PATCH /api/gestor/professores/:id
 * Atualiza dados do professor
 */
router.patch(
    '/professores/:id',
    validateParams({ id: 'number' }),
    atualizarProfessor
);
router.patch(
    '/professores/:id/status',
    validateParams({ id: 'number' }),
    validateBody({ status: { type: 'boolean', required: true } }),
    alterarEstadoProfessor
);
router.delete(
    '/professores/:id',
    validateParams({ id: 'number' }),
    eliminarProfessorDefinitivo
);
router.post('/professores/import', importarProfessores);

// =============== GESTÃO DE CATÁLOGOS ===============

/**
 * GET /api/gestor/disciplinas
 * Lista todas as disciplinas
 *
 * Response: [{id_disciplina, nome, nivel, area, ativo}]
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/disciplinas', listarDisciplinasCatalogo);

/**
 * POST /api/gestor/disciplinas
 * Cria nova disciplina
 *
 * Body: {nome: string, nivelEnsino?: string}
 * Response: {id_disciplina, nome, nivel, area, created_at}
 * Status: 201 Created | 400 Bad Request | 500 Internal Server Error
 */
router.post(
    '/disciplinas',
    validateBody({
        nome: { type: 'string', required: true, min: 2 },
        nivelEnsino: { type: 'string', required: false },
    }),
    criarDisciplinaCatalogo
);

/**
 * PATCH /api/gestor/disciplinas/:id
 * Atualiza disciplina existente
 *
 * Params: id (ID da disciplina)
 * Body: {nome?, nivelEnsino?}
 * Response: {id_disciplina, nome, nivel, updated_at}
 * Status: 200 OK | 400 Bad Request | 404 Not Found | 500 Internal Server Error
 */
router.patch(
    '/disciplinas/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 2 },
        nivelEnsino: { type: 'string', required: false },
    }),
    atualizarDisciplinaCatalogo
);

/**
 * DELETE /api/gestor/disciplinas/:id
 * Remove disciplina existente
 */
router.delete(
    '/disciplinas/:id',
    validateParams({ id: 'number' }),
    eliminarDisciplinaCatalogo
);

/**
 * GET /api/gestor/modalidades
 * Lista todas as modalidades
 */
router.get('/modalidades', listarModalidadesCatalogo);

/**
 * POST /api/gestor/modalidades
 * Cria nova modalidade
 */
router.post(
    '/modalidades',
    validateBody({
        nome: { type: 'string', required: true, min: 2 },
        descricao: { type: 'string', required: false },
    }),
    criarModalidadeCatalogo
);

/**
 * PATCH /api/gestor/modalidades/:id
 * Atualiza modalidade existente
 */
router.patch(
    '/modalidades/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 2 },
        descricao: { type: 'string', required: false },
    }),
    atualizarModalidadeCatalogo
);

/**
 * DELETE /api/gestor/modalidades/:id
 * Remove modalidade existente
 */
router.delete(
    '/modalidades/:id',
    validateParams({ id: 'number' }),
    eliminarModalidadeCatalogo
);

/**
 * GET /api/gestor/tipos-servico
 * Lista todos os tipos de serviço
 */
router.get('/tipos-servico', listarTiposServicoCatalogo);

/**
 * POST /api/gestor/tipos-servico
 * Cria novo tipo de serviço
 */
router.post(
    '/tipos-servico',
    validateBody({
        nome: { type: 'string', required: true, min: 2 },
        descricao: { type: 'string', required: false },
    }),
    criarTipoServicoCatalogo
);

/**
 * PATCH /api/gestor/tipos-servico/:id
 * Atualiza tipo de serviço existente
 */
router.patch(
    '/tipos-servico/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 2 },
        descricao: { type: 'string', required: false },
    }),
    atualizarTipoServicoCatalogo
);

/**
 * DELETE /api/gestor/tipos-servico/:id
 * Remove tipo de serviço existente
 */
router.delete(
    '/tipos-servico/:id',
    validateParams({ id: 'number' }),
    eliminarTipoServicoCatalogo
);

/**
 * GET /api/gestor/tipos-servico-extra
 * Lista todos os tipos de serviço extra-curriculares
 */
router.get('/tipos-servico-extra', listarTiposServicoExtraCatalogo);

/**
 * POST /api/gestor/tipos-servico-extra
 * Cria novo tipo de serviço extra-curricular
 */
router.post(
    '/tipos-servico-extra',
    validateBody({
        nome: { type: 'string', required: true, min: 2 },
        descricao: { type: 'string', required: false },
    }),
    criarTipoServicoExtraCatalogo
);

/**
 * PATCH /api/gestor/tipos-servico-extra/:id
 * Atualiza tipo de serviço extra-curricular existente
 */
router.patch(
    '/tipos-servico-extra/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 2 },
        descricao: { type: 'string', required: false },
    }),
    atualizarTipoServicoExtraCatalogo
);

/**
 * DELETE /api/gestor/tipos-servico-extra/:id
 * Remove tipo de serviço extra-curricular existente
 */
router.delete(
    '/tipos-servico-extra/:id',
    validateParams({ id: 'number' }),
    eliminarTipoServicoExtraCatalogo
);

/**
 * GET /api/gestor/salas
 * Lista todas as salas
 */
router.get('/salas', listarSalasCatalogo);

/**
 * POST /api/gestor/salas
 * Cria nova sala
 */
router.post(
    '/salas',
    validateBody({
        nome: { type: 'string', required: true, min: 1 },
        capacidade: { type: 'number', required: false },
    }),
    criarSalaCatalogo
);

/**
 * PATCH /api/gestor/salas/:id
 * Atualiza sala existente
 */
router.patch(
    '/salas/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 1 },
        capacidade: { type: 'number', required: false },
    }),
    atualizarSalaCatalogo
);

/**
 * DELETE /api/gestor/salas/:id
 * Remove sala existente
 */
router.delete(
    '/salas/:id',
    validateParams({ id: 'number' }),
    eliminarSalaCatalogo
);

/**
 * GET /api/gestor/pacotes
 * Lista todos os pacotes
 */
router.get('/pacotes', listarPacotesCatalogo);

/**
 * POST /api/gestor/pacotes
 * Cria novo pacote
 */
router.post(
    '/pacotes',
    validateBody({
        nome: { type: 'string', required: true, min: 1 },
        preco: { type: 'number', required: false },
        horas: { type: 'number', required: false },
        idModalidade: { type: 'number', required: false },
        idDisciplina: { type: 'number', required: false },
    }),
    criarPacoteCatalogo
);

/**
 * PATCH /api/gestor/pacotes/:id
 * Atualiza pacote existente
 */
router.patch(
    '/pacotes/:id',
    validateParams({ id: 'number' }),
    validateBody({
        nome: { type: 'string', required: false, min: 1 },
        preco: { type: 'number', required: false },
        horas: { type: 'number', required: false },
        idModalidade: { type: 'number', required: false },
        idDisciplina: { type: 'number', required: false },
    }),
    atualizarPacoteCatalogo
);

/**
 * DELETE /api/gestor/pacotes/:id
 * Remove pacote existente
 */
router.delete(
    '/pacotes/:id',
    validateParams({ id: 'number' }),
    eliminarPacoteCatalogo
);

// =============== GESTÃO DE SERVIÇOS ===============

/**
 * GET /api/gestor/servicos/curriculares
 * Lista todos os serviços curriculares com informações de modalidade e nível
 *
 * Response: [{id_servico, tipo, tipoServico, modalidade, nivelEnsino, area, nAlunos}]
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/servicos/curriculares', listarServicosCurriculares);
router.get(
    '/servicos/salas-disponiveis',
    validateQuery({
        data: { type: 'date', required: true },
        horaInicio: {
            type: 'string',
            required: true,
            pattern: /^\d{2}:\d{2}$/,
        },
        horaFim: {
            type: 'string',
            required: true,
            pattern: /^\d{2}:\d{2}$/,
        },
        diasSemana: { type: 'string', required: false },
        excluirIdServico: { type: 'number', required: false },
    }),
    listarSalasDisponiveis
);

/**
 * GET /api/gestor/servicos/extra-curriculares
 * Lista todos os serviços extra-curriculares com informações de modalidade e nível
 */
router.get('/servicos/extra-curriculares', listarServicosExtraCurriculares);
router.get(
    '/servicos/extra-curriculares/opcoes',
    listarOpcoesServicoExtraCurricular
);
router.post('/servicos/extra-curriculares', criarServicoExtraCurricular);
router.patch(
    '/servicos/extra-curriculares/:id',
    validateParams({ id: 'number' }),
    atualizarServicoExtraCurricular
);
router.delete(
    '/servicos/extra-curriculares/:id',
    validateParams({ id: 'number' }),
    eliminarServicoExtraCurricular
);

/**
 * POST /api/gestor/servicos/curriculares/:id/terminar
 * Termina um serviço curricular imediatamente (data_fim = hoje)
 *
 * Params: id (id_servico)
 * Response: {message, serviço: {id_servico, data_fim}}
 * Status: 200 OK | 400 Bad Request | 404 Not Found | 500 Internal Server Error
 */
router.post(
    '/servicos/curriculares/:id/terminar',
    validateParams({ id: 'number' }),
    (req, res, next) => {
        req.params.tipo = 'curricular';
        next();
    },
    terminarServicoImediatamente
);

/**
 * POST /api/gestor/servicos/extra-curriculares/:id/terminar
 * Termina um serviço extra-curricular imediatamente (data_fim = hoje)
 *
 * Params: id (id_servico)
 * Response: {message, serviço: {id_servico, data_fim}}
 * Status: 200 OK | 400 Bad Request | 404 Not Found | 500 Internal Server Error
 */
router.post(
    '/servicos/extra-curriculares/:id/terminar',
    validateParams({ id: 'number' }),
    (req, res, next) => {
        req.params.tipo = 'extra';
        next();
    },
    terminarServicoImediatamente
);

/**
 * GET /api/gestor/servicos/curriculares/opcoes
 * Obtém todas as opções de filtros para criar novo serviço
 *
 * Response: {
 *   tiposServico: [string],
 *   modalidades: [{id, nome}],
 *   disciplinas: [{id, nome, nivelId}],
 *   niveisEnsino: [{id, nome}],
 *   professores: [{id, nome}],
 *   salas: [{id, nome}],
 *   alunos: [{id, nome, ano}]
 * }
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/servicos/curriculares/opcoes', listarOpcoesServicoCurricular);

/**
 * POST /api/gestor/servicos/curriculares
 * Cria novo serviço curricular com alunos inscritos e hor\u00e1rio
 *
 * Body: {
 *   tipoServico: string,
 *   modalidadeId: number,
 *   disciplinaId: number,
 *   professorId: number,
 *   salaId: number,
 *   dataInicio: YYYY-MM-DD,
 *   horaInicio: HH:MM,
 *   duracao: number,
 *   alunosIds?: [number],
 *   diasSemana?: [1-7]
 * }
 * Response: {id_servico, ...detalhes serviço}
 * Status: 201 Created | 400 Bad Request | 500 Internal Server Error
 */
router.post('/servicos/curriculares', criarServicoCurricular);
router.patch(
    '/servicos/curriculares/:id',
    validateParams({ id: 'number' }),
    atualizarServicoCurricular
);
router.delete(
    '/servicos/curriculares/:id',
    validateParams({ id: 'number' }),
    eliminarServicoCurricular
);

// =============== INSCRICOES PUBLICAS ===============
router.get(
    '/inscricoes-publicas',
    validateQuery({
        estado: { type: 'string', required: false },
        limit: { type: 'number', required: false },
    }),
    listarInscricoesPublicas
);
router.patch(
    '/inscricoes-publicas/:id/estado',
    validateParams({ id: 'number' }),
    validateBody({ estado: { type: 'string', required: true } }),
    atualizarEstadoInscricaoPublica
);
router.patch(
    '/inscricoes-publicas/:id',
    validateParams({ id: 'number' }),
    atualizarCamposInscricaoPublica
);
router.delete(
    '/inscricoes-publicas/por-estado',
    validateQuery({
        estado: { type: 'string', required: true },
        dias: { type: 'number', required: false },
    }),
    apagarInscricoesPublicasPorEstado
);
router.delete('/inscricoes-publicas/lote', apagarInscricoesPublicasEmLote);

// =============== NOTIFICAÇÕES & CONFIGURAÇÕES ===============

/**
 * POST /api/gestor/notificar-falha-parcial
 * Notifica os gestores de que uma operação em lote (várias chamadas HTTP
 * independentes representando uma única ação) ficou parcialmente
 * concluída. Chamada pelo frontend quando deteta esse cenário.
 */
router.post(
    '/notificar-falha-parcial',
    validateBody({
        entidade: { type: 'string', required: true, min: 1 },
        detalhes: { type: 'object', required: true },
    }),
    notificarFalhaParcialLote
);

router.get('/email-templates', listarEmailTemplates);
router.get(
    '/email-templates/:key',
    validateParams({ key: 'string' }),
    obterEmailTemplate
);
router.patch(
    '/email-templates/:key',
    validateParams({ key: 'string' }),
    validateBody({
        subject: { type: 'string', required: false, min: 1, max: 180 },
        title: { type: 'string', required: false, min: 1, max: 180 },
        introText: { type: 'string', required: false, max: 1000 },
        bodyText: { type: 'string', required: false, min: 1, max: 4000 },
        footerText: { type: 'string', required: false, max: 1000 },
        buttonLabel: { type: 'string', required: false, max: 80 },
    }),
    atualizarEmailTemplate
);
router.post(
    '/email-templates/:key/reset',
    validateParams({ key: 'string' }),
    reporEmailTemplate
);

router.get('/inscricao-textos', listarInscricaoTextos);
router.patch('/inscricao-textos', atualizarInscricaoTextos);
router.post(
    '/inscricao-textos/:key/reset',
    validateParams({ key: 'string' }),
    reporInscricaoTexto
);

router.get('/feature-flags', listarFeatureFlags);
router.patch(
    '/feature-flags/:key',
    validateParams({ key: 'string' }),
    validateBody({ ativo: { type: 'boolean', required: true } }),
    atualizarFeatureFlag
);

// =============== GESTÃO DE RENOVAÇÕES DE MATRÍCULA ===============

/**
 * GET /api/gestor/renovacoes/alunos-expirados
 * Lista alunos com matrícula expirada (não renovada para o ano letivo atual)
 *
 * Response: {anoLetivoAtual: string, total: number, alunos: [{id_aluno, nome, email, status}]}
 * Status: 200 OK | 403 Forbidden | 500 Internal Server Error
 */
router.get('/renovacoes/alunos-expirados', listarAlunosMatriculaExpirada);

/**
 * POST /api/gestor/renovacoes/suspender-expirados
 * Suspende contas de alunos com matrícula expirada
 *
 * Response: {message: string, contatsSuspensas: number}
 * Status: 200 OK | 403 Forbidden | 500 Internal Server Error
 */
router.post('/renovacoes/suspender-expirados', suspenderAlunosExpirados);

/**
 * POST /api/gestor/renovacoes/:idAluno/renovar
 * Renova a matrícula de um aluno específico
 *
 * Response: {message: string, renovacao: {dataUltmaRenovacao, anoLetivoRenovacao}}
 * Status: 200 OK | 400 Bad Request | 403 Forbidden | 404 Not Found | 500 Internal Server Error
 */
router.post('/renovacoes/:idAluno/renovar', renovarMatriculaAlunoPorGestor);

// =============== GESTÃO DE ADMINISTRADORES ===============

router.get('/gestores', listarGestores);

router.post(
    '/gestores',
    validateBody({
        email: { type: 'email', required: true },
        nome: { type: 'string', required: false },
    }),
    criarGestor
);

router.patch(
    '/gestores/:id/estado',
    validateParams({ id: 'number' }),
    validateBody({
        status: { type: 'boolean', required: true },
    }),
    alterarEstadoGestor
);

router.delete(
    '/gestores/:id',
    validateParams({ id: 'number' }),
    removerGestor
);

// =============== LIMPEZA DE DADOS EM MASSA ===============

router.post(
    '/dados/limpar',
    validateBody({
        confirmacao: { type: 'string', required: true },
        opcoes: { type: 'object', required: true },
    }),
    limparDadosEmMassa
);

export default router;
