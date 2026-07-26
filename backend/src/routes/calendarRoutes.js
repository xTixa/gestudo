import express from 'express';
import {
    obterCalendarToken,
    regenerarCalendarTokenController,
} from '../controllers/calendarFeedController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

/**
 * ========================================
 * CALENDAR ROUTES
 * ========================================
 * Gestão do token pessoal usado para subscrever a agenda em calendários
 * externos (Google Calendar, Outlook, Apple Calendar) via feed iCalendar.
 * Partilhado por qualquer role autenticado (aluno, professor, gestor).
 *
 * Endpoints:
 * - GET /api/agenda/calendar-token: Obtém (ou cria) o token e URL do feed
 * - POST /api/agenda/calendar-token/regenerar: Gera um novo token, invalidando o anterior
 *
 * O feed em si é servido publicamente em GET /api/public/agenda.ics?token=...
 * (backend/src/routes/publicRoutes.js), sem exigir JWT — o token na query
 * string é a própria autenticação, para ser acessível a apps de calendário.
 * ========================================
 */

const router = express.Router();

router.use(authMiddleware);

router.get('/calendar-token', obterCalendarToken);
router.post('/calendar-token/regenerar', regenerarCalendarTokenController);

export default router;
