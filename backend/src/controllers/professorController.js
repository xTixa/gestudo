import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import {
    enviarEmailCredenciaisIniciais,
    enviarEmailDecisaoReagendamento,
} from '../services/emailService.js';
import {
    dispatchAlert,
    isAlertChannelEnabledForUser,
    notificarGestoresCriacaoConta,
} from '../services/alertasDispatchService.js';
import {
    registarDelete,
    registarInsert,
    registarUpdate,
} from '../services/logService.js';

/**
 * ========================================
 * PROFESSOR CONTROLLER
 * ========================================
 * Responsável pela gestão de professores (docentes) no sistema.
 * Fornece operações para listar dados de professores com seus detalhes profissionais.
 *
 * Principais funções:
 * - listarProfessores: Retorna lista de professores com dados pessoais e profissionais
 * - importarProfessores: Importa professores em lote com envio de email de password temporária
 * ========================================
 */

/**
 * Gera uma password temporária segura
 * Formato: Temp@DDMMYYYY (ex: Temp@30032026)
 * @returns {string}
 */
function gerarPasswordTemporaria() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `Temp@${dia}${mes}${ano}`;
}

function gerarCartaoCidadaoPlaceholder(prefix = 'PR') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

// Paleta de cores da agenda (mantida em sincronia com o frontend)
const PROFESSOR_COLOR_PALETTE = [
    '#14ad81',
    '#1e3a5f',
    '#63738c',
    '#f97316',
    '#8b5cf6',
    '#eab308',
];

/**
 * Escolhe a próxima cor a atribuir a um novo professor: a que estiver
 * atualmente menos utilizada, para distribuir as cores o mais uniformemente
 * possível e evitar que professores diferentes fiquem com a mesma cor
 * enquanto houver cores livres na paleta.
 */
async function escolherProximaCorProfessor(client) {
    const { rows } = await client.query(
        `SELECT cor, COUNT(*)::int AS total FROM professores WHERE cor IS NOT NULL GROUP BY cor`
    );

    const contagemPorCor = new Map(rows.map((row) => [row.cor, row.total]));

    let corEscolhida = PROFESSOR_COLOR_PALETTE[0];
    let menorContagem = Infinity;

    for (const cor of PROFESSOR_COLOR_PALETTE) {
        const total = contagemPorCor.get(cor) || 0;
        if (total < menorContagem) {
            menorContagem = total;
            corEscolhida = cor;
        }
    }

    return corEscolhida;
}

async function suspenderServicosDoProfessor(client, idProfessor) {
    const curricularesResult = await client.query(
        `
			UPDATE servicos_curriculares
			SET ativo = false
			WHERE id_professor = $1
			  AND COALESCE(ativo, true) = true
			RETURNING id_servico
		`,
        [idProfessor]
    );

    const extraResult = await client.query(
        `
			UPDATE servicos_extracurriculares
			SET ativo = false
			WHERE id_professor = $1
			  AND COALESCE(ativo, true) = true
			RETURNING id_servico
		`,
        [idProfessor]
    );

    const ligadosCurriculares = await client.query(
        `SELECT COUNT(*)::int AS total FROM servicos_curriculares WHERE id_professor = $1`,
        [idProfessor]
    );

    const ligadosExtra = await client.query(
        `SELECT COUNT(*)::int AS total FROM servicos_extracurriculares WHERE id_professor = $1`,
        [idProfessor]
    );

    const totalLigados =
        Number(ligadosCurriculares.rows[0]?.total || 0) +
        Number(ligadosExtra.rows[0]?.total || 0);
    const idsCurriculares = curricularesResult.rows
        .map((row) => Number(row.id_servico))
        .filter((id) => Number.isInteger(id));
    const idsExtra = extraResult.rows
        .map((row) => Number(row.id_servico))
        .filter((id) => Number.isInteger(id));

    return {
        suspensosCurriculares: curricularesResult.rows.length,
        suspensosExtra: extraResult.rows.length,
        totalSuspensos:
            curricularesResult.rows.length + extraResult.rows.length,
        totalLigados,
        idsCurriculares,
        idsExtra,
    };
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeWeekdayKey(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();

    if (!raw) {
        return '';
    }

    const base = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/-feira/g, '')
        .replace(/\s+/g, '');

    const aliases = {
        domingo: 'domingo',
        dom: 'domingo',
        segunda: 'segunda',
        seg: 'segunda',
        terca: 'terca',
        ter: 'terca',
        quarta: 'quarta',
        qua: 'quarta',
        quinta: 'quinta',
        qui: 'quinta',
        sexta: 'sexta',
        sex: 'sexta',
        sabado: 'sabado',
        sab: 'sabado',
        0: 'domingo',
        1: 'segunda',
        2: 'terca',
        3: 'quarta',
        4: 'quinta',
        5: 'sexta',
        6: 'sabado',
        7: 'domingo',
    };

    return aliases[base] || '';
}

function parseDateOnly(value) {
    if (!value) {
        return null;
    }

    const raw = String(value).trim();
    if (!raw) {
        return null;
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const ptMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ptMatch) {
        const [, day, month, year] = ptMatch;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateOnlyForSql(value) {
    const date = parseDateOnly(value);
    if (!date) {
        const raw = String(value || '').trim();
        const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

        if (!dashMatch) {
            return null;
        }

        const [, day, month, year] = dashMatch;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day));

        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDiasSemana(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) =>
                normalizeWeekdayKey(
                    item && typeof item === 'object'
                        ? item.dia || item.day || ''
                        : item
                )
            )
            .filter(Boolean);
    }

    if (typeof value !== 'string' || !value.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed
                  .map((item) =>
                      normalizeWeekdayKey(
                          item && typeof item === 'object'
                              ? item.dia || item.day || ''
                              : item
                      )
                  )
                  .filter(Boolean)
            : [];
    } catch {
        return value
            .split(',')
            .map((item) => normalizeWeekdayKey(item))
            .filter(Boolean);
    }
}

function mapDayIndexToKey(dayIndex) {
    return normalizeWeekdayKey(dayIndex);
}

function getDurationMinutes(startTime, endTime) {
    const [startHour, startMinute] = String(startTime || '')
        .split(':')
        .map(Number);
    const [endHour, endMinute] = String(endTime || '')
        .split(':')
        .map(Number);

    if (
        [startHour, startMinute, endHour, endMinute].some((value) =>
            Number.isNaN(value)
        )
    ) {
        return 60;
    }

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const diff = (endTotal - startTotal + 24 * 60) % (24 * 60);
    return diff || 60;
}

const RESCHEDULE_MIN_LEAD_MINUTES = 60;

function buildSessionDateTime(dateValue, timeValue) {
    const date = parseDateOnly(dateValue);
    const normalizedTime = normalizeTimeLabel(timeValue);

    if (!date || !normalizedTime) {
        return null;
    }

    const [hours, minutes] = normalizedTime.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
    }

    const session = new Date(date);
    session.setHours(hours, minutes, 0, 0);
    return session;
}

function isServiceActiveOnDate(service, date) {
    const start = parseDateOnly(service?.data_inicio);
    const end = parseDateOnly(service?.data_fim) || start;

    if (!start || !end) {
        return false;
    }

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    if (target < start || target > end) {
        return false;
    }

    const allowedDays = parseDiasSemana(service?.dias_semana);
    if (!allowedDays.length) {
        return true;
    }

    return allowedDays.includes(mapDayIndexToKey(target.getDay()));
}

function getNextEligibleOccurrence(
    service,
    fromDate = new Date(),
    minLeadMinutes = RESCHEDULE_MIN_LEAD_MINUTES
) {
    const start = parseDateOnly(service?.data_inicio);
    const end = parseDateOnly(service?.data_fim) || start;

    if (!start || !end) {
        return null;
    }

    const cutoff = new Date(fromDate.getTime() + minLeadMinutes * 60000);
    const cursor = new Date(cutoff);
    cursor.setHours(0, 0, 0, 0);

    if (cursor < start) {
        cursor.setTime(start.getTime());
    }

    const limit = new Date(end);
    limit.setHours(0, 0, 0, 0);

    while (cursor <= limit) {
        if (isServiceActiveOnDate(service, cursor)) {
            const sessionStart = buildSessionDateTime(
                cursor,
                service?.hora_inicio
            );
            if (sessionStart && sessionStart.getTime() >= cutoff.getTime()) {
                return {
                    dateValue: formatDateKey(cursor),
                    dateLabel: formatDateLabel(cursor),
                    startsAt: sessionStart,
                };
            }
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    return null;
}

function countServiceSessionsInMonth(service, monthStart, monthEnd) {
    const startDate = parseDateOnly(service.data_inicio);
    const endDate = parseDateOnly(service.data_fim || service.data_inicio);
    if (!startDate || !endDate) {
        return 0;
    }

    const intervalStart = startDate > monthStart ? startDate : monthStart;
    const intervalEnd = endDate < monthEnd ? endDate : monthEnd;
    if (intervalStart > intervalEnd) {
        return 0;
    }

    const diasPermitidos = parseDiasSemana(service.dias_semana);
    const cursor = new Date(intervalStart);
    let total = 0;

    while (cursor <= intervalEnd) {
        const dayKey = mapDayIndexToKey(cursor.getDay());
        if (!diasPermitidos.length || diasPermitidos.includes(dayKey)) {
            total += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return total;
}

function getServiceTitle(row) {
    return String(
        row?.disciplina ||
            row?.titulo ||
            row?.nome ||
            row?.tipo_servico ||
            'Serviço'
    ).trim();
}

function formatAnoLabel(value) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        return '';
    }

    if (/\d+\s*º\s*ano/i.test(raw)) {
        return raw.replace(/\s+/g, ' ').trim();
    }

    const numericMatch = raw.match(/(\d{1,2})/);
    if (numericMatch?.[1]) {
        return `${numericMatch[1]}º Ano`;
    }

    return raw;
}

async function resolveInscricoesServicoColumn() {
    const { rows } = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inscricoes'
    `);

    const columns = new Set(
        rows.map((row) => String(row.column_name || '').toLowerCase())
    );
    const candidates = [
        'id_servico',
        'id_servico_curricular',
        'id_servicocurricular',
        'servico_id',
        'id_servicos',
    ];

    for (const candidate of candidates) {
        if (columns.has(candidate)) {
            return candidate;
        }
    }

    return null;
}

async function getProfessorIdFromUserId(userId) {
    const { rows } = await db.query(
        `
            SELECT id_professor
            FROM professores
            WHERE id_user = $1
            LIMIT 1
        `,
        [userId]
    );

    return rows[0]?.id_professor ?? null;
}

let professorRescheduleTableReady = null;

async function ensureProfessorRescheduleTable() {
    if (!professorRescheduleTableReady) {
        professorRescheduleTableReady = (async () => {
            await db.query(`
                CREATE TABLE IF NOT EXISTS public.pedidos_reagendamento_professor (
                    id_pedido_reagendamento BIGSERIAL PRIMARY KEY,
                    id_professor BIGINT NOT NULL,
                    id_servico BIGINT NOT NULL,
                    titulo_servico TEXT,
                    aluno_nome TEXT,
                    ano_label TEXT,
                    data_original DATE,
                    hora_original TEXT,
                    sala_original TEXT,
                    data_sugerida DATE,
                    hora_sugerida TEXT,
                    sala_sugerida TEXT,
                    motivo TEXT,
                    estado TEXT NOT NULL DEFAULT 'pendente',
                    aprovado_por BIGINT,
                    rejeitado_por BIGINT,
                    decidido_em TIMESTAMPTZ,
                    motivo_decisao TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_reagendamento_professor_estado
                ON public.pedidos_reagendamento_professor (estado)
            `);

            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_reagendamento_professor_professor
                ON public.pedidos_reagendamento_professor (id_professor)
            `);
        })();
    }

    return professorRescheduleTableReady;
}

function formatDateLabel(value) {
    const date = parseDateOnly(value);
    if (!date) {
        return 'Data por definir';
    }

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function formatShortDateLabel(value) {
    const date = parseDateOnly(value);
    if (!date) {
        return 'Data por definir';
    }

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function normalizeTimeLabel(value) {
    return String(value || '')
        .trim()
        .slice(0, 5);
}

const DATA_SUGERIDA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_SUGERIDA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDataSugerida(value) {
    if (!DATA_SUGERIDA_REGEX.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime());
}

function formatTimeRangeLabel(start, end) {
    const startLabel = normalizeTimeLabel(start);
    const endLabel = normalizeTimeLabel(end);
    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
    }
    return startLabel || endLabel || '--:--';
}

function mapRescheduleStatusLabel(status) {
    const normalized = String(status || '')
        .trim()
        .toLowerCase();

    if (normalized === 'aprovado' || normalized === 'aprovada') {
        return 'Aprovado';
    }

    if (normalized === 'rejeitado' || normalized === 'rejeitada') {
        return 'Rejeitado';
    }

    return 'Aguardando';
}

async function ensureReagendamentoPendenteAlertDefinition() {
    const codigo = 'reagendamento-pendente';
    const existing = await db.query(
        `SELECT id_alerta_definicao FROM alertas_definicoes WHERE codigo = $1 LIMIT 1`,
        [codigo]
    );
    if (existing.rows[0]?.id_alerta_definicao) return existing.rows[0].id_alerta_definicao;
    const inserted = await db.query(
        `INSERT INTO alertas_definicoes (grupo, codigo, titulo, descricao, icone, canal_app_default, canal_email_default, ativo, ordenacao)
         VALUES ($1, $2, $3, $4, $5, true, false, true, $6) RETURNING id_alerta_definicao`,
        ['operacional', codigo, 'Novo pedido de reagendamento', 'Um professor submeteu um novo pedido de reagendamento de sessão.', 'CalendarClock', 85]
    );
    return inserted.rows[0]?.id_alerta_definicao || null;
}

async function notificarGestoresNovoPedidoReagendamento({ professorNome, tituloServico, motivo, pedidoId, idServico }) {
    try {
        await ensureReagendamentoPendenteAlertDefinition();
        const { rows: gestorRows } = await db.query(
            `SELECT id_user FROM users WHERE role = 'gestor' AND status = true`
        );
        const gestorIds = gestorRows.map((r) => r.id_user).filter(Boolean);
        if (!gestorIds.length) return;
        await dispatchAlert({
            codigo: 'reagendamento-pendente',
            for_user_ids: gestorIds,
            titulo: `Novo reagendamento: ${tituloServico}`,
            descricao: `${professorNome} submeteu um pedido de reagendamento para "${tituloServico}". Motivo: ${motivo}`,
            nivel: 'info',
            payload: { pedidoId, id_servico: idServico, titulo_servico: tituloServico },
            canal: 'app',
        });
    } catch (err) {
        console.warn('[professorController] Falha ao notificar gestores de reagendamento:', err.message);
    }
}

async function ensureReagendamentoAlertDefinition(client) {
    const codigo = 'reagendamento-decisao';

    const existing = await client.query(
        `
            SELECT id_alerta_definicao
            FROM alertas_definicoes
            WHERE codigo = $1
            LIMIT 1
        `,
        [codigo]
    );

    if (existing.rows[0]?.id_alerta_definicao) {
        return existing.rows[0].id_alerta_definicao;
    }

    const inserted = await client.query(
        `
            INSERT INTO alertas_definicoes (
                grupo,
                codigo,
                titulo,
                descricao,
                icone,
                canal_app_default,
                canal_email_default,
                ativo,
                ordenacao
            )
            VALUES ($1, $2, $3, $4, $5, true, false, true, $6)
            RETURNING id_alerta_definicao
        `,
        [
            'operacional',
            codigo,
            'Pedido de reagendamento',
            'Decisão sobre um pedido de reagendamento de sessão.',
            'RefreshCcw',
            90,
        ]
    );

    return inserted.rows[0]?.id_alerta_definicao || null;
}

async function carregarDestinatariosDecisaoReagendamento(client, idServico) {
    const destinatarios = [];

    const professorResult = await client.query(
        `
            SELECT
                u.id_user,
                COALESCE(NULLIF(u.email, ''), '') AS email,
                COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Professor') AS nome
            FROM servicos_curriculares s
            LEFT JOIN professores pr ON pr.id_professor = s.id_professor
            LEFT JOIN users u ON u.id_user = pr.id_user
            LEFT JOIN pessoas pes ON pes.id_pessoa = pr.id_pessoa
            WHERE s.id_servico = $1
            LIMIT 1
        `,
        [idServico]
    );

    const professorEmail = String(professorResult.rows[0]?.email || '').trim();
    if (professorEmail) {
        destinatarios.push({
            id_user: professorResult.rows[0]?.id_user || null,
            email: professorEmail,
            nome: String(professorResult.rows[0]?.nome || 'Professor').trim(),
            tipo: 'professor',
        });
    }

    const inscricoesServicoColumn = await resolveInscricoesServicoColumn();
    if (inscricoesServicoColumn) {
        const alunosResult = await client.query(
            `
                SELECT DISTINCT
                    u.id_user,
                    COALESCE(NULLIF(u.email, ''), '') AS email,
                    COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Aluno') AS nome
                FROM inscricoes i
                INNER JOIN alunos a ON a.id_aluno = i.id_aluno
                LEFT JOIN users u ON u.id_user = a.id_user
                LEFT JOIN pessoas pes ON pes.id_pessoa = a.id_pessoa
                WHERE i.${inscricoesServicoColumn} = $1
                  AND LOWER(COALESCE(i.estado, 'ativa')) = 'ativa'
            `,
            [idServico]
        );

        alunosResult.rows.forEach((row) => {
            const email = String(row?.email || '').trim();
            if (!email) {
                return;
            }

            destinatarios.push({
                id_user: row.id_user || null,
                email,
                nome: String(row?.nome || 'Aluno').trim(),
                tipo: 'aluno',
            });
        });
    }

    const seen = new Set();
    return destinatarios.filter((item) => {
        const key = String(item.email || '')
            .toLowerCase()
            .trim();
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

async function notificarDecisaoReagendamento(
    client,
    pedido,
    estado,
    motivoDecisao
) {
    const destinatarios = await carregarDestinatariosDecisaoReagendamento(
        client,
        pedido.id_servico
    );

    if (!destinatarios.length) {
        return;
    }

    await ensureReagendamentoAlertDefinition(client);

    const detalheEstado = estado === 'aprovado' ? 'aprovado' : 'rejeitado';
    const descricaoBase =
        estado === 'aprovado'
            ? `A sessão ${pedido.titulo_servico} foi aprovada e reagendada para ${formatShortDateLabel(pedido.data_sugerida)} às ${String(pedido.hora_sugerida || '').trim() || '--:--'}.`
            : `O pedido de reagendamento da sessão ${pedido.titulo_servico} foi rejeitado.`;

    for (const destinatario of destinatarios) {
        await dispatchAlert({
            codigo: 'reagendamento-decisao',
            for_user_ids: destinatario.id_user ? [destinatario.id_user] : null,
            titulo:
                estado === 'aprovado'
                    ? `Reagendamento aprovado: ${pedido.titulo_servico}`
                    : `Reagendamento rejeitado: ${pedido.titulo_servico}`,
            descricao:
                estado === 'aprovado'
                    ? descricaoBase
                    : `${descricaoBase}${motivoDecisao ? ` Motivo: ${motivoDecisao}.` : ''}`,
            nivel: estado === 'aprovado' ? 'success' : 'warning',
            payload: {
                pedidoId: pedido.id_pedido_reagendamento,
                id_servico: pedido.id_servico,
                estado: detalheEstado,
                titulo_servico: pedido.titulo_servico,
                data_original: pedido.data_original,
                hora_original: pedido.hora_original,
                sala_original: pedido.sala_original,
                data_sugerida: pedido.data_sugerida,
                hora_sugerida: pedido.hora_sugerida,
                sala_sugerida: pedido.sala_sugerida,
                motivo: pedido.motivo,
                motivo_decisao: motivoDecisao || null,
            },
            canal: 'app',
        });

        const shouldSendEmail = destinatario.id_user
            ? await isAlertChannelEnabledForUser({
                  codigo: 'reagendamento-decisao',
                  idUser: destinatario.id_user,
                  channel: 'email',
              })
            : true;

        if (!shouldSendEmail) {
            continue;
        }

        const emailResult = await enviarEmailDecisaoReagendamento({
            nome: destinatario.nome,
            email: destinatario.email,
            estado,
            tituloSessao: pedido.titulo_servico,
            dataAnterior: formatShortDateLabel(pedido.data_original),
            horaAnterior: String(pedido.hora_original || '').trim() || '--:--',
            salaAnterior:
                String(pedido.sala_original || '').trim() || 'Sem sala',
            dataNova: formatShortDateLabel(pedido.data_sugerida),
            horaNova: String(pedido.hora_sugerida || '').trim() || '--:--',
            salaNova: String(pedido.sala_sugerida || '').trim() || 'Sem sala',
            motivo: pedido.motivo,
            motivoDecisao,
        });

        if (!emailResult?.ok) {
            console.warn(
                'Falha no email de decisão de reagendamento para',
                destinatario.email,
                emailResult?.error || 'erro desconhecido'
            );
        }
    }
}

async function getProfessorServiceSnapshot(professorId, serviceId) {
    const inscricoesServicoColumn = await resolveInscricoesServicoColumn();
    if (!inscricoesServicoColumn) {
        return null;
    }

    const { rows } = await db.query(
        `
            SELECT
                s.id_servico,
                COALESCE(NULLIF(d.nome, ''), 'Serviço') AS disciplina,
                d.id_nivel AS nivel_ensino,
                COALESCE(sa.nome, 'Sem sala') AS sala,
                s.data_inicio,
                s.data_fim,
                s.hora_inicio,
                s.hora_fim,
                s.dias_semana,
                COALESCE(p.nome, 'Aluno associado') AS aluno_nome,
                a.ano,
                a.turma
            FROM servicos_curriculares s
            LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN salas sa ON sa.id_sala = s.id_sala
            LEFT JOIN inscricoes i
                ON i.${inscricoesServicoColumn} = s.id_servico
               AND LOWER(COALESCE(i.estado, '')) = 'ativa'
            LEFT JOIN alunos a ON a.id_aluno = i.id_aluno
            LEFT JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            WHERE s.id_professor = $1
              AND s.id_servico = $2
              AND COALESCE(s.ativo, true) = true
            ORDER BY p.nome ASC NULLS LAST, a.id_aluno ASC
            LIMIT 1
        `,
        [professorId, serviceId]
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    const nextEligible = getNextEligibleOccurrence(row);
    if (!nextEligible) {
        return {
            ineligible: true,
            message:
                'Só é possível pedir reagendamento até 1 hora antes da sessão.',
        };
    }

    const yearRaw = String(row.ano || '').trim();
    const yearLabel = yearRaw
        ? /\d+\s*º\s*ano/i.test(yearRaw)
            ? yearRaw.replace(/\s+/g, ' ').trim()
            : `${yearRaw.replace(/[^\d]/g, '') || yearRaw}º Ano`
        : row.nivel_ensino
          ? `${row.nivel_ensino}º Ano`
          : 'Ano não definido';

    return {
        id: row.id_servico,
        title: String(row.disciplina || 'Serviço').trim(),
        student: String(row.aluno_nome || 'Aluno associado').trim(),
        yearLabel,
        originalDate: nextEligible.dateLabel,
        originalDateValue: nextEligible.dateValue,
        originalTime: formatTimeRangeLabel(row.hora_inicio, row.hora_fim),
        originalStartTime: normalizeTimeLabel(row.hora_inicio),
        originalEndTime: normalizeTimeLabel(row.hora_fim),
        originalRoom: String(row.sala || 'Sem sala').trim() || 'Sem sala',
    };
}

export async function listarPedidosReagendamentoGestor(req, res) {
    try {
        await ensureProfessorRescheduleTable();

        const estado = String(req.query?.estado || '')
            .trim()
            .toLowerCase();
        const values = [];
        let where = '';

        if (estado) {
            values.push(estado);
            where = `WHERE LOWER(COALESCE(prp.estado, 'pendente')) = $1`;
        }

        const query = `
            SELECT
                prp.id_pedido_reagendamento,
                prp.id_professor,
                prp.id_servico,
                prp.titulo_servico,
                prp.aluno_nome,
                prp.ano_label,
                prp.data_original,
                prp.hora_original,
                prp.sala_original,
                prp.data_sugerida,
                prp.hora_sugerida,
                prp.sala_sugerida,
                prp.motivo,
                prp.estado,
                prp.aprovado_por,
                prp.rejeitado_por,
                prp.decidido_em,
                prp.motivo_decisao,
                prp.created_at,
                COALESCE(p.nome, 'Professor') AS professor_nome
            FROM pedidos_reagendamento_professor prp
            LEFT JOIN professores pr ON pr.id_professor = prp.id_professor
            LEFT JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
            ${where}
            ORDER BY prp.created_at DESC, prp.id_pedido_reagendamento DESC
        `;

        const { rows } = await db.query(query, values);
        return res.status(200).json({
            pedidos: rows.map((row) => ({
                id: row.id_pedido_reagendamento,
                id_professor: row.id_professor,
                serviceId: row.id_servico,
                title: String(row.titulo_servico || 'Serviço').trim(),
                student: String(row.aluno_nome || 'Aluno associado').trim(),
                yearLabel:
                    String(row.ano_label || '').trim() || 'Ano não definido',
                professor: String(row.professor_nome || 'Professor').trim(),
                originalDate: formatShortDateLabel(row.data_original),
                originalTime: String(row.hora_original || '').trim() || '--:--',
                originalRoom:
                    String(row.sala_original || 'Sem sala').trim() ||
                    'Sem sala',
                newDate: formatShortDateLabel(row.data_sugerida),
                newTime: String(row.hora_sugerida || '').trim() || '--:--',
                newRoom: String(row.sala_sugerida || '').trim() || 'Sem sala',
                reason: String(row.motivo || '').trim(),
                status: mapRescheduleStatusLabel(row.estado),
                statusKey: String(row.estado || 'pendente')
                    .trim()
                    .toLowerCase(),
                approvedByUserId: row.aprovado_por,
                rejectedByUserId: row.rejeitado_por,
                decidedAt: row.decidido_em,
                decisionReason: String(row.motivo_decisao || '').trim(),
                createdAt: row.created_at,
            })),
        });
    } catch (error) {
        console.error(
            'Erro ao listar pedidos de reagendamento (gestor):',
            error.message
        );
        return res.status(500).json({
            message: 'Erro ao listar pedidos de reagendamento.',
            detail: error?.message || null,
        });
    }
}

export async function atualizarEstadoPedidoReagendamentoGestor(req, res) {
    const pedidoId = Number(req.params?.id);
    const estado = String(req.body?.estado || '')
        .trim()
        .toLowerCase();
    const motivoDecisao = String(req.body?.motivo_decisao || '').trim();
    const decisionUserId = Number.isInteger(Number(req.userId))
        ? Number(req.userId)
        : null;

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ message: 'Pedido inválido.' });
    }

    if (!['pendente', 'aprovado', 'rejeitado'].includes(estado)) {
        return res.status(400).json({
            message:
                "Estado inválido. Use 'pendente', 'aprovado' ou 'rejeitado'.",
        });
    }

    if (estado === 'rejeitado' && !motivoDecisao) {
        return res.status(400).json({
            message: 'Indica o motivo da rejeição para concluir a decisão.',
        });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const pedidoResult = await client.query(
            `
            SELECT *
            FROM pedidos_reagendamento_professor
            WHERE id_pedido_reagendamento = $1
            LIMIT 1
            `,
            [pedidoId]
        );

        const pedido = pedidoResult.rows[0];
        if (!pedido) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        if (pedido.estado === estado) {
            await client.query('ROLLBACK');
            return res.status(200).json({
                message: 'Pedido já está nesse estado.',
                pedidoId,
                estado,
            });
        }

        if (estado === 'aprovado') {
            const nextDateParsed = parseDateOnly(pedido.data_sugerida);
            const nextDate = nextDateParsed
                ? formatDateKey(nextDateParsed)
                : '';
            const nextStartTime = normalizeTimeLabel(pedido.hora_sugerida);

            if (!nextDate || !nextStartTime) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message:
                        'Pedido sem data/hora sugerida. Não é possível aprovar.',
                });
            }

            const serviceResult = await client.query(
                `
                SELECT id_servico, hora_inicio, hora_fim, id_sala
                FROM servicos_curriculares
                WHERE id_servico = $1
                LIMIT 1
                `,
                [pedido.id_servico]
            );

            const service = serviceResult.rows[0];
            if (!service) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    message: 'Serviço associado ao pedido não encontrado.',
                });
            }

            const currentDurationMinutes = getDurationMinutes(
                service.hora_inicio,
                service.hora_fim
            );
            const [hour, minute] = nextStartTime.split(':').map(Number);
            const startTotal = hour * 60 + minute;
            const endTotal = (startTotal + currentDurationMinutes) % (24 * 60);
            const endHour = String(Math.floor(endTotal / 60)).padStart(2, '0');
            const endMinute = String(endTotal % 60).padStart(2, '0');
            const nextEndTime = `${endHour}:${endMinute}`;

            let nextSalaId = service.id_sala;
            const salaSugerida = String(pedido.sala_sugerida || '').trim();
            if (salaSugerida) {
                const salaResult = await client.query(
                    `
                    SELECT id_sala
                    FROM salas
                    WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1))
                    LIMIT 1
                    `,
                    [salaSugerida]
                );

                if (salaResult.rows[0]?.id_sala) {
                    nextSalaId = salaResult.rows[0].id_sala;
                }
            }

            await client.query(
                `
                UPDATE servicos_curriculares
                SET data_inicio = $1,
                    hora_inicio = $2,
                    hora_fim = $3,
                    id_sala = $4
                WHERE id_servico = $5
                `,
                [
                    nextDate,
                    nextStartTime,
                    nextEndTime,
                    nextSalaId,
                    pedido.id_servico,
                ]
            );
        }

        const aprovadoPor = estado === 'aprovado' ? decisionUserId : null;
        const rejeitadoPor = estado === 'rejeitado' ? decisionUserId : null;
        const decididoEm = estado === 'pendente' ? null : new Date();
        const motivoDecisaoFinal =
            estado === 'pendente' ? null : motivoDecisao || null;

        await client.query(
            `
            UPDATE pedidos_reagendamento_professor
            SET estado = $1,
                aprovado_por = $2,
                rejeitado_por = $3,
                decidido_em = $4,
                motivo_decisao = $5
            WHERE id_pedido_reagendamento = $6
            `,
            [
                estado,
                aprovadoPor,
                rejeitadoPor,
                decididoEm,
                motivoDecisaoFinal,
                pedidoId,
            ]
        );

        await client.query('COMMIT');

        try {
            await notificarDecisaoReagendamento(
                client,
                pedido,
                estado,
                motivoDecisaoFinal
            );
        } catch (notificationError) {
            console.warn(
                'Erro ao enviar notificações de decisão de reagendamento:',
                notificationError.message
            );
        }

        return res.status(200).json({
            message:
                estado === 'aprovado'
                    ? 'Pedido aprovado e sessão reagendada com sucesso.'
                    : estado === 'rejeitado'
                      ? 'Pedido rejeitado com sucesso.'
                      : 'Estado do pedido atualizado com sucesso.',
            pedidoId,
            estado,
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        console.error(
            'Erro ao atualizar estado do pedido de reagendamento:',
            error.message
        );
        return res.status(500).json({
            message: 'Erro ao atualizar estado do pedido de reagendamento.',
            detail: error?.message || null,
        });
    } finally {
        client.release();
    }
}

export async function listarPedidosReagendamentoProfessor(req, res) {
    try {
        if (!req.userId) {
            return res
                .status(401)
                .json({ message: 'Autenticação necessária.' });
        }

        const professorId = await getProfessorIdFromUserId(req.userId);
        if (!professorId) {
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        await ensureProfessorRescheduleTable();

        const { rows } = await db.query(
            `
                SELECT
                    id_pedido_reagendamento,
                    id_servico,
                    titulo_servico,
                    aluno_nome,
                    ano_label,
                    data_original,
                    hora_original,
                    sala_original,
                    data_sugerida,
                    hora_sugerida,
                    sala_sugerida,
                    motivo,
                    estado,
                    created_at
                FROM pedidos_reagendamento_professor
                WHERE id_professor = $1
                ORDER BY created_at DESC, id_pedido_reagendamento DESC
            `,
            [professorId]
        );

        const pedidos = rows.map((row) => ({
            id: row.id_pedido_reagendamento,
            title: String(row.titulo_servico || 'Serviço').trim(),
            student: String(row.aluno_nome || 'Aluno associado').trim(),
            yearLabel: String(row.ano_label || '').trim() || 'Ano não definido',
            status: mapRescheduleStatusLabel(row.estado),
            statusKey: String(row.estado || 'pendente')
                .trim()
                .toLowerCase(),
            originalDate: formatShortDateLabel(row.data_original),
            originalTime: String(row.hora_original || '').trim(),
            originalRoom:
                String(row.sala_original || 'Sem sala').trim() || 'Sem sala',
            newDate: formatShortDateLabel(row.data_sugerida),
            newTime: String(row.hora_sugerida || '').trim() || '--:--',
            newRoom: String(row.sala_sugerida || '').trim() || 'Sem sala',
            reason: String(row.motivo || '').trim(),
            createdAt: row.created_at,
            serviceId: row.id_servico,
        }));

        return res.status(200).json({ pedidos });
    } catch (error) {
        console.error(
            'Erro ao listar pedidos de reagendamento:',
            error.message
        );
        return res
            .status(500)
            .json({ message: 'Erro ao listar pedidos de reagendamento.' });
    }
}

export async function criarPedidoReagendamentoProfessor(req, res) {
    try {
        if (!req.userId) {
            return res
                .status(401)
                .json({ message: 'Autenticação necessária.' });
        }

        const professorId = await getProfessorIdFromUserId(req.userId);
        if (!professorId) {
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        await ensureProfessorRescheduleTable();

        const serviceId = Number(req.body?.id_servico);
        if (!Number.isInteger(serviceId) || serviceId <= 0) {
            return res.status(400).json({ message: 'Serviço inválido.' });
        }

        const snapshot = await getProfessorServiceSnapshot(
            professorId,
            serviceId
        );

        if (!snapshot) {
            return res.status(404).json({
                message: 'Serviço não encontrado para este professor.',
            });
        }

        if (snapshot.ineligible) {
            return res.status(400).json({
                message:
                    snapshot.message ||
                    'Sessão indisponível para reagendamento nesta fase.',
            });
        }

        const motivo = String(req.body?.motivo || '').trim();
        if (!motivo) {
            return res
                .status(400)
                .json({ message: 'Indica o motivo do reagendamento.' });
        }

        const dataSugerida = String(req.body?.data_sugerida || '').trim();
        if (dataSugerida && !isValidDataSugerida(dataSugerida)) {
            return res.status(400).json({
                message: 'Data sugerida inválida. Use o formato AAAA-MM-DD.',
            });
        }

        const horaSugerida = normalizeTimeLabel(req.body?.hora_sugerida);
        if (horaSugerida && !HORA_SUGERIDA_REGEX.test(horaSugerida)) {
            return res.status(400).json({
                message: 'Hora sugerida inválida. Use o formato HH:MM.',
            });
        }

        const salaSugerida = String(req.body?.sala_sugerida || '').trim();

        const inserted = await db.query(
            `
                INSERT INTO pedidos_reagendamento_professor (
                    id_professor,
                    id_servico,
                    titulo_servico,
                    aluno_nome,
                    ano_label,
                    data_original,
                    hora_original,
                    sala_original,
                    data_sugerida,
                    hora_sugerida,
                    sala_sugerida,
                    motivo,
                    estado
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8,
                    $9, $10, $11,
                    $12, 'pendente'
                )
                RETURNING
                    id_pedido_reagendamento,
                    created_at
            `,
            [
                professorId,
                snapshot.id,
                snapshot.title,
                snapshot.student,
                snapshot.yearLabel,
                snapshot.originalDateValue,
                snapshot.originalStartTime,
                snapshot.originalRoom,
                dataSugerida || null,
                horaSugerida || null,
                salaSugerida || null,
                motivo,
            ]
        );

        const pedidoId = inserted.rows[0]?.id_pedido_reagendamento;

        // Notificar gestores do novo pedido (fire-and-forget)
        const { rows: profNomeRows } = await db.query(
            `SELECT COALESCE(p.nome, u.email, 'Professor') AS nome
             FROM professores pr
             LEFT JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
             LEFT JOIN users u ON u.id_user = pr.id_user
             WHERE pr.id_professor = $1 LIMIT 1`,
            [professorId]
        );
        notificarGestoresNovoPedidoReagendamento({
            professorNome: profNomeRows[0]?.nome || 'Professor',
            tituloServico: snapshot.title,
            motivo,
            pedidoId,
            idServico: serviceId,
        });

        return res.status(201).json({
            pedido: {
                id: pedidoId,
                title: snapshot.title,
                student: snapshot.student,
                yearLabel: snapshot.yearLabel,
                status: 'Aguardando',
                statusKey: 'pendente',
                originalDate: formatShortDateLabel(snapshot.originalDateValue),
                originalTime: snapshot.originalTime,
                originalRoom: snapshot.originalRoom,
                newDate: formatShortDateLabel(dataSugerida || null),
                newTime: horaSugerida || '--:--',
                newRoom: salaSugerida || snapshot.originalRoom,
                reason: motivo,
                createdAt: inserted.rows[0]?.created_at,
                serviceId: snapshot.id,
            },
        });
    } catch (error) {
        console.error('Erro ao criar pedido de reagendamento:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao criar pedido de reagendamento.' });
    }
}

export async function listarServicosProfessorResumo(req, res) {
    try {
        if (!req.userId) {
            return res
                .status(401)
                .json({ message: 'Autenticação necessária.' });
        }

        const professorId = await getProfessorIdFromUserId(req.userId);
        if (!professorId) {
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        const inscricoesServicoColumn = await resolveInscricoesServicoColumn();
        if (!inscricoesServicoColumn) {
            return res.status(200).json({ servicos: [] });
        }

        const [servicesResult, studentsResult] = await Promise.all([
            db.query(
                `
                    SELECT
                        s.id_servico,
                        s.id_disciplina,
                        COALESCE(NULLIF(d.nome, ''), 'Serviço') AS disciplina,
                        COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                        COALESCE(sa.nome, 'Sem sala') AS sala,
                        d.id_nivel AS nivel_ensino,
                        s.data_inicio,
                        s.data_fim,
                        s.hora_inicio,
                        s.hora_fim,
                        s.dias_semana,
                        COALESCE(COUNT(DISTINCT i.id_aluno), 0)::int AS total_alunos
                    FROM servicos_curriculares s
                    LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
                    LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
                    LEFT JOIN salas sa ON sa.id_sala = s.id_sala
                    LEFT JOIN inscricoes i
                        ON i.${inscricoesServicoColumn} = s.id_servico
                       AND LOWER(COALESCE(i.estado, '')) = 'ativa'
                    WHERE s.id_professor = $1
                      AND COALESCE(s.ativo, true) = true
                    GROUP BY
                        s.id_servico,
                        s.id_disciplina,
                        d.nome,
                        m.nome,
                        sa.nome,
                        d.id_nivel,
                        s.data_inicio,
                        s.data_fim,
                        s.hora_inicio,
                        s.hora_fim,
                        s.dias_semana
                    ORDER BY s.data_inicio DESC, s.hora_inicio ASC, s.id_servico DESC
                `,
                [professorId]
            ),
            db.query(
                `
                    SELECT
                        s.id_servico,
                        a.id_aluno,
                        p.nome,
                        a.ano,
                        a.turma
                    FROM servicos_curriculares s
                    INNER JOIN inscricoes i
                        ON i.${inscricoesServicoColumn} = s.id_servico
                       AND LOWER(COALESCE(i.estado, '')) = 'ativa'
                    INNER JOIN alunos a ON a.id_aluno = i.id_aluno
                    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                    WHERE s.id_professor = $1
                      AND COALESCE(s.ativo, true) = true
                    ORDER BY s.id_servico, p.nome
                `,
                [professorId]
            ),
        ]);

        const studentsByService = new Map();
        studentsResult.rows.forEach((row) => {
            const key = String(row.id_servico);
            if (!studentsByService.has(key)) {
                studentsByService.set(key, []);
            }

            studentsByService.get(key).push({
                id: row.id_aluno,
                nome: String(row.nome || 'Aluno'),
                ano: String(row.ano || '').trim(),
                turma: String(row.turma || '').trim(),
            });
        });

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const servicos = servicesResult.rows
            .map((row) => {
                const nextEligible = getNextEligibleOccurrence(row);

                const alunos =
                    studentsByService.get(String(row.id_servico)) || [];
                const sessoesMes = countServiceSessionsInMonth(
                    row,
                    monthStart,
                    monthEnd
                );
                const duracaoHoras =
                    getDurationMinutes(row.hora_inicio, row.hora_fim) / 60;
                const anoAluno = formatAnoLabel(alunos[0]?.ano);

                return {
                    id: row.id_servico,
                    titulo: getServiceTitle(row),
                    ano:
                        anoAluno ||
                        (row.nivel_ensino
                            ? `${row.nivel_ensino}º Ano`
                            : 'Ano não definido'),
                    badge: 'Curricular',
                    alunosCount: row.total_alunos || alunos.length,
                    sessoesMes,
                    horasMes: Math.max(
                        0,
                        Math.round(sessoesMes * duracaoHoras)
                    ),
                    alunos: alunos.slice(0, 4),
                    sala: String(row.sala || 'Sem sala').trim() || 'Sem sala',
                    horaInicio: String(row.hora_inicio || '').slice(0, 5),
                    horaFim: String(row.hora_fim || '').slice(0, 5),
                    dataInicio: formatDateOnlyForSql(row.data_inicio) || '',
                    dataFim: formatDateOnlyForSql(row.data_fim) || '',
                    nextSessionDate: nextEligible?.dateValue || null,
                    diasSemana: Array.isArray(row.dias_semana)
                        ? row.dias_semana
                        : parseDiasSemana(row.dias_semana),
                };
            })
            .filter(Boolean);

        return res.status(200).json({ servicos });
    } catch (error) {
        console.error('Erro ao listar serviços do professor:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao listar serviços do professor.' });
    }
}

/**
 * Lista todos os professores registados no sistema
 * Retorna informações completas incluindo habilitações, áreas de ensino e níveis
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Array de professores com dados pessoais e profissionais
 */
export async function listarProfessores(req, res) {
    try {
        const query = `
			SELECT
				pr.id_professor,
				pr.id_user,
				p.nome,
				p.nif,
				p.telemovel AS contacto,
				u.email,
                u.imagem_perfil_url,
				pr.habilitacao,
				pr.area_ensino,
				pr.nivel,
				pr.cor,
				u.created_at AS data_entrada,
				u.status
			FROM professores pr
			INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
			INNER JOIN users u ON u.id_user = pr.id_user
			WHERE COALESCE(u.role, '') = 'professor'
			ORDER BY p.nome ASC
		`;

        const { rows } = await db.query(query);
        return res.status(200).json({ professores: rows });
    } catch (error) {
        console.error('Erro ao listar professores:', error.message);
        return res.status(500).json({ message: 'Erro ao obter professores.' });
    }
}

/**
 * Obtém detalhes completos de um professor específico
 *
 * @param {Object} req - Objecto de requisição (params: id)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Dados completos do professor com pessoa e utilizador
 */
export async function obterProfessor(req, res) {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de professor inválido.' });
    }

    try {
        const professorResult = await db.query(
            `
				SELECT
					pr.id_professor,
					pr.id_user,
					pr.id_pessoa,
					pr.habilitacao,
					pr.area_ensino,
					pr.nivel
				FROM professores pr
				WHERE pr.id_professor = $1
				LIMIT 1
			`,
            [id]
        );

        if (!professorResult.rows.length) {
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        const professor = professorResult.rows[0];

        const pessoaResult = await db.query(
            `
				SELECT
					p.id_pessoa,
					p.nome,
					p.data_nasc,
					p.cc,
					p.nif,
					p.morada,
					p.localidade,
					p.cod_postal,
					p.telemovel,
					p.telefone,
					p.created_at
				FROM pessoas p
				WHERE p.id_pessoa = $1
				LIMIT 1
			`,
            [professor.id_pessoa]
        );

        const userResult = await db.query(
            `
				SELECT
					u.id_user,
					u.email,
                    u.imagem_perfil_url,
					u.role,
					u.status,
					u.created_at
				FROM users u
				WHERE u.id_user = $1
				LIMIT 1
			`,
            [professor.id_user]
        );

        return res.status(200).json({
            professor: {
                id_professor: professor.id_professor,
                id_user: professor.id_user,
                id_pessoa: professor.id_pessoa,
                habilitacao: professor.habilitacao,
                area_ensino: professor.area_ensino,
                nivel: professor.nivel,
                pessoa: pessoaResult.rows[0]
                    ? {
                          ...pessoaResult.rows[0],
                          user: userResult.rows[0] || null,
                      }
                    : null,
            },
        });
    } catch (error) {
        console.error('Erro ao obter professor:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao obter detalhes do professor.' });
    }
}

/**
 * Atualiza os dados de um professor
 *
 * @param {Object} req - Objecto de requisição (params: id, body com campos editáveis)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Dados atualizados do professor
 */
export async function atualizarProfessor(req, res) {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de professor inválido.' });
    }

    const {
        nome,
        data_nasc,
        cc,
        nif,
        morada,
        localidade,
        cod_postal,
        telemovel,
        telefone,
        email,
        imagem_perfil_url,
        habilitacao,
        area_ensino,
        nivel,
    } = req.body || {};

    const hasAnyField = [
        nome,
        data_nasc,
        cc,
        nif,
        morada,
        localidade,
        cod_postal,
        telemovel,
        telefone,
        email,
        imagem_perfil_url,
        habilitacao,
        area_ensino,
        nivel,
    ].some((value) => value !== undefined);

    if (!hasAnyField) {
        return res.status(400).json({ message: 'Sem dados para atualizar.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const professorResult = await client.query(
            `
				SELECT id_professor, id_user, id_pessoa
				FROM professores
				WHERE id_professor = $1
				LIMIT 1
			`,
            [id]
        );

        if (!professorResult.rows.length) {
            await client.query('ROLLBACK');
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        const professor = professorResult.rows[0];

        await client.query(
            `
				UPDATE pessoas
				SET
					nome = COALESCE($1, nome),
					data_nasc = COALESCE($2, data_nasc),
					cc = COALESCE($3, cc),
					nif = COALESCE($4, nif),
					morada = COALESCE($5, morada),
					localidade = COALESCE($6, localidade),
					cod_postal = COALESCE($7, cod_postal),
					telemovel = COALESCE($8, telemovel),
					telefone = COALESCE($9, telefone)
				WHERE id_pessoa = $10
			`,
            [
                nome == null ? null : String(nome).trim(),
                data_nasc || null,
                cc == null ? null : String(cc).trim(),
                nif == null ? null : String(nif).trim(),
                morada == null ? null : String(morada).trim(),
                localidade == null ? null : String(localidade).trim(),
                cod_postal == null ? null : String(cod_postal).trim(),
                telemovel == null ? null : String(telemovel).trim(),
                telefone == null ? null : String(telefone).trim(),
                professor.id_pessoa,
            ]
        );

        await client.query(
            `
				UPDATE users
				SET
					email = COALESCE($1, email),
					imagem_perfil_url = COALESCE($2, imagem_perfil_url)
                WHERE id_user = $3
			`,
            [
                email == null ? null : String(email).trim(),
                imagem_perfil_url == null
                    ? null
                    : String(imagem_perfil_url).trim(),
                professor.id_user,
            ]
        );

        await client.query(
            `
				UPDATE professores
				SET
					habilitacao = COALESCE($1, habilitacao),
					area_ensino = COALESCE($2, area_ensino),
					nivel = COALESCE($3, nivel)
				WHERE id_professor = $4
			`,
            [
                habilitacao == null ? null : String(habilitacao).trim(),
                area_ensino == null ? null : String(area_ensino).trim(),
                nivel == null ? null : String(nivel).trim(),
                id,
            ]
        );

        const updatedResult = await client.query(
            `
				SELECT
					pr.id_professor,
					p.nome,
					p.data_nasc,
					p.cc,
					p.nif,
					p.morada,
					p.localidade,
					p.cod_postal,
					p.telemovel,
					p.telefone,
					u.email,
                    u.imagem_perfil_url,
					pr.habilitacao,
					pr.area_ensino,
					pr.nivel
				FROM professores pr
				INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
				INNER JOIN users u ON u.id_user = pr.id_user
				WHERE pr.id_professor = $1
				LIMIT 1
			`,
            [id]
        );

        await client.query('COMMIT');
        return res.status(200).json({
            message: 'Professor atualizado com sucesso.',
            professor: updatedResult.rows[0],
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        if (error?.code === '23505') {
            return res.status(400).json({
                message: 'Já existe outro utilizador com esse email.',
            });
        }

        console.error('Erro ao atualizar professor:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar professor.' });
    } finally {
        client.release();
    }
}

export async function atualizarMeuPerfilProfessor(req, res) {
    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const professorIdResult = await db.query(
            `
				SELECT id_professor
				FROM professores
				WHERE id_user = $1
				LIMIT 1
			`,
            [req.userId]
        );

        const idProfessor = professorIdResult.rows[0]?.id_professor;

        if (!idProfessor) {
            return res
                .status(404)
                .json({ message: 'Perfil de professor não encontrado.' });
        }

        req.params = { ...(req.params || {}), id: String(idProfessor) };
        return atualizarProfessor(req, res);
    } catch (error) {
        console.error('Erro ao atualizar perfil do professor:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar o perfil do professor.' });
    }
}

/**
 * GET /api/professor/alunos
 * Lista todos os alunos ativos do sistema, para o professor poder pesquisar
 * e adicionar um "aluno extra" (não inscrito formalmente no serviço) ao
 * marcar presenças.
 */
export async function listarAlunosParaProfessor(req, res) {
    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const { rows } = await db.query(`
            SELECT a.id_aluno, p.nome, a.ano, a.turma
            FROM alunos a
            INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            INNER JOIN users u ON u.id_user = a.id_user
            WHERE u.status = true
            ORDER BY p.nome ASC
        `);

        return res.status(200).json({ alunos: rows });
    } catch (error) {
        console.error('Erro ao listar alunos para professor:', error.message);
        return res.status(500).json({ message: 'Erro ao listar alunos.' });
    }
}

export async function criarProfessor(req, res) {
    const {
        email,
        nome_completo,
        cartao_cidadao,
        nif,
        morada,
        localidade,
        codigo_postal,
        grau,
        habilitacoes,
        area,
        data_nascimento,
        telemovel,
        telefone,
        imagem_perfil_url,
    } = req.body || {};

    const professorEmail = String(email || '')
        .trim()
        .toLowerCase();
    const professorNome = String(nome_completo || '').trim();

    if (
        !professorEmail ||
        !professorNome ||
        !String(nif || '').trim()
    ) {
        return res.status(400).json({
            message: 'Email, nome e NIF sao obrigatorios.',
        });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const existingUser = await client.query(
            `SELECT id_user FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [professorEmail]
        );

        if (existingUser.rows.length) {
            await client.query('ROLLBACK');
            return res
                .status(400)
                .json({ message: 'Já existe um utilizador com esse email.' });
        }

        const passwordTemporaria = gerarPasswordTemporaria();
        const passwordHash = await bcrypt.hash(passwordTemporaria, 10);

        const userResult = await client.query(
            `
				INSERT INTO users (email, password, role, status, primeira_login, imagem_perfil_url)
				VALUES ($1, $2, 'professor', true, true, $3)
				RETURNING id_user, email, created_at, status
			`,
            [
                professorEmail,
                passwordHash,
                imagem_perfil_url == null
                    ? null
                    : String(imagem_perfil_url).trim() || null,
            ]
        );

        const pessoaResult = await client.query(
            `
				INSERT INTO pessoas (nome, nif, telemovel, data_nasc, cc, morada, localidade, cod_postal, telefone)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				RETURNING id_pessoa
			`,
            [
                professorNome,
                String(nif || '').trim(),
                String(telemovel || '').trim() || '',
                data_nascimento || '2000-01-01',
                String(cartao_cidadao || '').trim() ||
                    gerarCartaoCidadaoPlaceholder(),
                String(morada || '').trim() || '',
                String(localidade || '').trim() || '',
                String(codigo_postal || '').trim() || '',
                String(telefone || '').trim() || null,
            ]
        );

        const corProfessor = await escolherProximaCorProfessor(client);

        const professorResult = await client.query(
            `
				INSERT INTO professores (id_user, id_pessoa, habilitacao, area_ensino, nivel, cor)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id_professor, habilitacao, area_ensino, nivel, cor
			`,
            [
                userResult.rows[0].id_user,
                pessoaResult.rows[0].id_pessoa,
                String(habilitacoes || '').trim() || '',
                String(area || '').trim() || '',
                String(grau || '').trim() || '',
                corProfessor,
            ]
        );

        await client.query('COMMIT');

        await registarInsert(
            req.userId,
            'professores',
            {
                id_professor: professorResult.rows[0].id_professor,
                nome: professorNome,
                email: userResult.rows[0].email,
                habilitacao: professorResult.rows[0].habilitacao,
                area_ensino: professorResult.rows[0].area_ensino,
                nivel: professorResult.rows[0].nivel,
            },
            professorResult.rows[0].id_professor
        );

        const emailResultado = await enviarEmailCredenciaisIniciais(
            professorNome,
            professorEmail,
            passwordTemporaria
        );
        const emailEnviado = emailResultado.ok === true;

        notificarGestoresCriacaoConta({
            actorUserId: req.userId,
            nome: professorNome,
            email: professorEmail,
            tipo: 'professor',
        }).catch(() => {});

        return res.status(201).json({
            message: emailEnviado
                ? 'Professor criado com sucesso. Credenciais temporárias enviadas por email.'
                : 'Professor criado com sucesso, mas não foi possível enviar o email automático.',
            professor: {
                id_professor: professorResult.rows[0].id_professor,
                nome: professorNome,
                email: userResult.rows[0].email,
                habilitacao: professorResult.rows[0].habilitacao,
                area_ensino: professorResult.rows[0].area_ensino,
                nivel: professorResult.rows[0].nivel,
                cor: professorResult.rows[0].cor,
            },
            credenciais: {
                email: userResult.rows[0].email,
                passwordTemporaria,
                primeiraLogin: true,
                emailEnviado,
                emailErro: emailEnviado
                    ? null
                    : emailResultado.error || 'Erro no envio',
            },
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        if (error?.code === '23505') {
            return res.status(400).json({
                message: 'Já existe um registo com os dados fornecidos.',
            });
        }

        console.error('Erro ao criar professor:', error.message);
        return res.status(500).json({ message: 'Erro ao criar professor.' });
    } finally {
        client.release();
    }
}

export async function importarProfessores(req, res) {
    const professoresInput = Array.isArray(req.body?.professores)
        ? req.body.professores
        : [];

    if (!professoresInput.length) {
        return res
            .status(400)
            .json({ message: 'Não foram enviados registos para importação.' });
    }

    const client = await db.connect();
    const inserted = [];
    const skipped = [];
    const emailsEnviados = [];
    const emailsComErro = [];

    try {
        for (let index = 0; index < professoresInput.length; index += 1) {
            const row = professoresInput[index] || {};
            const nome = String(row.nome || '').trim();
            const email = String(row.email || '')
                .trim()
                .toLowerCase();
            const nifRaw = String(row.nif || '').trim();
            const contacto = String(row.contacto || '').trim();
            const areaEnsino = String(row.area_ensino || '').trim();
            const nivel = String(row.nivel || '').trim() || 'Secundario';
            const habilitacao = String(row.habilitacao || '').trim();
            const cc = String(row.cc || '').trim() || '0000000000000000';
            const morada = String(row.morada || '').trim() || '';
            const localidade = String(row.localidade || '').trim() || '';
            const codPostal = String(row.cod_postal || '').trim() || '0000-000';
            const telefone = String(row.telefone || '').trim() || '';

            if (!nome || !email) {
                skipped.push({
                    row: index + 1,
                    reason: 'Nome e email são obrigatórios.',
                });
                continue;
            }

            const nif = /^\d{9}$/.test(nifRaw) ? nifRaw : null;
            const rawDataNasc = String(row.data_nasc || '').trim();
            const dataNasc = rawDataNasc
                ? formatDateOnlyForSql(rawDataNasc)
                : '2000-01-01';

            if (rawDataNasc && !dataNasc) {
                skipped.push({
                    row: index + 1,
                    reason: 'Data de nascimento inválida.',
                });
                continue;
            }

            const passwordTemporaria = gerarPasswordTemporaria();
            const passwordHash = await bcrypt.hash(passwordTemporaria, 10);

            try {
                await client.query('BEGIN');

                const existingUser = await client.query(
                    `SELECT id_user FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
                    [email]
                );

                if (existingUser.rows.length) {
                    await client.query('ROLLBACK');
                    skipped.push({
                        row: index + 1,
                        reason: 'Email já existe.',
                    });
                    continue;
                }

                const userResult = await client.query(
                    `
						INSERT INTO users (email, password, role, status, primeira_login)
						VALUES ($1, $2, 'professor', true, true)
						RETURNING id_user, email, created_at, status
					`,
                    [email, passwordHash]
                );

                const pessoaResult = await client.query(
                    `
						INSERT INTO pessoas (nome, nif, telemovel, data_nasc, cc, morada, localidade, cod_postal, telefone)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						RETURNING id_pessoa, nome, nif, telemovel, data_nasc, cc, morada, localidade, cod_postal, telefone
					`,
                    [
                        nome,
                        nif,
                        contacto || null,
                        dataNasc,
                        cc,
                        morada,
                        localidade,
                        codPostal,
                        telefone,
                    ]
                );

                const corProfessor = await escolherProximaCorProfessor(client);

                const professorResult = await client.query(
                    `
						INSERT INTO professores (id_user, id_pessoa, habilitacao, area_ensino, nivel, cor)
						VALUES ($1, $2, $3, $4, $5, $6)
						RETURNING id_professor, habilitacao, area_ensino, nivel, cor
					`,
                    [
                        userResult.rows[0].id_user,
                        pessoaResult.rows[0].id_pessoa,
                        habilitacao || null,
                        areaEnsino || null,
                        nivel,
                        corProfessor,
                    ]
                );

                await client.query('COMMIT');

                inserted.push({
                    id_professor: professorResult.rows[0].id_professor,
                    id_user: userResult.rows[0].id_user,
                    nome: pessoaResult.rows[0].nome,
                    nif: pessoaResult.rows[0].nif,
                    contacto: pessoaResult.rows[0].telemovel,
                    email: userResult.rows[0].email,
                    habilitacao: professorResult.rows[0].habilitacao,
                    area_ensino: professorResult.rows[0].area_ensino,
                    nivel: professorResult.rows[0].nivel,
                    cor: professorResult.rows[0].cor,
                    data_entrada: userResult.rows[0].created_at,
                    status: userResult.rows[0].status,
                });

                // Enviar email com password temporária (assincronamente)
                const emailResultado = await enviarEmailCredenciaisIniciais(
                    nome,
                    email,
                    passwordTemporaria
                );
                if (emailResultado.ok) {
                    emailsEnviados.push(email);
                } else {
                    emailsComErro.push({
                        email,
                        erro: emailResultado.error || 'Erro no envio',
                    });
                }
            } catch (rowError) {
                try {
                    await client.query('ROLLBACK');
                } catch {
                    // noop
                }

                if (rowError?.code === '23505') {
                    skipped.push({
                        row: index + 1,
                        reason: 'Registo duplicado (email ou nif).',
                    });
                    continue;
                }

                skipped.push({
                    row: index + 1,
                    reason: rowError.message || 'Erro ao inserir registo.',
                });
            }
        }

        return res.status(200).json({
            message: 'Importação de professores concluída.',
            insertedCount: inserted.length,
            skippedCount: skipped.length,
            emailsEnviadosCount: emailsEnviados.length,
            emailsComErroCount: emailsComErro.length,
            professores: inserted,
            skipped,
            emailsComErro: emailsComErro.length > 0 ? emailsComErro : undefined,
        });
    } catch (error) {
        console.error('Erro ao importar professores:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao importar professores.' });
    } finally {
        client.release();
    }
}

export async function alterarEstadoProfessor(req, res) {
    const idProfessor = Number(req.params?.id);
    const status = req.body?.status;

    if (!Number.isInteger(idProfessor) || idProfessor <= 0) {
        return res.status(400).json({ message: 'ID de professor inválido.' });
    }

    if (typeof status !== 'boolean') {
        return res.status(400).json({
            message: 'Campo status é obrigatório e deve ser boolean.',
        });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const professorResult = await client.query(
            `
				SELECT pr.id_professor, pr.id_user, p.nome, u.status
				FROM professores pr
				INNER JOIN users u ON u.id_user = pr.id_user
				INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
				WHERE pr.id_professor = $1
				LIMIT 1
			`,
            [idProfessor]
        );

        if (!professorResult.rows.length) {
            await client.query('ROLLBACK');
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        const professor = professorResult.rows[0];
        const estadoAnterior = professor.status === true;

        if (estadoAnterior === status) {
            await client.query('ROLLBACK');
            return res.status(200).json({
                message: status
                    ? 'Professor já está ativo.'
                    : 'Professor já está inativo.',
                suspensos: { curriculares: 0, extraCurriculares: 0, total: 0 },
            });
        }

        let resultadoSuspensao = {
            suspensosCurriculares: 0,
            suspensosExtra: 0,
            totalSuspensos: 0,
            totalLigados: 0,
        };

        if (status === false) {
            resultadoSuspensao = await suspenderServicosDoProfessor(
                client,
                idProfessor
            );
        }

        await client.query(`UPDATE users SET status = $1 WHERE id_user = $2`, [
            status,
            professor.id_user,
        ]);

        await client.query('COMMIT');

        await registarUpdate(
            req.userId ?? null,
            'professores',
            idProfessor,
            {
                status: estadoAnterior,
            },
            {
                status,
                suspensosCurriculares: resultadoSuspensao.suspensosCurriculares,
                suspensosExtra: resultadoSuspensao.suspensosExtra,
            },
            'alert'
        );

        if (status === false && resultadoSuspensao.totalSuspensos > 0) {
            for (const idServico of resultadoSuspensao.idsCurriculares) {
                await registarUpdate(
                    req.userId ?? null,
                    'servico_curricular',
                    idServico,
                    {
                        ativo: true,
                        id_professor: idProfessor,
                    },
                    {
                        ativo: false,
                        id_professor: idProfessor,
                        motivo: 'professor_inativado',
                    },
                    'alert'
                );
            }

            for (const idServico of resultadoSuspensao.idsExtra) {
                await registarUpdate(
                    req.userId ?? null,
                    'servico_extra_curricular',
                    idServico,
                    {
                        ativo: true,
                        id_professor: idProfessor,
                    },
                    {
                        ativo: false,
                        id_professor: idProfessor,
                        motivo: 'professor_inativado',
                    },
                    'alert'
                );
            }
        }

        const message = status
            ? 'Professor ativado com sucesso.'
            : `Professor inativado com sucesso. ${resultadoSuspensao.totalSuspensos} serviço(s) foram suspensos.`;

        return res.status(200).json({
            message,
            suspensos: {
                curriculares: resultadoSuspensao.suspensosCurriculares,
                extraCurriculares: resultadoSuspensao.suspensosExtra,
                total: resultadoSuspensao.totalSuspensos,
            },
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }
        console.error('Erro ao alterar estado do professor:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao alterar estado do professor.' });
    } finally {
        client.release();
    }
}

export async function eliminarProfessorDefinitivo(req, res) {
    const idProfessor = Number(req.params?.id);

    if (!Number.isInteger(idProfessor) || idProfessor <= 0) {
        return res.status(400).json({ message: 'ID de professor inválido.' });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const professorResult = await client.query(
            `
				SELECT pr.id_professor, pr.id_user, pr.id_pessoa, p.nome, u.email, u.status
				FROM professores pr
				INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
				INNER JOIN users u ON u.id_user = pr.id_user
				WHERE pr.id_professor = $1
				LIMIT 1
			`,
            [idProfessor]
        );

        if (!professorResult.rows.length) {
            await client.query('ROLLBACK');
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        const professor = professorResult.rows[0];
        const resultadoSuspensao = await suspenderServicosDoProfessor(
            client,
            idProfessor
        );

        await client.query(
            `UPDATE users SET status = false WHERE id_user = $1`,
            [professor.id_user]
        );

        if (resultadoSuspensao.totalLigados > 0) {
            await client.query('COMMIT');

            for (const idServico of resultadoSuspensao.idsCurriculares) {
                await registarUpdate(
                    req.userId ?? null,
                    'servico_curricular',
                    idServico,
                    {
                        ativo: true,
                        id_professor: idProfessor,
                    },
                    {
                        ativo: false,
                        id_professor: idProfessor,
                        motivo: 'professor_eliminacao_bloqueada',
                    },
                    'alert'
                );
            }

            for (const idServico of resultadoSuspensao.idsExtra) {
                await registarUpdate(
                    req.userId ?? null,
                    'servico_extra_curricular',
                    idServico,
                    {
                        ativo: true,
                        id_professor: idProfessor,
                    },
                    {
                        ativo: false,
                        id_professor: idProfessor,
                        motivo: 'professor_eliminacao_bloqueada',
                    },
                    'alert'
                );
            }

            await registarUpdate(
                req.userId ?? null,
                'professores',
                idProfessor,
                {
                    acao: 'delete_attempt',
                    status: professor.status,
                },
                {
                    acao: 'blocked_by_service_links',
                    status: false,
                    totalServicosLigados: resultadoSuspensao.totalLigados,
                    totalServicosSuspensos: resultadoSuspensao.totalSuspensos,
                },
                'critical'
            );

            return res.status(409).json({
                message:
                    'Professor inativado e serviços suspensos. Eliminação definitiva bloqueada enquanto existirem serviços ligados a este professor.',
                deleted: false,
                suspensos: {
                    curriculares: resultadoSuspensao.suspensosCurriculares,
                    extraCurriculares: resultadoSuspensao.suspensosExtra,
                    total: resultadoSuspensao.totalSuspensos,
                },
                totalServicosLigados: resultadoSuspensao.totalLigados,
            });
        }

        await client.query(`DELETE FROM professores WHERE id_professor = $1`, [
            idProfessor,
        ]);
        await client.query(`DELETE FROM users WHERE id_user = $1`, [
            professor.id_user,
        ]);
        await client.query(`DELETE FROM pessoas WHERE id_pessoa = $1`, [
            professor.id_pessoa,
        ]);

        await client.query('COMMIT');

        for (const idServico of resultadoSuspensao.idsCurriculares) {
            await registarUpdate(
                req.userId ?? null,
                'servico_curricular',
                idServico,
                {
                    ativo: true,
                    id_professor: idProfessor,
                },
                {
                    ativo: false,
                    id_professor: idProfessor,
                    motivo: 'professor_eliminado',
                },
                'alert'
            );
        }

        for (const idServico of resultadoSuspensao.idsExtra) {
            await registarUpdate(
                req.userId ?? null,
                'servico_extra_curricular',
                idServico,
                {
                    ativo: true,
                    id_professor: idProfessor,
                },
                {
                    ativo: false,
                    id_professor: idProfessor,
                    motivo: 'professor_eliminado',
                },
                'alert'
            );
        }

        await registarDelete(
            req.userId ?? null,
            'professores',
            idProfessor,
            {
                nome: professor.nome,
                email: professor.email,
            },
            'critical'
        );

        return res.status(200).json({
            message: 'Professor eliminado definitivamente com sucesso.',
            deleted: true,
            suspensos: {
                curriculares: resultadoSuspensao.suspensosCurriculares,
                extraCurriculares: resultadoSuspensao.suspensosExtra,
                total: resultadoSuspensao.totalSuspensos,
            },
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }
        console.error(
            'Erro ao eliminar professor definitivamente:',
            error.message
        );
        return res
            .status(500)
            .json({ message: 'Erro ao eliminar professor definitivamente.' });
    } finally {
        client.release();
    }
}

export async function obterPerfilProfessorLogado(req, res) {
    try {
        if (!req.userId) {
            return res
                .status(401)
                .json({ message: 'Autenticação necessária.' });
        }

        const professorResult = await db.query(
            `
                SELECT
                    pr.id_professor,
                    pr.id_user,
                    pr.id_pessoa,
                    pr.habilitacao,
                    pr.area_ensino,
                    pr.nivel
                FROM professores pr
                INNER JOIN users u ON u.id_user = pr.id_user
                WHERE u.id_user = $1
                LIMIT 1
            `,
            [req.userId]
        );

        if (!professorResult.rows.length) {
            return res
                .status(404)
                .json({ message: 'Professor não encontrado.' });
        }

        const professor = professorResult.rows[0];

        const pessoaResult = await db.query(
            `
                SELECT
                    p.id_pessoa,
                    p.nome,
                    p.data_nasc,
                    p.cc,
                    p.nif,
                    p.morada,
                    p.localidade,
                    p.cod_postal,
                    p.telemovel,
                    p.telefone,
                    p.created_at
                FROM pessoas p
                WHERE p.id_pessoa = $1
                LIMIT 1
            `,
            [professor.id_pessoa]
        );

        const userResult = await db.query(
            `
                SELECT
                    u.id_user,
                    u.email,
                    u.role,
                    u.status,
                    u.created_at
                FROM users u
                WHERE u.id_user = $1
                LIMIT 1
            `,
            [professor.id_user]
        );

        const disciplinasResult = await db.query(
            `
                SELECT DISTINCT
                    d.id_disciplina,
                    d.nome
                FROM servicos_curriculares sc
                INNER JOIN disciplinas d ON d.id_disciplina = sc.id_disciplina
                WHERE sc.id_professor = $1
                  AND COALESCE(sc.ativo, true) = true
                ORDER BY d.nome
            `,
            [professor.id_professor]
        );

        const pessoa = pessoaResult.rows[0];
        const user = userResult.rows[0];

        return res.status(200).json({
            professor: {
                id_professor: professor.id_professor,
                id_user: professor.id_user,
                id_pessoa: professor.id_pessoa,
                nome: pessoa?.nome || null,
                data_nascimento: pessoa?.data_nasc || null,
                cc: pessoa?.cc || null,
                nif: pessoa?.nif || null,
                morada: pessoa?.morada || null,
                localidade: pessoa?.localidade || null,
                codigo_postal: pessoa?.cod_postal || null,
                telemovel: pessoa?.telemovel || null,
                telefone: pessoa?.telefone || null,
                email: user?.email || null,
                habilitacoes: professor.habilitacao || null,
                area: professor.area_ensino || null,
                grau: professor.nivel || null,
                disciplinas: disciplinasResult.rows.map((d) => ({
                    id_disciplina: d.id_disciplina,
                    nome: d.nome,
                })),
            },
        });
    } catch (error) {
        console.error('Erro ao obter perfil do professor:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao obter perfil do professor.' });
    }
}
