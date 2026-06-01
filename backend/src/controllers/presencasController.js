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
                String(item || '')
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

        const diasPermitidos = parseDiasSemana(row.dias_semana);
        const isSingleOccurrence = startDate.getTime() === endDate.getTime();
        const cursor = new Date(intervalStart);

        while (cursor <= intervalEnd) {
            const dateKey = formatDateKey(cursor);
            const dayKey = mapDayIndexToKey(cursor.getDay());
            const isAllowedDay =
                isSingleOccurrence ||
                diasPermitidos.length === 0 ||
                diasPermitidos.includes(dayKey);

            if (isAllowedDay) {
                const serviceId = Number(row.id_servico);

                sessions.push({
                    id_servico: serviceId,
                    id: serviceId,
                    sessionKey: `${serviceId}:${dateKey}`,
                    titulo: String(row.disciplina || 'ServiÃ§o').trim(),
                    disciplina: row.disciplina,
                    sala: String(row.sala || 'Sem sala').trim() || 'Sem sala',
                    data_inicio: dateKey,
                    dataInicio: dateKey,
                    data_fim: dateKey,
                    dataFim: dateKey,
                    dataAula: dateKey,
                    hora_inicio: normalizeTimeOnly(row.hora_inicio),
                    horaInicio: normalizeTimeOnly(row.hora_inicio),
                    hora_fim: normalizeTimeOnly(row.hora_fim),
                    horaFim: normalizeTimeOnly(row.hora_fim),
                    total_alunos: Number(row.total_alunos || 0),
                    totalAlunos: Number(row.total_alunos || 0),
                    marcada: markedSessions.has(`${serviceId}:${dateKey}`),
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
                        pr.estado,
                        pr.observacao
                        ${hasDataReposicao ? ', pr.data_reposicao' : ''}
                    FROM presencas pr
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

        const alunos = studentsResult.rows.map((row) => {
            const attendance = presencasByAluno.get(Number(row.id_aluno));

            return {
                id_aluno: row.id_aluno,
                nome: String(row.nome || 'Aluno').trim(),
                ano: row.ano == null ? '' : String(row.ano).trim(),
                turma: row.turma == null ? '' : String(row.turma).trim(),
                estado: attendance?.estado || 'pendente',
                observacao: attendance?.observacao || '',
                data_reposicao: attendance?.data_reposicao || null,
            };
        });

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
            message: 'Indique a data de reposiÃ§Ã£o para as aulas repostas.',
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
        return res.status(500).json({
            message: 'Erro ao guardar presenças.',
        });
    } finally {
        client.release();
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
