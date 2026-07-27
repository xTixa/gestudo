import {
    gerarFeedICSPorToken,
    obterOuCriarCalendarToken,
    regenerarCalendarToken,
} from '../services/calendarFeedService.js';

function buildFeedUrl(req, token) {
    const host = req.get('host');
    return `${req.protocol}://${host}/api/public/agenda.ics?token=${token}`;
}

export async function obterCalendarToken(req, res) {
    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const token = await obterOuCriarCalendarToken(req.userId);
        return res.json({ token, url: buildFeedUrl(req, token) });
    } catch (error) {
        console.error('Erro ao obter token de calendário:', error);
        return res.status(error.status || 500).json({
            message: error.message || 'Erro ao obter token de calendário.',
        });
    }
}

export async function regenerarCalendarTokenController(req, res) {
    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const token = await regenerarCalendarToken(req.userId);
        return res.json({ token, url: buildFeedUrl(req, token) });
    } catch (error) {
        console.error('Erro ao regenerar token de calendário:', error);
        return res.status(error.status || 500).json({
            message:
                error.message || 'Erro ao regenerar token de calendário.',
        });
    }
}

export async function obterFeedICS(req, res) {
    const token = String(req.query?.token || '').trim();

    if (!token) {
        return res.status(400).json({ message: 'Token em falta.' });
    }

    try {
        const ics = await gerarFeedICSPorToken(token);
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            'inline; filename="agenda.ics"'
        );
        return res.status(200).send(ics);
    } catch (error) {
        console.error('Erro ao gerar feed iCalendar:', error);
        return res
            .status(error.status || 500)
            .json({ message: error.message || 'Erro ao gerar agenda.' });
    }
}
