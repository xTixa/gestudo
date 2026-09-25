import { db } from '../config/db.js';

/**
 * ========================================
 * AGENDA CONTROLLER
 * ========================================
 * Responsável pela gestão do calendário de atividades (aulas, serviços, eventos).
 * Fornece operações para listar atividades de alunos e professores num intervalo de datas.
 * ========================================
 */

/**
 * Formata data para chave de mapa (YYYY-MM-DD)
 *
 * @param {Date} date - Data a formatar
 * @returns {string} Data em formato ISO (YYYY-MM-DD)
 */
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse de string de data ISO (YYYY-MM-DD) em objeto Date normalizado
 * Retorna null se data inválida
 *
 * @param {*} value - Valor a fazer parse
 * @returns {Date|null} Data normalizada ou null
 */
function parseDateOrNull(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Normaliza string de tempo para formato HH:MM
 * Remove segundos e ms
 *
 * @param {*} value - String de tempo (ex: '14:30:00')
 * @returns {string} Tempo no formato HH:MM ou string vazia
 */
function normalizeTime(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    return raw.slice(0, 5);
}

/**
 * Constrói título descritivo de atividade a partir de dados da tabela
 * Formato: tipo - disciplina (modalidade)
 *
 * @param {Object} row - Registo de serviço
 * @returns {string} Título formatado
 */
function buildTitle(row) {
    const tipo = String(row?.tipo || 'Serviço').trim();
    const disciplina = String(row?.disciplina || '').trim();
    const modalidade = String(row?.modalidade || '').trim();

    const parts = [tipo];
    if (disciplina) {
        parts.push(disciplina);
    }
    if (modalidade) {
        parts.push(`(${modalidade})`);
    }

    return parts.join(' - ');
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
                const horaInicio = normalizeTime(
                    item.horaInicio || item.hora_inicio || fallbackStart
                );
                const horaFim = normalizeTime(
                    item.horaFim || item.hora_fim || fallbackEnd
                );
                return {
                    dia: String(item.dia || item.day || '')
                        .trim()
                        .toLowerCase(),
                    horaInicio,
                    horaFim,
                };
            }

            return {
                dia: String(item || '')
                    .trim()
                    .toLowerCase(),
                horaInicio: normalizeTime(fallbackStart),
                horaFim: normalizeTime(fallbackEnd),
            };
        })
        .filter((item) => item.dia);

    return entries.length
        ? entries
        : [
              {
                  dia: '',
                  horaInicio: normalizeTime(fallbackStart),
                  horaFim: normalizeTime(fallbackEnd),
              },
          ];
}

// Mapeia índice de dia da semana (0-6) para chave correspondente (domingo-sabado)
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

// Normaliza lista de alunos, garantindo array de strings limpas
function normalizeAlunosList(value) {
    const rawList = Array.isArray(value)
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

    return rawList.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeDateOnly(value) {
    if (!value) {
        return null;
    }

    const raw = String(value).trim();
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return isoMatch[0];
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

async function hasPresencasDataReposicaoColumn() {
    const { rows } = await db.query(
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

function buildPresencasBySession(rows = []) {
    const map = new Map();

    rows.forEach((row) => {
        const dateKey = normalizeDateOnly(row.data_aula);
        if (!dateKey) {
            return;
        }

        map.set(`${row.id_servico}:${dateKey}`, {
            estado: String(row.estado || '')
                .trim()
                .toLowerCase(),
            data_reposicao: normalizeDateOnly(row.data_reposicao),
        });
    });

    return map;
}

function buildPresencasByService(rows = []) {
    const map = new Map();

    rows.forEach((row) => {
        const replacementDate = normalizeDateOnly(row.data_reposicao);
        if (!replacementDate) {
            return;
        }

        const serviceId = Number(row.id_servico);
        if (!Number.isInteger(serviceId)) {
            return;
        }

        if (!map.has(serviceId)) {
            map.set(serviceId, []);
        }

        map.get(serviceId).push({
            data_aula: normalizeDateOnly(row.data_aula),
            data_reposicao: replacementDate,
            estado: String(row.estado || '')
                .trim()
                .toLowerCase(),
        });
    });

    return map;
}

//construção do mapa de atividades por dia a partir das linhas retornadas pela query
/**
 * Constrói mapa de atividades por data a partir de registos brutos
 * Expande intervalo de datas (data_inicio a data_fim) em registos diarios
 * Ordena atividades de cada dia por hora de início
 *
 * @param {Array<Object>} rows - Registos de serviços da BD
 * @param {Date} fromDate - Data de início do intervalo
 * @param {Date} toDate - Data de fim do intervalo
 * @returns {Object} Mapa {data: [atividades]} onde atividades estão sordenadas por hora
 */
function buildAtividadesPorDia(
    rows,
    fromDate,
    toDate,
    presencasBySession,
    presencasByService
) {
    const map = {};

    rows.forEach((row) => {
        const startDate = parseDateOrNull(row?.data_inicio);
        const endDate = parseDateOrNull(row?.data_fim) || startDate;

        if (!startDate || !endDate) {
            return;
        }

        const intervalStart = startDate > fromDate ? startDate : fromDate;
        const intervalEnd = endDate < toDate ? endDate : toDate;

        if (intervalStart > intervalEnd) {
            return;
        }

        const atividade = {
            id: row.id_servico,
            titulo: buildTitle(row),
            tipo: String(row?.tipo || '').trim(),
            disciplina: String(row?.disciplina || '').trim(),
            modalidade: String(row?.modalidade || '').trim(),
            local: String(row?.sala || 'Sem sala').trim() || 'Sem sala',
            professor: String(row?.professor || '').trim(),
            professorCor: row?.professor_cor || null,
            alunos: normalizeAlunosList(row?.alunos),
            categoria: String(row?.categoria || 'curricular').trim(),
        };

        const scheduleEntries = parseScheduleEntries(
            row?.dias_semana,
            row?.hora_inicio,
            row?.hora_fim
        );
        const isSingleOccurrence = startDate.getTime() === endDate.getTime();
        const cursor = new Date(intervalStart);

        while (cursor <= intervalEnd) {
            const key = formatDateKey(cursor);
            const dayKey = mapDayIndexToKey(cursor.getDay());
            const allowedEntries = isSingleOccurrence
                ? scheduleEntries
                : scheduleEntries.filter(
                      (entry) => !entry.dia || entry.dia === dayKey
                  );

            if (allowedEntries.length) {
                if (!map[key]) {
                    map[key] = [];
                }

                const presenca = presencasBySession?.get(
                    `${row.id_servico}:${key}`
                );

                allowedEntries.forEach((entry) => {
                    map[key].push({
                        ...atividade,
                        hora: entry.horaInicio || '--:--',
                        horaFim: entry.horaFim || '',
                        estado: presenca?.estado || '',
                        dataReposicao: presenca?.data_reposicao || null,
                    });
                });
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        const reposicoes = presencasByService?.get(Number(row.id_servico)) || [];
        reposicoes.forEach((reposicao) => {
            const replacementDate = parseDateOrNull(reposicao.data_reposicao);
            if (
                !replacementDate ||
                replacementDate < fromDate ||
                replacementDate > toDate
            ) {
                return;
            }

            const key = formatDateKey(replacementDate);
            if (!map[key]) {
                map[key] = [];
            }

            map[key].push({
                ...atividade,
                hora: normalizeTime(row?.hora_inicio) || '--:--',
                horaFim: normalizeTime(row?.hora_fim) || '',
                estado: 'reposta',
                dataOriginal: reposicao.data_aula || null,
                dataReposicao: reposicao.data_reposicao,
            });
        });
    });

    Object.keys(map).forEach((key) => {
        map[key].sort((a, b) => a.hora.localeCompare(b.hora));
    });

    return map;
}

/**
 * Verifica se um valor é data válida em formato ISO (YYYY-MM-DD)
 *
 * @param {*} value - Valor a verificar
 * @returns {boolean} True se formato ISO válido
 */
function isISODate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

async function resolveInscricoesServicoColumn() {
    const { rows } = await db.query(
        `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inscricoes'
    `
    );

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

/**
 * Busca as atividades de agenda de um utilizador num intervalo de datas,
 * agrupadas por dia. Reutilizada tanto pelo endpoint JSON (listarAgenda)
 * como pelo gerador de feed iCalendar (calendarFeedService).
 *
 * @param {number|null} userId - ID do utilizador autenticado (ou null para vazio)
 * @param {string} fromParam - Data de início (YYYY-MM-DD)
 * @param {string} toParam - Data de fim (YYYY-MM-DD)
 * @returns {Promise<{atividadesPorDia: Object, totalServicos: number}>}
 */
export async function buscarAtividadesPorDia(userId, fromParam, toParam) {
    const fromDate = parseDateOrNull(fromParam);
    const toDate = parseDateOrNull(toParam);

    if (!fromDate || !toDate || fromDate > toDate) {
        const error = new Error('Intervalo de datas inválido.');
        error.status = 400;
        throw error;
    }

    const tableCheck = await db.query(
        `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'servicos_curriculares'
        LIMIT 1
      `
    );

    if (!tableCheck.rows.length) {
        return { atividadesPorDia: {}, totalServicos: 0 };
    }

    let alunoId = null;
    let professorId = null;

    if (userId) {
        const { rows: userRows } = await db.query(
            `
          SELECT role
          FROM users
          WHERE id_user = $1
          LIMIT 1
        `,
            [userId]
        );

        const role = String(userRows[0]?.role || '').toLowerCase();

        if (role === 'aluno') {
            const { rows: alunoRows } = await db.query(
                `
            SELECT id_aluno
            FROM alunos
            WHERE id_user = $1
            LIMIT 1
          `,
                [userId]
            );

            alunoId = alunoRows[0]?.id_aluno ?? -1;
        }

        if (role === 'professor') {
            const { rows: profRows } = await db.query(
                `
            SELECT id_professor
            FROM professores
            WHERE id_user = $1
            LIMIT 1
          `,
                [userId]
            );

            professorId = profRows[0]?.id_professor ?? -1;
        }
    }

    const inscricoesServicoColumn = await resolveInscricoesServicoColumn();

    const buildAlunosSelect = (servicoAlias) =>
        inscricoesServicoColumn
            ? `
            COALESCE(
                (
                    SELECT json_agg(DISTINCT COALESCE(NULLIF(TRIM(pes_aluno.nome), ''), NULLIF(TRIM(u_aluno.email), ''), 'Aluno'))
                    FROM inscricoes i2
                    INNER JOIN alunos a2 ON a2.id_aluno = i2.id_aluno
                    LEFT JOIN pessoas pes_aluno ON pes_aluno.id_pessoa = a2.id_pessoa
                    LEFT JOIN users u_aluno ON u_aluno.id_user = a2.id_user
                    WHERE i2.${inscricoesServicoColumn} = ${servicoAlias}.id_servico
                        AND LOWER(COALESCE(i2.estado, 'ativa')) = 'ativa'
                ),
                '[]'::json
            ) AS alunos
        `
            : `'[]'::json AS alunos`;

    const hasDataReposicao = await hasPresencasDataReposicaoColumn();
    const replacementOverlapCondition =
        hasDataReposicao && alunoId
            ? `
                OR EXISTS (
                    SELECT 1
                    FROM presencas pr_reposta
                    WHERE pr_reposta.id_servico = s.id_servico
                      AND pr_reposta.id_aluno = $4::int
                      AND LOWER(COALESCE(pr_reposta.estado, '')) = 'reposta'
                      AND pr_reposta.data_reposicao >= $1::date
                      AND pr_reposta.data_reposicao <= $2::date
                )
            `
            : '';

    const query = `
  (
    SELECT
      s.id_servico,
      s.tipo,
      s.data_inicio,
      s.data_fim,
      s.hora_inicio,
      s.hora_fim,
      s.dias_semana,
      d.nome AS disciplina,
      m.nome AS modalidade,
      sa.nome AS sala,
      COALESCE(NULLIF(TRIM(pes.nome), ''), u.email, 'Professor') AS professor,
      p.cor AS professor_cor,
      'curricular' AS categoria,
      ${buildAlunosSelect('s')}
    FROM servicos_curriculares s
    LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
    LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
    LEFT JOIN salas sa ON sa.id_sala = s.id_sala
    LEFT JOIN professores p ON p.id_professor = s.id_professor
    LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
    LEFT JOIN users u ON u.id_user = p.id_user
    WHERE COALESCE(s.ativo, true) = true
      AND (
        (
          s.data_inicio <= $2::date
          AND COALESCE(s.data_fim, s.data_inicio) >= $1::date
        )
        ${replacementOverlapCondition}
      )
      AND ($3::int IS NULL OR s.id_professor = $3::int)
      AND (
        $4::int IS NULL
        OR ${
            inscricoesServicoColumn
                ? `EXISTS (
          SELECT 1
          FROM inscricoes i
          WHERE i.${inscricoesServicoColumn} = s.id_servico
            AND i.id_aluno = $4::int
            AND i.estado = 'ativa'
        )`
                : 'false'
        }
      )
  )
  UNION ALL
  (
    SELECT
      se.id_servico,
      COALESCE(tse.nome, se.tipo, 'Serviço Extra') AS tipo,
      se.data_inicio,
      se.data_fim,
      se.hora_inicio,
      se.hora_fim,
      se.dias_semana,
      NULL::text AS disciplina,
      m.nome AS modalidade,
      sa.nome AS sala,
      COALESCE(NULLIF(TRIM(pes.nome), ''), u.email, 'Professor') AS professor,
      p.cor AS professor_cor,
      'extra-curricular' AS categoria,
      ${buildAlunosSelect('se')}
    FROM servicos_extracurriculares se
    LEFT JOIN tipo_servico_extracurricular tse ON tse.id_tipo_servico_extra = se.id_tipo_servico_extra
    LEFT JOIN modalidades m ON m.id_modalidade = se.id_modalidade
    LEFT JOIN salas sa ON sa.id_sala = se.id_sala
    LEFT JOIN professores p ON p.id_professor = se.id_professor
    LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
    LEFT JOIN users u ON u.id_user = p.id_user
    WHERE COALESCE(se.ativo, true) = true
      AND se.data_inicio <= $2::date
      AND COALESCE(se.data_fim, se.data_inicio) >= $1::date
      AND ($3::int IS NULL OR se.id_professor = $3::int)
      AND (
        $4::int IS NULL
        OR ${
            inscricoesServicoColumn
                ? `EXISTS (
          SELECT 1
          FROM inscricoes i
          WHERE i.${inscricoesServicoColumn} = se.id_servico
            AND i.id_aluno = $4::int
            AND i.estado = 'ativa'
        )`
                : 'false'
        }
      )
  )
  ORDER BY data_inicio ASC, hora_inicio ASC, id_servico ASC
`;

    const { rows } = await db.query(query, [
        fromParam,
        toParam,
        professorId,
        alunoId,
    ]);

    let presencasBySession = null;
    let presencasByService = null;
    if (alunoId) {
        const { rows: presencasRows } = await db.query(
            `
            SELECT
                id_servico,
                data_aula,
                estado,
                ${
                    hasDataReposicao
                        ? 'data_reposicao'
                        : 'NULL::date AS data_reposicao'
                }
            FROM presencas
            WHERE id_aluno = $1
              AND LOWER(COALESCE(estado, '')) = 'reposta'
              AND (
                (data_aula >= $2::date AND data_aula <= $3::date)
                ${
                    hasDataReposicao
                        ? 'OR (data_reposicao >= $2::date AND data_reposicao <= $3::date)'
                        : ''
                }
              )
            `,
            [alunoId, fromParam, toParam]
        );

        presencasBySession = buildPresencasBySession(presencasRows);
        presencasByService = buildPresencasByService(presencasRows);
    }

    const atividadesPorDia = buildAtividadesPorDia(
        rows,
        fromDate,
        toDate,
        presencasBySession,
        presencasByService
    );

    const totalServicos = Object.values(atividadesPorDia).reduce(
        (total, atividades) =>
            total + (Array.isArray(atividades) ? atividades.length : 0),
        0
    );

    return { atividadesPorDia, totalServicos };
}

/**
 * Lista agenda de atividades para utilizador autenticado num intervalo de datas
 * Filtra automaticamente por tipo de utilizador (aluno, professor, ou gestor)
 * Retorna estrutura de atividades agruadas por dia
 *
 * @param {Object} req - Objecto com query params {from, to} (formato YYYY-MM-DD)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Objecto com {atividadesPorDia, totalServicos} ou erro 400/500
 */
export async function listarAgenda(req, res) {
    try {
        const fromParam = String(req.query?.from || '');
        const toParam = String(req.query?.to || '');

        if (!isISODate(fromParam) || !isISODate(toParam)) {
            return res.status(400).json({
                message:
                    "Parâmetros 'from' e 'to' são obrigatórios no formato YYYY-MM-DD.",
            });
        }

        const resultado = await buscarAtividadesPorDia(
            req.userId,
            fromParam,
            toParam
        );

        return res.status(200).json(resultado);
    } catch (error) {
        console.error('Erro ao listar agenda:', error.message);
        return res
            .status(error.status || 500)
            .json({ message: error.message || 'Erro ao obter agenda.' });
    }
}
