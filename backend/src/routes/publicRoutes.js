import express from 'express';
import {
    listarOpcoesInscricao,
    criarInscricaoPublica,
} from '../controllers/inscricaoController.js';
import { obterInscricaoTextosPublico } from '../controllers/inscricaoFormTextosController.js';
import { obterFeatureFlagsPublico } from '../controllers/featureFlagsController.js';
import { listarAgenda } from '../controllers/agendaController.js';
import { obterFeedICS } from '../controllers/calendarFeedController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { rateLimitMiddleware } from '../middlewares/securityMiddleware.js';

/**
 * ========================================
 * PUBLIC ROUTES
 * ========================================
 * Rotas públicas acessíveis a todos os utilizadores
 *
 * Endpoints:
 * - GET /api/public/inscricao-opcoes: Opções de filtros para inscrição
 * - GET /api/public/agenda: Agenda de atividades (filtra por utilizador se autenticado)
 *
 * Notas:
 * - Transparentemente autenticadas (authMiddleware aplica sem bloquear)
 * - Agenda filtra automaticamente baseado em X-User-Id ou Authorization header
 * ========================================
 */

const router = express.Router();

// Limite mais apertado que o global, específico para submissão de
// inscrições públicas: endpoint sem autenticação que escreve na BD e
// dispara emails, logo alvo fácil de spam/abuso automatizado.
const inscricaoRateLimit = rateLimitMiddleware(5, 60);

/**
 * GET /api/public/inscricao-opcoes
 * Lista opções de filtros disponíveis para formulário de inscrição
 *
 * Query: (nenhum parâmetro obrigatório)
 * Response: {disciplinas: [{id, value, label}], niveisEnsino: [], modalidades: []}
 * Status: 200 OK | 500 Internal Server Error
 */
router.get('/inscricao-opcoes', listarOpcoesInscricao);
router.get('/inscricao-textos', obterInscricaoTextosPublico);
router.get('/feature-flags', obterFeatureFlagsPublico);
router.post(
    '/inscricao',
    inscricaoRateLimit,
    validateBody({
        nome_completo: { type: 'string', required: true, min: 3 },
        email: { type: 'email', required: true },
        telemovel: { type: 'string', required: true, min: 9 },
        ee_nome: { type: 'string', required: true, min: 3 },
    }),
    criarInscricaoPublica
);

/**
 * GET /api/public/agenda
 * Lista agenda de atividades do utilizador autenticado
 * Se autenticação: filtra por aluno/professor
 * Se não autenticado: retorna vazio
 *
 * Query: {from: YYYY-MM-DD, to: YYYY-MM-DD}
 * Headers: {X-User-Id: number} ou {Authorization: Bearer <userId>}
 * Response: {atividadesPorDia: {data: [atividades]}, totalServicos: number}
 * Status: 200 OK | 400 Bad Request | 500 Internal Server Error
 */
router.get('/agenda', authMiddleware, listarAgenda);

/**
 * GET /api/public/agenda.ics
 * Feed iCalendar da agenda de um utilizador, autenticado via token opaco na
 * query string (não usa JWT/cookies) — pensado para ser subscrito
 * diretamente por Google Calendar, Outlook ou Apple Calendar.
 *
 * Query: {token: string} — obtido em GET /api/agenda/calendar-token
 * Response: text/calendar (.ics)
 * Status: 200 OK | 400 Bad Request | 404 Not Found
 */
router.get('/agenda.ics', obterFeedICS);

export default router;
