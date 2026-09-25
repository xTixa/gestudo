import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { enviarEmailCredenciaisIniciais } from '../services/emailService.js';
import { notificarGestoresCriacaoConta } from '../services/alertasDispatchService.js';
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

function normalizeTimeLabel(value) {
    return String(value || '')
        .trim()
        .slice(0, 5);
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
