import crypto from 'node:crypto';
import { createEvents } from 'ics';
import { db } from '../config/db.js';
import { buscarAtividadesPorDia } from '../controllers/agendaController.js';

const FEED_PAST_DAYS = 30;
const FEED_FUTURE_DAYS = 365;

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function gerarTokenAleatorio() {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * Obtém o token de calendário do utilizador, gerando um novo se ainda não
 * existir. O token é opaco e estável entre pedidos (não muda a cada chamada),
 * para que o link subscrito no Google/Outlook continue válido.
 */
export async function obterOuCriarCalendarToken(userId) {
    const { rows } = await db.query(
        `SELECT calendar_token FROM users WHERE id_user = $1 LIMIT 1`,
        [userId]
    );

    if (!rows.length) {
        const error = new Error('Utilizador não encontrado.');
        error.status = 404;
        throw error;
    }

    if (rows[0].calendar_token) {
        return rows[0].calendar_token;
    }

    return regenerarCalendarToken(userId);
}

/**
 * Gera um novo token de calendário para o utilizador, invalidando o anterior
 * (qualquer subscrição feita com o link antigo deixa de funcionar).
 */
export async function regenerarCalendarToken(userId) {
    let token = gerarTokenAleatorio();

    for (let tentativas = 0; tentativas < 5; tentativas += 1) {
        try {
            const { rows } = await db.query(
                `
                    UPDATE users
                    SET calendar_token = $2
                    WHERE id_user = $1
                    RETURNING calendar_token
                `,
                [userId, token]
            );

            if (!rows.length) {
                const error = new Error('Utilizador não encontrado.');
                error.status = 404;
                throw error;
            }

            return rows[0].calendar_token;
        } catch (error) {
            // Colisão improvável de token único; tenta novamente com outro.
            if (error?.code === '23505') {
                token = gerarTokenAleatorio();
                continue;
            }
            throw error;
        }
    }

    throw new Error('Não foi possível gerar um token de calendário único.');
}

async function resolverUserIdPorToken(token) {
    const { rows } = await db.query(
        `SELECT id_user FROM users WHERE calendar_token = $1 LIMIT 1`,
        [String(token || '').trim()]
    );

    return rows[0]?.id_user ?? null;
}

function parseHora(hora) {
    const match = String(hora || '').match(/^(\d{2}):(\d{2})/);
    if (!match) {
        return null;
    }
    return { horas: Number(match[1]), minutos: Number(match[2]) };
}

function calcularDuracaoMinutos(horaInicio, horaFim) {
    const inicio = parseHora(horaInicio);
    const fim = parseHora(horaFim);
    if (!inicio || !fim) {
        return 60;
    }
    const totalInicio = inicio.horas * 60 + inicio.minutos;
    const totalFim = fim.horas * 60 + fim.minutos;
    const duracao = totalFim - totalInicio;
    return duracao > 0 ? duracao : 60;
}

/**
 * Converte o mapa {data: [atividades]} (o mesmo formato usado pela agenda
 * interna) numa lista de eventos no formato esperado pela biblioteca `ics`.
 *
 * Sessões marcadas como 'reposta' na sua data original são omitidas — só a
 * entrada gerada na data de reposição (estado também 'reposta', mas com
 * dataOriginal/dataReposicao preenchidos) aparece no feed, para evitar
 * mostrar a mesma aula duas vezes no calendário externo.
 */
function construirEventosICS(atividadesPorDia) {
    const eventos = [];

    Object.entries(atividadesPorDia || {}).forEach(([dataKey, atividades]) => {
        (atividades || []).forEach((atividade) => {
            const isSessaoRepostaOriginal =
                atividade.estado === 'reposta' && !atividade.dataReposicao;
            if (isSessaoRepostaOriginal) {
                return;
            }

            const hora = parseHora(atividade.hora);
            if (!hora) {
                return;
            }

            const [ano, mes, dia] = dataKey.split('-').map(Number);
            const duracaoMinutos = calcularDuracaoMinutos(
                atividade.hora,
                atividade.horaFim
            );

            const descricaoPartes = [];
            if (atividade.professor) {
                descricaoPartes.push(`Professor: ${atividade.professor}`);
            }
            if (atividade.alunos?.length) {
                descricaoPartes.push(`Alunos: ${atividade.alunos.join(', ')}`);
            }
            if (atividade.estado === 'reposta' && atividade.dataOriginal) {
                descricaoPartes.push(
                    `Reposição da aula de ${atividade.dataOriginal}`
                );
            }

            eventos.push({
                uid: `mc-servico-${atividade.id}-${dataKey}@mediacenter.app`,
                title: atividade.titulo || 'Aula',
                start: [ano, mes, dia, hora.horas, hora.minutos],
                startInputType: 'local',
                startOutputType: 'local',
                duration: { minutes: duracaoMinutos },
                location: atividade.local || undefined,
                description: descricaoPartes.join('\n') || undefined,
            });
        });
    });

    return eventos;
}

/**
 * Gera o conteúdo .ics (texto iCalendar) da agenda de um utilizador, a
 * partir do seu token de calendário. Usado pelo endpoint público
 * GET /api/public/agenda.ics?token=...
 */
export async function gerarFeedICSPorToken(token) {
    const userId = await resolverUserIdPorToken(token);
    if (!userId) {
        const error = new Error('Token de calendário inválido.');
        error.status = 404;
        throw error;
    }

    const hoje = new Date();
    const fromDate = new Date(hoje);
    fromDate.setDate(fromDate.getDate() - FEED_PAST_DAYS);
    const toDate = new Date(hoje);
    toDate.setDate(toDate.getDate() + FEED_FUTURE_DAYS);

    const { atividadesPorDia } = await buscarAtividadesPorDia(
        userId,
        formatDateKey(fromDate),
        formatDateKey(toDate)
    );

    const eventos = construirEventosICS(atividadesPorDia);

    const { error, value } = createEvents(eventos, {
        productId: 'mediacenter/agenda',
        calName: 'Agenda',
    });

    if (error) {
        throw error;
    }

    return value;
}
