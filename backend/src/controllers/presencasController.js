import { db } from '../config/db.js';
import { obterAlunoPorUserId } from '../models/alunos.js';
import { dispatchAlertaAusencia } from '../services/alertasDispatchService.js';
import { registarInsert, registarUpdate } from '../services/logService.js';

function normalizeDateOnly(value) {
    if (!value) {
        return null;
    }

    const raw = String(value).trim();
    if (!raw) {
        return null;
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return isoMatch[0].slice(0, 10);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

function normalizeTimeOnly(value) {
    return String(value || '')
        .trim()
        .slice(0, 5);
}

function quoteIdent(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

function parseDateOrNull(value) {
    const normalized = normalizeDateOnly(value);
    if (!normalized) {
        return null;
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDiasSemana(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) =>
                String(
                    item && typeof item === 'object'
                        ? item.dia || item.day || ''
                        : item || ''
                )
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);
    }

    if (!value) {
        return [];
    }

    if (typeof value === 'string') {
        try {
            return parseDiasSemana(JSON.parse(value));
        } catch {
            return value
                .split(',')
                .map((item) =>
                    String(item || '')
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean);
        }
    }

    return [];
}

function parseScheduleEntries(value, fallbackStart, fallbackEnd) {
    const raw = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? (() => {
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            })()
          : [];

    const entries = raw
        .map((item) => {
            if (item && typeof item === 'object') {
                return {
                    dia: String(item.dia || item.day || '')
                        .trim()
                        .toLowerCase(),
                    horaInicio: normalizeTimeOnly(
                        item.horaInicio || item.hora_inicio || fallbackStart
                    ),
                    horaFim: normalizeTimeOnly(
                        item.horaFim || item.hora_fim || fallbackEnd
                    ),
                };
            }

            return {
                dia: String(item || '')
                    .trim()
                    .toLowerCase(),
                horaInicio: normalizeTimeOnly(fallbackStart),
                horaFim: normalizeTimeOnly(fallbackEnd),
            };
        })
        .filter((item) => item.dia);

    return entries.length
        ? entries
        : [
              {
                  dia: '',
                  horaInicio: normalizeTimeOnly(fallbackStart),
                  horaFim: normalizeTimeOnly(fallbackEnd),
              },
          ];
}

function mapDayIndexToKey(dayIndex) {
    const dayKeys = [
        'domingo',
        'segunda',
        'terca',
        'quarta',
        'quinta',
        'sexta',
        'sabado',
    ];

    return dayKeys[dayIndex] || '';
}

function getDefaultAttendanceRange(referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();

    return {
        from: new Date(year, month, 1),
        to: new Date(year, month + 1, 0),
    };
}

function extractReplacementDateFromObservation(value) {
    const match = String(value || '').match(
        /Reposi\S*\s+em\s+(\d{4}-\d{2}-\d{2})/i
    );
    return match ? match[1] : null;
}

function getAnoLetivoRange(referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    const startYear = month >= 9 ? year : year - 1;
    const endYear = startYear + 1;

    return {
        label: `${startYear}/${endYear}`,
        startDate: `${startYear}-09-01`,
        endDate: `${endYear}-09-01`,
    };
}

async function resolveInscricoesServicoColumn(client) {
    const { rows } = await client.query(`
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

    return rows[0]?.id_professor || null;
}

async function hasPresencasDataReposicaoColumn(client = db) {
    const { rows } = await client.query(
        `
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'presencas'
              AND column_name = 'data_reposicao'
            LIMIT 1
        `
    );

    return Boolean(rows[0]);
}

async function resolvePacotesHorasColumn(client = db) {
    const { rows } = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pacotes'
    `);

    const columns = new Set(
        rows.map((row) => String(row.column_name || '').toLowerCase())
    );
    const candidates = [
        'horas',
        'horas_subscritas',
        'horas_mes',
        'horas_mensais',
        'carga_horaria',
        'carga_horaria_mensal',
    ];

    for (const candidate of candidates) {
        if (columns.has(candidate)) {
            return candidate;
        }
    }

    return null;
}

function normalizeMonth(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})/);
    if (match) {
        return `${match[1]}-${match[2]}`;
    }

    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(monthValue) {
    const month = normalizeMonth(monthValue);
    const [year, monthNumber] = month.split('-').map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0);

    return {
        month,
        startDate: formatDateKey(start),
        endDate: formatDateKey(end),
    };
}

function mapAttendanceRows(rows) {
    return rows.map((row) => ({
        id_aluno: row.id_aluno,
        nome: String(row.nome || 'Aluno').trim(),
        ano: row.ano == null ? '' : String(row.ano).trim(),
        turma: row.turma == null ? '' : String(row.turma).trim(),
        estado: String(row.estado || 'presente')
            .trim()
            .toLowerCase(),
        observacao: String(row.observacao || '').trim(),
        data_reposicao:
            normalizeDateOnly(row.data_reposicao) ||
            extractReplacementDateFromObservation(row.observacao),
    }));
}

async function notificarFaltasRegistadas({
    faltasParaNotificar,
    serviceId,
    dataAula,
    horaAula,
}) {
    const uniqueAbsenceStudentIds = [...new Set(faltasParaNotificar)];
    if (!uniqueAbsenceStudentIds.length) {
        return;
    }

    try {
        const alunosParaNotificar = await db.query(
            `
                SELECT a.id_aluno, a.id_user, p.nome
                FROM alunos a
                INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                WHERE a.id_aluno = ANY($1::int[])
                  AND a.id_user IS NOT NULL
            `,
            [uniqueAbsenceStudentIds]
        );

        await Promise.allSettled(
            alunosParaNotificar.rows.map((row) =>
                dispatchAlertaAusencia({
                    for_user_ids: [row.id_user],
                    ausencia: {
                        id_aluno: row.id_aluno,
                        aluno: String(row.nome || 'Aluno').trim(),
                        id_servico: serviceId,
                        data: dataAula,
                        hora: horaAula || null,
                        estado: 'falta',
                        observacao:
                            'Foi registada uma falta na sua assiduidade.',
                    },
                    pushLink: '/aluno/presencas',
                })
            )
        );
    } catch (notificationError) {
        console.warn(
            '[presencasController] Falha ao notificar faltas:',
            notificationError.message
        );
    }
}

async function registarLogsPresencas({
    userId,
    serviceId,
    dataAula,
    horaAula,
    inserts,
    updates,
}) {
    try {
        if (inserts.length > 0) {
            await registarInsert(
                userId,
                'presencas',
                {
                    id_servico: serviceId,
                    data_aula: dataAula,
                    hora_aula: horaAula,
                    tipo: 'novas_presenças',
                    total_alunos: inserts.length,
                    alunos_presentes: inserts.filter(
                        (p) => p.estado === 'presente'
                    ).length,
                    alunos_faltas: inserts.filter((p) => p.estado === 'falta')
                        .length,
                    detalhes: inserts,
                },
                serviceId
            );
        }

        for (const { item, existing } of updates) {
            await registarUpdate(
                userId,
                'presencas',
                serviceId,
                {
                    id_servico: serviceId,
                    id_aluno: item.id_aluno,
                    data_aula: dataAula,
                    estado: existing.estado,
                    observacao: existing.observacao,
                    data_reposicao: existing.data_reposicao,
                },
                {
                    id_servico: serviceId,
                    id_aluno: item.id_aluno,
                    data_aula: dataAula,
                    estado: item.estado,
                    observacao: item.observacao,
                    data_reposicao: item.data_reposicao,
                }
            );
        }
    } catch (logError) {
        console.warn(
            '[presencasController] Falha ao registar logs de presenças:',
            logError.message
        );
    }
}

function expandServiceSessions(rows, fromDate, toDate, markedSessions) {
    const sessions = [];

    rows.forEach((row) => {
        const startDate = parseDateOrNull(row.data_inicio);
        const endDate = parseDateOrNull(row.data_fim) || startDate;

        if (!startDate || !endDate) {
            return;
        }

        const intervalStart = startDate > fromDate ? startDate : fromDate;
        const intervalEnd = endDate < toDate ? endDate : toDate;

        if (intervalStart > intervalEnd) {
            return;
        }

        const scheduleEntries = parseScheduleEntries(
            row.dias_semana,
            row.hora_inicio,
            row.hora_fim
        );
        const isSingleOccurrence = startDate.getTime() === endDate.getTime();
        const cursor = new Date(intervalStart);

        while (cursor <= intervalEnd) {
            const dateKey = formatDateKey(cursor);
            const dayKey = mapDayIndexToKey(cursor.getDay());
            const allowedEntries = isSingleOccurrence
                ? scheduleEntries
                : scheduleEntries.filter(
                      (entry) => !entry.dia || entry.dia === dayKey
                  );

            if (allowedEntries.length) {
                const serviceId = Number(row.id_servico);

                allowedEntries.forEach((entry) => {
                    sessions.push({
                        id_servico: serviceId,
                        id: serviceId,
                        sessionKey: `${serviceId}:${dateKey}`,
                        titulo: String(row.disciplina || 'Serviço').trim(),
                        disciplina: row.disciplina,
                        sala:
                            String(row.sala || 'Sem sala').trim() ||
                            'Sem sala',
                        data_inicio: dateKey,
                        dataInicio: dateKey,
                        data_fim: dateKey,
                        dataFim: dateKey,
                        dataAula: dateKey,
                        hora_inicio: entry.horaInicio,
                        horaInicio: entry.horaInicio,
                        hora_fim: entry.horaFim,
                        horaFim: entry.horaFim,
                        total_alunos: Number(row.total_alunos || 0),
                        totalAlunos: Number(row.total_alunos || 0),
                        marcada: markedSessions.has(`${serviceId}:${dateKey}`),
                    });
                });
            }

            cursor.setDate(cursor.getDate() + 1);
        }
    });

    return sessions.sort((a, b) => {
        const dateCompare = b.dataAula.localeCompare(a.dataAula);
        if (dateCompare !== 0) return dateCompare;
        const timeCompare = a.horaInicio.localeCompare(b.horaInicio);
        if (timeCompare !== 0) return timeCompare;
        return Number(b.id) - Number(a.id);
    });
}

export async function listarServicosParaPresencaProfessor(req, res) {
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

        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(db);
        if (!inscricoesServicoColumn) {
            return res.status(200).json({ servicos: [] });
        }

        const defaultRange = getDefaultAttendanceRange();
        const fromDate = parseDateOrNull(req.query?.from) || defaultRange.from;
        const toDate = parseDateOrNull(req.query?.to) || defaultRange.to;
        const fromKey = formatDateKey(fromDate);
        const toKey = formatDateKey(toDate);

        let { rows } = await db.query(
            `
                SELECT
                    s.id_servico,
                    COALESCE(d.nome, 'Serviço') AS disciplina,
                    COALESCE(sa.nome, 'Sem sala') AS sala,
                    s.data_inicio,
                    s.data_fim,
                    s.hora_inicio,
                    s.hora_fim,
                    s.dias_semana,
                    COALESCE(COUNT(DISTINCT i.id_aluno), 0)::int AS total_alunos
                FROM servicos_curriculares s
                LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
                LEFT JOIN salas sa ON sa.id_sala = s.id_sala
                LEFT JOIN inscricoes i
                    ON i.${inscricoesServicoColumn} = s.id_servico
                   AND LOWER(COALESCE(i.estado, '')) = 'ativa'
                WHERE s.id_professor = $1
                  AND COALESCE(s.ativo, true) = true
                  AND s.data_inicio <= $3::date
                  AND COALESCE(s.data_fim, s.data_inicio) >= $2::date
                GROUP BY
                    s.id_servico,
                    d.nome,
                    sa.nome,
                    s.data_inicio,
                    s.data_fim,
                    s.hora_inicio,
                    s.hora_fim,
                    s.dias_semana
                ORDER BY s.data_inicio DESC, s.hora_inicio ASC, s.id_servico DESC
            `,
            [professorId, fromKey, toKey]
        );

        const serviceIds = rows.map((row) => Number(row.id_servico));
        const markedResult = serviceIds.length
            ? await db.query(
                  `
                    SELECT DISTINCT id_servico, data_aula
                    FROM presencas
                    WHERE id_servico = ANY($1::int[])
                      AND data_aula >= $2::date
                      AND data_aula <= $3::date
                `,
                  [serviceIds, fromKey, toKey]
              )
            : { rows: [] };

        const markedSessions = new Set(
            markedResult.rows
                .map((row) => {
                    const dateKey = normalizeDateOnly(row.data_aula);
                    return dateKey
                        ? `${Number(row.id_servico)}:${dateKey}`
                        : null;
                })
                .filter(Boolean)
        );

        rows = expandServiceSessions(rows, fromDate, toDate, markedSessions);

        return res.status(200).json({
            servicos: rows.map((row) => ({
                id: row.id_servico,
                sessionKey: row.sessionKey,
                titulo: String(row.disciplina || 'Serviço').trim(),
                sala: String(row.sala || 'Sem sala').trim() || 'Sem sala',
                dataInicio: row.data_inicio
                    ? String(row.data_inicio).slice(0, 10)
                    : '',
                dataFim: row.data_fim ? String(row.data_fim).slice(0, 10) : '',
                dataAula: row.dataAula,
                horaInicio: String(row.hora_inicio || '').slice(0, 5),
                horaFim: String(row.hora_fim || '').slice(0, 5),
                totalAlunos: Number(row.total_alunos || 0),
                marcada: Boolean(row.marcada),
            })),
        });
    } catch (error) {
        console.error('Erro ao listar serviços para presenças:', error.message);
        return res.status(500).json({
            message: 'Erro ao listar serviços para presenças.',
        });
    }
}

export async function obterPresencaProfessor(req, res) {
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

        const serviceId = Number(req.params?.id_servico);
        const dataAula = normalizeDateOnly(req.query?.data);

        if (!Number.isInteger(serviceId) || serviceId <= 0) {
            return res.status(400).json({ message: 'Serviço inválido.' });
        }

        if (!dataAula) {
            return res.status(400).json({ message: 'Data da aula inválida.' });
        }

        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(db);
        if (!inscricoesServicoColumn) {
            return res.status(200).json({
                servico: null,
                alunos: [],
                presencas: [],
            });
        }

        const serviceResult = await db.query(
            `
                SELECT
                    s.id_servico,
                    COALESCE(d.nome, 'Serviço') AS disciplina,
                    COALESCE(sa.nome, 'Sem sala') AS sala,
                    s.data_inicio,
                    s.data_fim,
                    s.hora_inicio,
                    s.hora_fim
                FROM servicos_curriculares s
                LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
                LEFT JOIN salas sa ON sa.id_sala = s.id_sala
                WHERE s.id_servico = $1
                  AND s.id_professor = $2
                  AND COALESCE(s.ativo, true) = true
                LIMIT 1
            `,
            [serviceId, professorId]
        );

        const servico = serviceResult.rows[0];
        if (!servico) {
            return res.status(404).json({
                message: 'Serviço não encontrado para este professor.',
            });
        }

        const hasDataReposicao = await hasPresencasDataReposicaoColumn();

        const [studentsResult, presencasResult] = await Promise.all([
            db.query(
                `
                    SELECT
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
                    WHERE s.id_servico = $1
                      AND s.id_professor = $2
                      AND COALESCE(s.ativo, true) = true
                    ORDER BY p.nome ASC, a.id_aluno ASC
                `,
                [serviceId, professorId]
            ),
            db.query(
                `
                    SELECT
                        pr.id_aluno,
                        p.nome,
                        a.ano,
                        a.turma,
                        pr.estado,
                        pr.observacao
                        ${hasDataReposicao ? ', pr.data_reposicao' : ''}
                    FROM presencas pr
                    INNER JOIN alunos a ON a.id_aluno = pr.id_aluno
                    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                    WHERE pr.id_servico = $1
                      AND pr.data_aula = $2
                    ORDER BY pr.id_aluno ASC
                `,
                [serviceId, dataAula]
            ),
        ]);

        const presencasByAluno = new Map(
            presencasResult.rows.map((row) => [
                Number(row.id_aluno),
                {
                    estado: String(row.estado || 'presente')
                        .trim()
                        .toLowerCase(),
                    observacao: String(row.observacao || '').trim(),
                    data_reposicao:
                        normalizeDateOnly(row.data_reposicao) ||
                        extractReplacementDateFromObservation(row.observacao),
                },
            ])
        );

        const idsInscritos = new Set(
            studentsResult.rows.map((row) => Number(row.id_aluno))
        );

        const alunosInscritos = studentsResult.rows.map((row) => {
            const attendance = presencasByAluno.get(Number(row.id_aluno));

            return {
                id_aluno: row.id_aluno,
                nome: String(row.nome || 'Aluno').trim(),
                ano: row.ano == null ? '' : String(row.ano).trim(),
                turma: row.turma == null ? '' : String(row.turma).trim(),
                estado: attendance?.estado || 'pendente',
                observacao: attendance?.observacao || '',
                data_reposicao: attendance?.data_reposicao || null,
                _extra: false,
            };
        });

        // Alunos que têm presença registada nesta aula mas não estão
        // inscritos no serviço ("alunos extra" adicionados pelo professor)
        // não aparecem em studentsResult; são recuperados aqui a partir da
        // própria tabela presencas para que continuem visíveis ao reabrir.
        const alunosExtra = presencasResult.rows
            .filter((row) => !idsInscritos.has(Number(row.id_aluno)))
            .map((row) => {
                const attendance = presencasByAluno.get(Number(row.id_aluno));

                return {
                    id_aluno: row.id_aluno,
                    nome: String(row.nome || 'Aluno').trim(),
                    ano: row.ano == null ? '' : String(row.ano).trim(),
                    turma: row.turma == null ? '' : String(row.turma).trim(),
                    estado: attendance?.estado || 'pendente',
                    observacao: attendance?.observacao || '',
                    data_reposicao: attendance?.data_reposicao || null,
                    _extra: true,
                };
            });

        const alunos = [...alunosInscritos, ...alunosExtra];

        return res.status(200).json({
            servico: {
                id_servico: servico.id_servico,
                disciplina: String(servico.disciplina || 'Serviço').trim(),
                sala: String(servico.sala || 'Sem sala').trim() || 'Sem sala',
                data_inicio: servico.data_inicio,
                data_fim: servico.data_fim,
                hora_inicio: normalizeTimeOnly(servico.hora_inicio),
                hora_fim: normalizeTimeOnly(servico.hora_fim),
                data_aula: dataAula,
            },
            alunos,
            presencas: mapAttendanceRows(presencasResult.rows),
        });
    } catch (error) {
        console.error('Erro ao obter presenças do professor:', error.message);
        return res.status(500).json({
            message: 'Erro ao obter presenças do professor.',
        });
    }
}

export async function guardarPresencasProfessor(req, res) {
    const serviceId = Number(req.body?.id_servico);
    const dataAula = normalizeDateOnly(req.body?.data_aula);
    const horaAula = normalizeTimeOnly(req.body?.hora_aula);
    const presencas = Array.isArray(req.body?.presencas)
        ? req.body.presencas
        : [];

    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    const professorId = await getProfessorIdFromUserId(req.userId);
    if (!professorId) {
        return res.status(404).json({ message: 'Professor não encontrado.' });
    }

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
        return res.status(400).json({ message: 'Serviço inválido.' });
    }

    if (!dataAula) {
        return res.status(400).json({ message: 'Data da aula inválida.' });
    }

    if (!presencas.length) {
        return res.status(400).json({ message: 'Registo de presenças vazio.' });
    }

    const serviceResult = await db.query(
        `
            SELECT id_servico
            FROM servicos_curriculares
            WHERE id_servico = $1
              AND id_professor = $2
              AND COALESCE(ativo, true) = true
            LIMIT 1
        `,
        [serviceId, professorId]
    );

    if (!serviceResult.rows[0]) {
        return res.status(404).json({
            message: 'Serviço não encontrado para este professor.',
        });
    }

    const attendanceStates = new Set([
        'presente',
        'falta',
        'reposta',
        'justificada',
        'pendente',
    ]);
    const payload = presencas
        .map((item) => ({
            id_aluno: Number(item?.id_aluno),
            estado: String(item?.estado || 'presente')
                .trim()
                .toLowerCase(),
            observacao: String(item?.observacao || '').trim(),
            data_reposicao: normalizeDateOnly(item?.data_reposicao),
        }))
        .filter(
            (item) =>
                Number.isInteger(item.id_aluno) &&
                item.id_aluno > 0 &&
                attendanceStates.has(item.estado)
        );

    if (!payload.length) {
        return res.status(400).json({
            message: 'Não existem presenças válidas para guardar.',
        });
    }

    if (
        payload.some((item) => item.estado === 'reposta' && !item.data_reposicao)
    ) {
        return res.status(400).json({
            message: 'Indique a data de reposição para as aulas repostas.',
        });
    }

    // Confirma que todos os ids de aluno (incluindo "alunos extra" não inscritos
    // nesta sessão) correspondem a alunos reais, antes de tentar gravar.
    const idsAlunoUnicos = [...new Set(payload.map((item) => item.id_aluno))];
    const alunosExistentesResult = await db.query(
        `SELECT id_aluno FROM alunos WHERE id_aluno = ANY($1::int[])`,
        [idsAlunoUnicos]
    );
    const idsExistentes = new Set(
        alunosExistentesResult.rows.map((row) => row.id_aluno)
    );
    const idsInvalidos = idsAlunoUnicos.filter((id) => !idsExistentes.has(id));

    if (idsInvalidos.length) {
        return res.status(400).json({
            message: `Aluno(s) inválido(s) ou inexistente(s): ${idsInvalidos.join(', ')}.`,
        });
    }

    const client = await db.connect();
    let committed = false;
    try {
        await client.query('BEGIN');
        const hasDataReposicao = await hasPresencasDataReposicaoColumn(client);
        const faltasParaNotificar = [];

        // Buscar presenças que já existem
        const existingResult = await client.query(
            `
                SELECT id_aluno, estado, observacao
                    ${hasDataReposicao ? ', data_reposicao' : ''}
                FROM presencas
                WHERE id_servico = $1 AND data_aula = $2
            `,
            [serviceId, dataAula]
        );

        const existingByAluno = new Map(
            existingResult.rows.map((row) => [
                Number(row.id_aluno),
                {
                    estado: String(row.estado || 'presente').toLowerCase(),
                    observacao: String(row.observacao || '').trim(),
                    data_reposicao: normalizeDateOnly(row.data_reposicao),
                },
            ])
        );

        const inserts = [];
        const updates = [];

        for (const item of payload) {
            const existing = existingByAluno.get(item.id_aluno);

            if (existing) {
                // Verifica se houve alteração
                if (
                    existing.estado !== item.estado ||
                    existing.observacao !== item.observacao ||
                    existing.data_reposicao !== item.data_reposicao
                ) {
                    updates.push({ item, existing });
                }
            } else {
                inserts.push(item);
            }

            if (item.estado === 'falta' && existing?.estado !== 'falta') {
                faltasParaNotificar.push(item.id_aluno);
            }

            const observacao = hasDataReposicao
                ? item.observacao
                : [
                      item.estado === 'reposta'
                          ? `Reposicao em ${item.data_reposicao}`
                          : '',
                      item.observacao,
                  ]
                      .filter(Boolean)
                      .join(' - ');

            // Inserir ou atualizar na BD
            await client.query(
                `
                    INSERT INTO presencas (
                        id_servico,
                        id_aluno,
                        data_aula,
                        hora_aula,
                        estado,
                        observacao,
                        marcado_por
                        ${hasDataReposicao ? ', data_reposicao' : ''}
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7
                        ${hasDataReposicao ? ', $8' : ''}
                    )
                    ON CONFLICT (id_servico, id_aluno, data_aula)
                    DO UPDATE SET
                        hora_aula = EXCLUDED.hora_aula,
                        estado = EXCLUDED.estado,
                        observacao = EXCLUDED.observacao,
                        marcado_por = EXCLUDED.marcado_por
                        ${
                            hasDataReposicao
                                ? ', data_reposicao = EXCLUDED.data_reposicao'
                                : ''
                        }
                `,
                [
                    serviceId,
                    item.id_aluno,
                    dataAula,
                    horaAula || null,
                    item.estado,
                    observacao || null,
                    req.userId,
                    ...(hasDataReposicao ? [item.data_reposicao] : []),
                ]
            );
        }

        await client.query('COMMIT');
        committed = true;

        await Promise.allSettled([
            notificarFaltasRegistadas({
                faltasParaNotificar,
                serviceId,
                dataAula,
                horaAula,
            }),
            registarLogsPresencas({
                userId: req.userId,
                serviceId,
                dataAula,
                horaAula,
                inserts,
                updates,
            }),
        ]);

        return res.status(200).json({
            message: 'Presenças guardadas com sucesso.',
            id_servico: serviceId,
            data_aula: dataAula,
            total: payload.length,
            novos: inserts.length,
            atualizados: updates.length,
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // noop
            }
        }

        console.error('Erro ao guardar presenças do professor:', error.message);

        if (error?.code === '23503') {
            return res.status(400).json({
                message: 'Um ou mais alunos indicados são inválidos.',
            });
        }

        return res.status(500).json({
            message: 'Erro ao guardar presenças.',
        });
    } finally {
        client.release();
    }
}

export async function listarTabelaPresencasGestor(req, res) {
    try {
        const { month, startDate, endDate } = getMonthRange(req.query?.month);
        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(db);
        const pacotesHorasColumn = await resolvePacotesHorasColumn(db);

        if (!inscricoesServicoColumn) {
            return res.status(200).json({
                month,
                startDate,
                endDate,
                dias: [],
                alunos: [],
            });
        }

        const quotedServicoColumn = quoteIdent(inscricoesServicoColumn);
        const horasExpr = pacotesHorasColumn
            ? `
                COALESCE(
                    NULLIF(
                        replace(
                            regexp_replace(pac.${quoteIdent(pacotesHorasColumn)}::text, '[^0-9,.-]', '', 'g'),
                            ',',
                            '.'
                        ),
                        ''
                    )::numeric,
                    0
                )
            `
            : '0::numeric';

        const [alunosResult, presencasResult] = await Promise.all([
            db.query(
                `
                    SELECT
                        a.id_aluno,
                        COALESCE(p.nome, 'Aluno') AS nome,
                        a.ano,
                        COALESCE(SUM(${horasExpr}), 0)::numeric AS horas_subscritas
                    FROM inscricoes i
                    INNER JOIN alunos a ON a.id_aluno = i.id_aluno
                    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                    LEFT JOIN pacotes pac ON pac.id_pacote = i.id_pacote
                    LEFT JOIN servicos_curriculares s ON s.id_servico = i.${quotedServicoColumn}
                    WHERE LOWER(COALESCE(i.estado, 'ativa')) = 'ativa'
                      AND i.${quotedServicoColumn} IS NOT NULL
                      AND (
                            s.id_servico IS NULL
                            OR (
                                s.data_inicio <= $2::date
                                AND COALESCE(s.data_fim, s.data_inicio) >= $1::date
                            )
                      )
                    GROUP BY a.id_aluno, p.nome, a.ano
                    ORDER BY a.ano ASC NULLS LAST, p.nome ASC, a.id_aluno ASC
                `,
                [startDate, endDate]
            ),
            db.query(
                `
                    SELECT
                        pr.id_aluno,
                        COALESCE(p.nome, 'Aluno') AS nome,
                        a.ano,
                        pr.data_aula::date AS data_aula,
                        LOWER(COALESCE(pr.estado, '')) AS estado,
                        SUM(
                            CASE
                                WHEN LOWER(COALESCE(pr.estado, '')) IN ('presente', 'reposta')
                                 AND s.hora_inicio IS NOT NULL
                                 AND s.hora_fim IS NOT NULL
                                THEN GREATEST(
                                    EXTRACT(EPOCH FROM (s.hora_fim::time - s.hora_inicio::time)) / 3600,
                                    0
                                )
                                ELSE 0
                            END
                        )::numeric AS horas_feitas
                    FROM presencas pr
                    INNER JOIN servicos_curriculares s ON s.id_servico = pr.id_servico
                    INNER JOIN alunos a ON a.id_aluno = pr.id_aluno
                    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                    WHERE pr.data_aula >= $1::date
                      AND pr.data_aula <= $2::date
                    GROUP BY pr.id_aluno, p.nome, a.ano, pr.data_aula, LOWER(COALESCE(pr.estado, ''))
                    ORDER BY pr.data_aula ASC, a.ano ASC NULLS LAST, p.nome ASC, pr.id_aluno ASC
                `,
                [startDate, endDate]
            ),
        ]);

        const diasSet = new Set();
        const alunosMap = new Map();

        alunosResult.rows.forEach((row) => {
            alunosMap.set(Number(row.id_aluno), {
                id_aluno: Number(row.id_aluno),
                nome: String(row.nome || 'Aluno').trim(),
                ano: row.ano == null ? '' : String(row.ano).trim(),
                horas_subscritas: Number(row.horas_subscritas || 0),
                dias: {},
                presencas: [],
                total_horas_feitas: 0,
                diferenca: 0,
            });
        });

        const ESTADO_LABELS_GESTOR = { falta: 'F', presente: 'P', reposta: 'R' };
        const ESTADO_PRIORIDADE_GESTOR = { falta: 3, reposta: 2, presente: 1 };

        presencasResult.rows.forEach((row) => {
            const alunoId = Number(row.id_aluno);
            const data = normalizeDateOnly(row.data_aula);
            const horas = Number(row.horas_feitas || 0);
            const estado = String(row.estado || '');

            if (!data) {
                return;
            }

            diasSet.add(data);

            if (!alunosMap.has(alunoId)) {
                alunosMap.set(alunoId, {
                    id_aluno: alunoId,
                    nome: String(row.nome || `Aluno #${alunoId}`).trim(),
                    ano: row.ano == null ? '' : String(row.ano).trim(),
                    horas_subscritas: 0,
                    dias: {},
                    presencas: [],
                    total_horas_feitas: 0,
                    diferenca: 0,
                });
            }

            const aluno = alunosMap.get(alunoId);
            const existente = aluno.dias[data];
            const prioridadeAtual = ESTADO_PRIORIDADE_GESTOR[estado] || 0;
            const prioridadeExistente = existente
                ? ESTADO_PRIORIDADE_GESTOR[existente.estado] || 0
                : -1;
            const estadoFinal =
                prioridadeAtual >= prioridadeExistente ? estado : existente.estado;

            aluno.dias[data] = {
                estado: estadoFinal,
                label: ESTADO_LABELS_GESTOR[estadoFinal] || '',
                horas: Number(((existente?.horas || 0) + horas).toFixed(2)),
            };
            aluno.total_horas_feitas = Number(
                (aluno.total_horas_feitas + horas).toFixed(2)
            );
        });

        const alunos = Array.from(alunosMap.values())
            .map((aluno) => ({
                ...aluno,
                horas_subscritas: Number(aluno.horas_subscritas.toFixed(2)),
                presencas: Object.entries(aluno.dias)
                    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                    .map(([data, info]) => ({
                        data,
                        estado: info.estado,
                        label: info.label,
                        horas: info.horas,
                    })),
                diferenca: Number(
                    (aluno.total_horas_feitas - aluno.horas_subscritas).toFixed(2)
                ),
            }))
            .sort((a, b) => {
                const anoA = Number(a.ano);
                const anoB = Number(b.ano);
                if (!Number.isNaN(anoA) && !Number.isNaN(anoB) && anoA !== anoB) {
                    return anoA - anoB;
                }
                return a.nome.localeCompare(b.nome, 'pt');
            });

        return res.status(200).json({
            month,
            startDate,
            endDate,
            dias: Array.from(diasSet).sort(),
            alunos,
        });
    } catch (error) {
        console.error(
            'Erro ao listar tabela de presencas do gestor:',
            error.message
        );
        return res.status(500).json({
            message: 'Erro ao listar tabela de presencas.',
        });
    }
}

export async function listarMinhasPresencasAluno(req, res) {
    try {
        if (!req.userId) {
            return res
                .status(401)
                .json({ message: 'Autenticação necessária.' });
        }

        const aluno = await obterAlunoPorUserId(req.userId);
        if (!aluno?.id_aluno) {
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const anoLetivo = getAnoLetivoRange(new Date());
        const hasDataReposicao = await hasPresencasDataReposicaoColumn();

        const attendanceQuery = `
            SELECT
                pr.id_presenca,
                pr.data_aula,
                pr.hora_aula,
                pr.estado,
                pr.observacao,
                ${
                    hasDataReposicao
                        ? 'pr.data_reposicao,'
                        : 'NULL::date AS data_reposicao,'
                }
                s.id_servico,
                COALESCE(d.nome, 'Serviço') AS disciplina,
                COALESCE(p.nome, 'Professor') AS professor,
                COALESCE(sa.nome, 'Sem sala') AS sala
            FROM presencas pr
            INNER JOIN servicos_curriculares s ON s.id_servico = pr.id_servico
            LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN salas sa ON sa.id_sala = s.id_sala
            LEFT JOIN professores prf ON prf.id_professor = s.id_professor
            LEFT JOIN pessoas p ON p.id_pessoa = prf.id_pessoa
            WHERE pr.id_aluno = $1
                %s
            ORDER BY pr.data_aula DESC, pr.hora_aula DESC NULLS LAST, pr.id_presenca DESC
        `;

        let { rows } = await db.query(
            attendanceQuery.replace(
                '%s',
                'AND pr.data_aula >= $2::date AND pr.data_aula < $3::date'
            ),
            [aluno.id_aluno, anoLetivo.startDate, anoLetivo.endDate]
        );

        if (!rows.length) {
            ({ rows } = await db.query(attendanceQuery.replace('%s', ''), [
                aluno.id_aluno,
            ]));
        }

        const months = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
        ];

        const presencas = rows.map((row) => {
            const dataAula = normalizeDateOnly(row.data_aula);
            const dateObject = new Date(`${dataAula}T00:00:00`);
            const monthIndex = Number.isNaN(dateObject.getTime())
                ? 0
                : dateObject.getMonth();

            return {
                id: row.id_presenca,
                date: dataAula,
                month: months[monthIndex],
                time: String(row.hora_aula || '').trim() || '--:--',
                subject: String(row.disciplina || 'Serviço').trim(),
                teacher: String(row.professor || 'Professor').trim(),
                room: String(row.sala || 'Sem sala').trim() || 'Sem sala',
                status: String(row.estado || 'presente')
                    .trim()
                    .toLowerCase(),
                note: String(row.observacao || '').trim(),
                replacementDate:
                    normalizeDateOnly(row.data_reposicao) ||
                    extractReplacementDateFromObservation(row.observacao),
                serviceId: row.id_servico,
            };
        });

        return res.status(200).json({
            aluno: {
                id_aluno: aluno.id_aluno,
                nome: String(aluno.nome || 'Aluno').trim(),
                ano: aluno.ano,
                turma: aluno.turma,
            },
            year: anoLetivo.label,
            ano_letivo: anoLetivo.label,
            presencas,
        });
    } catch (error) {
        console.error('Erro ao listar presenças do aluno:', error.message);
        return res.status(500).json({
            message: 'Erro ao listar presenças do aluno.',
        });
    }
}

export async function obterHistoricoPresencasServicoProfessor(req, res) {
    try {
        if (!req.userId) return res.status(401).json({ message: 'Autenticação necessária.' });

        const idServico = Number(req.params?.id_servico);
        if (!Number.isInteger(idServico) || idServico <= 0) {
            return res.status(400).json({ message: 'ID de serviço inválido.' });
        }

        // Verify professor owns this service
        const { rows: checkRows } = await db.query(
            `SELECT sc.id_servico FROM servicos_curriculares sc
             INNER JOIN professores pr ON pr.id_professor = sc.id_professor
             WHERE sc.id_servico = $1 AND pr.id_user = $2
             UNION
             SELECT se.id_servico FROM servicos_extracurriculares se
             INNER JOIN professores pr ON pr.id_professor = se.id_professor
             WHERE se.id_servico = $1 AND pr.id_user = $2
             LIMIT 1`,
            [idServico, req.userId]
        );
        if (!checkRows.length) {
            return res.status(403).json({ message: 'Acesso negado a este serviço.' });
        }

        const { rows } = await db.query(
            `SELECT
                p.id_presenca,
                p.data_aula,
                p.hora_aula,
                p.estado,
                p.observacao,
                p.data_reposicao,
                p.id_aluno,
                COALESCE(pes.nome, 'Aluno') AS aluno_nome,
                a.ano_escolar AS ano,
                a.turma
             FROM presencas p
             LEFT JOIN alunos a ON a.id_aluno = p.id_aluno
             LEFT JOIN pessoas pes ON pes.id_pessoa = a.id_pessoa
             WHERE p.id_servico = $1
             ORDER BY p.data_aula DESC, a.id_aluno`,
            [idServico]
        );

        // Group by aluno for the summary
        const alunoMap = new Map();
        for (const row of rows) {
            const key = row.id_aluno ?? `extra_${row.aluno_nome}`;
            if (!alunoMap.has(key)) {
                alunoMap.set(key, {
                    id_aluno: row.id_aluno,
                    nome: row.aluno_nome,
                    ano: row.ano,
                    turma: row.turma,
                    presentes: 0,
                    faltas: 0,
                    repostas: 0,
                    total: 0,
                });
            }
            const entry = alunoMap.get(key);
            entry.total += 1;
            const est = String(row.estado || '').toLowerCase();
            if (est === 'presente') entry.presentes += 1;
            else if (est === 'falta') entry.faltas += 1;
            else if (est === 'reposta') entry.repostas += 1;
        }

        return res.status(200).json({
            registos: rows.map((r) => ({
                id_presenca: r.id_presenca,
                data_aula: normalizeDateOnly(r.data_aula),
                hora_aula: String(r.hora_aula || '').slice(0, 5),
                estado: r.estado,
                observacao: r.observacao,
                data_reposicao: normalizeDateOnly(r.data_reposicao),
                id_aluno: r.id_aluno,
                aluno_nome: r.aluno_nome,
                ano: r.ano,
                turma: r.turma,
            })),
            resumo_por_aluno: Array.from(alunoMap.values()).sort((a, b) => b.faltas - a.faltas),
        });
    } catch (error) {
        console.error('Erro ao obter histórico de presenças:', error.message);
        return res.status(500).json({ message: 'Erro ao obter histórico de presenças.' });
    }
}

/**
 * Tabela de assiduidade do professor: exatamente o mesmo mapa mensal de
 * horas usado pelo gestor (listarTabelaPresencasGestor), mas restrito aos
 * serviços (curriculares e extracurriculares) do professor autenticado.
 *
 * @route GET /api/professor/presencas/assiduidade?month=YYYY-MM
 */
export async function listarTabelaAssiduidadeProfessor(req, res) {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: 'Autenticação necessária.' });
        }

        const { month, startDate, endDate } = getMonthRange(req.query?.month);
        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(db);
        const pacotesHorasColumn = await resolvePacotesHorasColumn(db);

        if (!inscricoesServicoColumn) {
            return res.status(200).json({
                month,
                startDate,
                endDate,
                dias: [],
                alunos: [],
            });
        }

        const quotedServicoColumn = quoteIdent(inscricoesServicoColumn);
        const horasExpr = pacotesHorasColumn
            ? `
                COALESCE(
                    NULLIF(
                        replace(
                            regexp_replace(pac.${quoteIdent(pacotesHorasColumn)}::text, '[^0-9,.-]', '', 'g'),
                            ',',
                            '.'
                        ),
                        ''
                    )::numeric,
                    0
                )
            `
            : '0::numeric';

        const [alunosResult, presencasResult] = await Promise.all([
            db.query(
                `
                    SELECT
                        a.id_aluno,
                        COALESCE(p.nome, 'Aluno') AS nome,
                        a.ano,
                        COALESCE(SUM(${horasExpr}), 0)::numeric AS horas_subscritas
                    FROM inscricoes i
                    INNER JOIN alunos a ON a.id_aluno = i.id_aluno
                    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                    LEFT JOIN pacotes pac ON pac.id_pacote = i.id_pacote
                    LEFT JOIN servicos_curriculares s ON s.id_servico = i.${quotedServicoColumn}
                    WHERE LOWER(COALESCE(i.estado, 'ativa')) = 'ativa'
                      AND i.${quotedServicoColumn} IS NOT NULL
                      AND (
                            s.id_servico IS NULL
                            OR (
                                s.data_inicio <= $2::date
                                AND COALESCE(s.data_fim, s.data_inicio) >= $1::date
                            )
                      )
                      AND EXISTS (
                            SELECT 1 FROM servicos_curriculares sc
                            INNER JOIN professores pr ON pr.id_professor = sc.id_professor
                            WHERE sc.id_servico = i.${quotedServicoColumn} AND pr.id_user = $3
                      )
                    GROUP BY a.id_aluno, p.nome, a.ano
                    ORDER BY a.ano ASC NULLS LAST, p.nome ASC, a.id_aluno ASC
                `,
                [startDate, endDate, req.userId]
            ),
            db.query(
                `
                    SELECT
                        pr.id_aluno,
                        COALESCE(p.nome, 'Aluno') AS nome,
                        a.ano,
                        pr.data_aula::date AS data_aula,
                        LOWER(COALESCE(pr.estado, '')) AS estado,
                        SUM(
                            CASE
                                WHEN LOWER(COALESCE(pr.estado, '')) IN ('presente', 'reposta')
                                 AND s.hora_inicio IS NOT NULL
                                 AND s.hora_fim IS NOT NULL
                                THEN GREATEST(
                                    EXTRACT(EPOCH FROM (s.hora_fim::time - s.hora_inicio::time)) / 3600,
                                    0
                                )
                                ELSE 0
                            END
                        )::numeric AS horas_feitas
                    FROM presencas pr
                    INNER JOIN servicos_curriculares s ON s.id_servico = pr.id_servico
                    INNER JOIN professores prof ON prof.id_professor = s.id_professor
                    INNER JOIN alunos a ON a.id_aluno = pr.id_aluno
                    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
                    WHERE pr.data_aula >= $1::date
                      AND pr.data_aula <= $2::date
                      AND prof.id_user = $3
                    GROUP BY pr.id_aluno, p.nome, a.ano, pr.data_aula, LOWER(COALESCE(pr.estado, ''))
                    ORDER BY pr.data_aula ASC, a.ano ASC NULLS LAST, p.nome ASC, pr.id_aluno ASC
                `,
                [startDate, endDate, req.userId]
            ),
        ]);

        const diasSet = new Set();
        const alunosMap = new Map();

        alunosResult.rows.forEach((row) => {
            alunosMap.set(Number(row.id_aluno), {
                id_aluno: Number(row.id_aluno),
                nome: String(row.nome || 'Aluno').trim(),
                ano: row.ano == null ? '' : String(row.ano).trim(),
                horas_subscritas: Number(row.horas_subscritas || 0),
                dias: {},
                presencas: [],
                total_horas_feitas: 0,
                diferenca: 0,
            });
        });

        const ESTADO_LABELS = { falta: 'F', presente: 'P', reposta: 'R' };
        const ESTADO_PRIORIDADE = { falta: 3, reposta: 2, presente: 1 };

        presencasResult.rows.forEach((row) => {
            const alunoId = Number(row.id_aluno);
            const data = normalizeDateOnly(row.data_aula);
            const horas = Number(row.horas_feitas || 0);
            const estado = String(row.estado || '');

            if (!data) {
                return;
            }

            diasSet.add(data);

            if (!alunosMap.has(alunoId)) {
                alunosMap.set(alunoId, {
                    id_aluno: alunoId,
                    nome: String(row.nome || `Aluno #${alunoId}`).trim(),
                    ano: row.ano == null ? '' : String(row.ano).trim(),
                    horas_subscritas: 0,
                    dias: {},
                    presencas: [],
                    total_horas_feitas: 0,
                    diferenca: 0,
                });
            }

            const aluno = alunosMap.get(alunoId);
            const existente = aluno.dias[data];
            const prioridadeAtual = ESTADO_PRIORIDADE[estado] || 0;
            const prioridadeExistente = existente
                ? ESTADO_PRIORIDADE[existente.estado] || 0
                : -1;
            const estadoFinal =
                prioridadeAtual >= prioridadeExistente ? estado : existente.estado;

            aluno.dias[data] = {
                estado: estadoFinal,
                label: ESTADO_LABELS[estadoFinal] || '',
                horas: Number(((existente?.horas || 0) + horas).toFixed(2)),
            };
            aluno.total_horas_feitas = Number(
                (aluno.total_horas_feitas + horas).toFixed(2)
            );
        });

        const alunos = Array.from(alunosMap.values())
            .map((aluno) => ({
                ...aluno,
                horas_subscritas: Number(aluno.horas_subscritas.toFixed(2)),
                presencas: Object.entries(aluno.dias)
                    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                    .map(([data, info]) => ({
                        data,
                        estado: info.estado,
                        label: info.label,
                        horas: info.horas,
                    })),
                diferenca: Number(
                    (aluno.total_horas_feitas - aluno.horas_subscritas).toFixed(2)
                ),
            }))
            .sort((a, b) => {
                const anoA = Number(a.ano);
                const anoB = Number(b.ano);
                if (!Number.isNaN(anoA) && !Number.isNaN(anoB) && anoA !== anoB) {
                    return anoA - anoB;
                }
                return a.nome.localeCompare(b.nome, 'pt');
            });

        return res.status(200).json({
            month,
            startDate,
            endDate,
            dias: Array.from(diasSet).sort(),
            alunos,
        });
    } catch (error) {
        console.error('Erro ao listar tabela de assiduidade do professor:', error.message);
        return res.status(500).json({ message: 'Erro ao listar tabela de assiduidade.' });
    }
}
