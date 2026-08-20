import { db } from '../config/db.js';
import {
    registarDelete,
    registarInsert,
    registarUpdate,
} from '../services/logService.js';
import { enviarEmailReagendamentoSessao } from '../services/emailService.js';
import {
    verificarAreaFormacao,
    verificarSobrepoisaoProfessor,
    verificarSobrepoisaoAlunos,
    validarServicoCompleto,
} from '../services/agendaValidationService.js';

/**
 * ========================================
 * SERVICOS CONTROLLER
 * ========================================
 * Responsável pela gestão de serviços curriculares e extra-curriculares no sistema.
 * Fornece operações CRUD para criar, listar, atualizar e eliminar serviços.
 * ========================================
 */

/**
 * Garante que a coluna dias_semana existe na tabela
 * Se não existir, cria a coluna
 */
export async function ensureDiasSemanaColumn(client, tableName) {
    try {
        const { rows } = await client.query(
            `
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = 'dias_semana'
			LIMIT 1
		`,
            [tableName]
        );

        if (!rows.length) {
            await client.query(
                `ALTER TABLE ${tableName} ADD COLUMN dias_semana TEXT DEFAULT NULL`
            );
        }
    } catch (error) {
        console.warn(
            `Aviso ao verificar coluna dias_semana em ${tableName}:`,
            error.message
        );
    }
}

export async function ensureServiceVersionColumns(client, tableName) {
    try {
        await client.query(
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS id_servico_origem INTEGER DEFAULT NULL`
        );
        await client.query(
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS versao_criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
        );
    } catch (error) {
        console.warn(
            `Aviso ao verificar colunas de versionamento em ${tableName}:`,
            error.message
        );
    }
}

export async function verificarConflitoSalaDatabase(
    salaId,
    dataInicio,
    dataFim,
    horaInicio,
    horaFim,
    diasSemana,
    excludeServiceId = null,
    queryClient = db
) {
    const parsedDiasSemana =
        typeof diasSemana === 'string'
            ? (() => {
                  try {
                      const parsed = JSON.parse(diasSemana);
                      return Array.isArray(parsed) ? parsed : [];
                  } catch {
                      return [];
                  }
              })()
            : Array.isArray(diasSemana)
              ? diasSemana
              : [];

    if (parsedDiasSemana.some((item) => item && typeof item === 'object')) {
        const duracao = getDurationMinutes(
            normalizeTimeLabel(horaInicio),
            normalizeTimeLabel(horaFim)
        );
        const sessoes = normalizeServiceSessions({
            sessoes: parsedDiasSemana,
            horaInicio,
            duracao,
        });
        const conflicts = [];

        for (const sessao of sessoes) {
            const { rows } = await queryClient.query(
                `
                    SELECT *
                    FROM public.fn_verificar_conflito_horario(
                        $1::bigint,
                        NULL,
                        $2::date,
                        $3::time,
                        $4::time,
                        $5::text,
                        $6::date,
                        $7::bigint
                    )
                    WHERE tipo_conflito = 'sala'
                `,
                [
                    salaId,
                    dataInicio,
                    sessao.horaInicio,
                    sessao.horaFim,
                    JSON.stringify([sessao.dia]),
                    dataFim || dataInicio,
                    excludeServiceId,
                ]
            );
            conflicts.push(...rows);
        }

        return {
            hasConflict: conflicts.length > 0,
            conflicts,
        };
    }

    const { rows } = await queryClient.query(
        `
            SELECT *
            FROM public.fn_verificar_conflito_horario(
                $1::bigint,
                NULL,
                $2::date,
                $3::time,
                $4::time,
                $5::text,
                $6::date,
                $7::bigint
            )
            WHERE tipo_conflito = 'sala'
        `,
        [
            salaId,
            dataInicio,
            horaInicio,
            horaFim,
            diasSemana,
            dataFim || dataInicio,
            excludeServiceId,
        ]
    );

    return {
        hasConflict: rows.length > 0,
        conflicts: rows,
    };
}

export async function ensureAreaColumn(client, tableName) {
    try {
        await client.query(
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS area TEXT DEFAULT NULL`
        );
    } catch (error) {
        console.warn(
            `Aviso ao verificar coluna area em ${tableName}:`,
            error.message
        );
    }
}

export const NIVEL_LABELS = {
    1: '1º Ciclo',
    2: '2º Ciclo',
    3: '3º Ciclo',
    4: 'Secundário',
    5: 'Superior',
};

export async function getTableColumns(client, tableName) {
    const { rows } = await client.query(
        `
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			ORDER BY ordinal_position
		`,
        [tableName]
    );

    return rows.map((row) => String(row.column_name || '').toLowerCase());
}

export function pickFirstColumn(columns, candidates) {
    for (const candidate of candidates) {
        const normalized = String(candidate || '').toLowerCase();
        if (columns.includes(normalized)) {
            return normalized;
        }
    }

    return null;
}

export function pickLikelyIdColumn(columns) {
    const list = Array.isArray(columns)
        ? columns.map((col) => String(col || '').toLowerCase())
        : [];

    const explicit = pickFirstColumn(list, [
        'id_area_extracurricular',
        'id_area',
        'id',
    ]);
    if (explicit) {
        return explicit;
    }

    return (
        list.find((column) => /^id_/.test(column) || column.endsWith('_id')) ||
        null
    );
}

export function pickLikelyNameColumn(columns) {
    const list = Array.isArray(columns)
        ? columns.map((col) => String(col || '').toLowerCase())
        : [];

    const explicit = pickFirstColumn(list, [
        'nome',
        'area',
        'descricao',
        'designacao',
        'nome_area',
        'nomearea',
        'titulo',
    ]);
    if (explicit) {
        return explicit;
    }

    return (
        list.find(
            (column) =>
                !/^id_/.test(column) &&
                !column.endsWith('_id') &&
                ![
                    'created_at',
                    'updated_at',
                    'ativo',
                    'ativa',
                    'status',
                ].includes(column)
        ) || null
    );
}

export function pickLikelyActiveColumn(columns) {
    const list = Array.isArray(columns)
        ? columns.map((col) => String(col || '').toLowerCase())
        : [];

    return pickFirstColumn(list, ['ativa', 'ativo', 'is_active', 'active']);
}

export async function resolveExtraAreaMetadata(client) {
    const serviceColumns = await getTableColumns(
        client,
        'servicos_extracurriculares'
    );
    const areaColumns = await getTableColumns(
        client,
        'areas_extracurriculares'
    ).catch(() => []);

    const serviceAreaColumn = pickFirstColumn(serviceColumns, [
        'id_area_extracurricular',
        'id_area_extracurricular_servico',
        'id_area',
        'area_id',
        'id_areaextra',
        'id_area_extra',
    ]);

    const serviceAreaTextColumn = pickFirstColumn(serviceColumns, [
        'area',
        'area_nome',
    ]);

    const areaIdColumn = pickLikelyIdColumn(areaColumns);
    const areaNomeColumn = pickLikelyNameColumn(areaColumns);
    const areaNivelColumn = pickFirstColumn(areaColumns, [
        'id_nivel',
        'nivel_ensino',
    ]);
    const areaActiveColumn = pickLikelyActiveColumn(areaColumns);

    return {
        serviceAreaColumn,
        serviceAreaTextColumn,
        areaTableExists: Boolean(areaIdColumn && areaNomeColumn),
        areaIdColumn,
        areaNomeColumn,
        areaNivelColumn,
        areaActiveColumn,
    };
}

export async function resolveTipoServicoColumn(client) {
    try {
        const { rows } = await client.query(
            `
            SELECT kcu.column_name, ccu.table_name AS foreign_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'servicos_extracurriculares'
              AND ccu.table_name IN ('tipo_servico_extracurricular', 'tipo_servico')
        `
        );

        console.debug('[resolveTipoServicoColumn] FK query results:', rows);

        const extraRef = rows.find(
            (r) => r.foreign_table === 'tipo_servico_extracurricular'
        );
        if (extraRef) {
            console.debug(
                '[resolveTipoServicoColumn] Found extra-curricular ref:',
                extraRef
            );
            return {
                column: String(extraRef.column_name),
                refTable: 'tipo_servico_extracurricular',
            };
        }

        const curricularRef = rows.find(
            (r) => r.foreign_table === 'tipo_servico'
        );
        if (curricularRef) {
            console.debug(
                '[resolveTipoServicoColumn] Found curricular ref (no extra found):',
                curricularRef
            );
            return {
                column: String(curricularRef.column_name),
                refTable: 'tipo_servico',
            };
        }

        // Fallback: pick a likely column name
        const cols = await getTableColumns(
            client,
            'servicos_extracurriculares'
        ).catch(() => []);
        const col = pickFirstColumn(cols, [
            'id_tipo_servico_extra',
            'id_tiposervico',
            'id_tipo_servico',
            'id_tipo_servicoid',
            'id_tiposervico_extra',
        ]);

        return {
            column: col || 'id_tipo_servico_extra',
            refTable: 'tipo_servico_extracurricular',
        };
    } catch (e) {
        return {
            column: 'id_tipo_servico_extra',
            refTable: 'tipo_servico_extracurricular',
        };
    }
}

/**
 * Formata valor de nível de ensino para rótulo em Português
 * Ex: '1' -> '1º Ciclo'
 *
 * @param {*} value - Código de nível
 * @returns {string} Rótulo formatado
 */
export function formatNivelEnsino(value) {
    const key = String(value ?? '').trim();
    if (!key) {
        return 'Não definido';
    }

    return NIVEL_LABELS[key] || `Nível ${key}`;
}

/**
 * Adiciona minutos a uma hora no formato HH:MM
 * Retorna a hora final normalizada (circula até 24h)
 *
 * @param {string} timeString - Hora inicial (formato HH:MM)
 * @param {number} minutesToAdd - Número de minutos a adicionar
 * @returns {string|null} Hora final ou null se inválida
 */
export function addMinutesToTime(timeString, minutesToAdd) {
    const [hourPart, minutePart] = String(timeString || '').split(':');
    const hour = Number(hourPart);
    const minute = Number(minutePart);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return null;
    }

    const totalMinutes = hour * 60 + minute + Number(minutesToAdd || 0);
    const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const nextHour = Math.floor(normalized / 60);
    const nextMinute = normalized % 60;

    return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

export function getDurationMinutes(startTime, endTime) {
    const [startHour, startMinute] = String(startTime || '')
        .split(':')
        .map(Number);
    const [endHour, endMinute] = String(endTime || '')
        .split(':')
        .map(Number);

    if (
        [startHour, startMinute, endHour, endMinute].some((v) =>
            Number.isNaN(v)
        )
    ) {
        return 60;
    }

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const diff = (endTotal - startTotal + 24 * 60) % (24 * 60);
    return diff || 60;
}

export function normalizeDateKey(value) {
    if (!value) {
        return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    return parsed.toISOString().slice(0, 10);
}

export function isISODateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function addDaysToDateKey(dateKey, days) {
    if (!isISODateKey(dateKey)) {
        return '';
    }

    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + Number(days || 0));

    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getDate()).padStart(2, '0');
    return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function todayDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseDiasSemanaValue(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) =>
                String(item || '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return parseDiasSemanaValue(parsed);
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

export function normalizeTimeLabel(value) {
    const raw = String(value || '').trim();
    return raw ? raw.slice(0, 5) : '';
}

export function normalizeServiceSessions({
    sessoes,
    diasSemana,
    horaInicio,
    duracao,
}) {
    const source = Array.isArray(sessoes)
        ? sessoes
        : Array.isArray(diasSemana) &&
            diasSemana.some((item) => item && typeof item === 'object')
          ? diasSemana
          : [];

    const normalized = source
        .map((item) => {
            const dia = String(item?.dia || item?.day || '')
                .trim()
                .toLowerCase();
            const inicio = normalizeTimeLabel(
                item?.horaInicio || item?.hora_inicio
            );
            const minutos = Number(item?.duracao || item?.duration || duracao);
            const fim = addMinutesToTime(inicio, minutos);

            if (
                !dia ||
                !inicio ||
                !fim ||
                !Number.isFinite(minutos) ||
                minutos <= 0
            ) {
                return null;
            }

            return {
                dia,
                horaInicio: inicio,
                horaFim: fim,
                duracao: String(minutos),
            };
        })
        .filter(Boolean);

    if (normalized.length) {
        return normalized;
    }

    const dias = Array.isArray(diasSemana)
        ? diasSemana
              .map((item) =>
                  String(item || '')
                      .trim()
                      .toLowerCase()
              )
              .filter(Boolean)
        : [];

    const inicio = normalizeTimeLabel(horaInicio);
    const minutos = Number(duracao);
    const fim = addMinutesToTime(inicio, minutos);

    if (!inicio || !fim || !Number.isFinite(minutos) || minutos <= 0) {
        return [];
    }

    return dias.map((dia) => ({
        dia,
        horaInicio: inicio,
        horaFim: fim,
        duracao: String(minutos),
    }));
}

export function getPrimarySchedule(payload) {
    const sessoes = normalizeServiceSessions(payload);
    const first = sessoes[0] || null;
    const horaInicio = first?.horaInicio || normalizeTimeLabel(payload.horaInicio);
    const duracao = Number(first?.duracao || payload.duracao);

    return {
        sessoes,
        horaInicio,
        horaFim: addMinutesToTime(horaInicio, duracao),
        duracao: String(duracao || ''),
        diasSemanaJson: JSON.stringify(
            sessoes.length
                ? sessoes
                : Array.isArray(payload.diasSemana)
                  ? payload.diasSemana
                  : []
        ),
    };
}

export function hasScheduleChanged(oldRow, nextRow) {
    const oldDate = normalizeDateKey(oldRow?.data_inicio);
    const nextDate = normalizeDateKey(nextRow?.data_inicio);
    const oldStart = normalizeTimeLabel(oldRow?.hora_inicio);
    const nextStart = normalizeTimeLabel(nextRow?.hora_inicio);
    const oldEnd = normalizeTimeLabel(oldRow?.hora_fim);
    const nextEnd = normalizeTimeLabel(nextRow?.hora_fim);
    const oldSala = Number(oldRow?.id_sala) || 0;
    const nextSala = Number(nextRow?.id_sala) || 0;

    return (
        oldDate !== nextDate ||
        oldStart !== nextStart ||
        oldEnd !== nextEnd ||
        oldSala !== nextSala
    );
}

export function formatDatePt(value) {
    const iso = normalizeDateKey(value);
    if (!iso) {
        return '-';
    }

    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export async function resolveSalaNomeById(client, idSala) {
    const salaId = Number(idSala);
    if (!Number.isInteger(salaId) || salaId <= 0) {
        return 'Sala';
    }

    try {
        const { rows } = await client.query(
            `
                SELECT nome
                FROM salas
                WHERE id_sala = $1
                LIMIT 1
            `,
            [salaId]
        );

        return String(rows[0]?.nome || '').trim() || 'Sala';
    } catch {
        return 'Sala';
    }
}

export async function carregarDestinatariosReagendamentoCurricular(client, idServico) {
    const destinatarios = [];

    const professorResult = await client.query(
        `
            SELECT
                COALESCE(NULLIF(u.email, ''), '') AS email,
                COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Professor') AS nome
            FROM servicos_curriculares s
            LEFT JOIN professores p ON p.id_professor = s.id_professor
            LEFT JOIN users u ON u.id_user = p.id_user
            LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
            WHERE s.id_servico = $1
            LIMIT 1
        `,
        [idServico]
    );

    const professorEmail = String(professorResult.rows[0]?.email || '').trim();
    if (professorEmail) {
        destinatarios.push({
            email: professorEmail,
            nome: String(professorResult.rows[0]?.nome || 'Professor').trim(),
        });
    }

    const inscricoesServicoColumn =
        await resolveInscricoesServicoColumn(client);
    if (!inscricoesServicoColumn) {
        return destinatarios;
    }

    const alunosResult = await client.query(
        `
            SELECT DISTINCT
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
            email,
            nome: String(row?.nome || 'Aluno').trim(),
        });
    });

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

export async function enviarNotificacoesReagendamento({
    destinatarios,
    tituloSessao,
    dataAnterior,
    horaAnterior,
    salaAnterior,
    dataNova,
    horaNova,
    salaNova,
    motivo,
}) {
    if (!Array.isArray(destinatarios) || !destinatarios.length) {
        return;
    }

    const results = await Promise.allSettled(
        destinatarios.map((destinatario) =>
            enviarEmailReagendamentoSessao({
                nome: destinatario.nome,
                email: destinatario.email,
                tituloSessao,
                dataAnterior,
                horaAnterior,
                salaAnterior,
                dataNova,
                horaNova,
                salaNova,
                motivo,
            })
        )
    );

    const failed = results.filter((result) => {
        if (result.status === 'rejected') {
            return true;
        }

        return result.value?.ok === false;
    }).length;

    if (failed > 0) {
        console.warn(
            `Notificações de reagendamento com falhas: ${failed}/${results.length}`
        );
    }
}

/**
 * Calcula o ano letivo a partir de uma data
 * Ano letivo começa em Setembro
 *
 * @param {*} dateValue - Data (string ou Date)
 * @returns {string|null} Ano letivo ou null se inválido
 */
export function getAnoLetivo(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

/**
 * Calcula a data de fim do ano letivo (31 de Agosto)
 * A partir de uma data, extrai o ano letivo e retorna o último dia do mesmo
 *
 * @param {*} dateValue - Data (string ou Date)
 * @returns {string|null} Data em formato YYYY-MM-DD (31 de Agosto) ou null se inválido
 */
export function getDataFimAnoLetivo(dateValue) {
    const anoLetivo = getAnoLetivo(dateValue);
    if (!anoLetivo) {
        return null;
    }

    const [anoInicio, anoFim] = anoLetivo.split('/').map(Number);
    // O ano letivo termina no segundo ano (ex: 2025/2026 → 2026-08-31)
    return `${anoFim}-08-31`;
}

/**
 * Mapeia registo bruto da BD para DTO de serviço (formato API)
 * Normaliza tipos, formata nível de ensino, aplica rótulos
 *
 * @param {Object} row - Registo da BD
 * @returns {Object} DTO com {id, periodicidade, tipoServico, modalidade, nivelEnsino, area, nAlunos}
 */
export function mapServicoRow(row) {
    const tipoRaw = String(row.tipo_servico || '').toLowerCase();
    const tipoCanonicalRaw = normalizeText(row.tipo_canonical || row.tipo);
    const tipoLabel =
        tipoRaw === 'periodico'
            ? 'Periódico'
            : tipoRaw === 'unico'
              ? 'Único'
              : row.tipo_servico;
    const periodicidadeLabel =
        tipoCanonicalRaw === 'periodico'
            ? 'Periódico'
            : tipoCanonicalRaw === 'unico'
              ? 'Único'
              : row.periodicidade;
    const dataInicio = row.data_inicio
        ? new Date(row.data_inicio).toISOString().slice(0, 10)
        : '';
    const horaInicio = row.hora_inicio
        ? String(row.hora_inicio).slice(0, 5)
        : '';
    const horaFim = row.hora_fim ? String(row.hora_fim).slice(0, 5) : '';
    let diasSemana = [];
    let sessoes = [];

    if (Array.isArray(row.dias_semana)) {
        if (row.dias_semana.some((item) => item && typeof item === 'object')) {
            sessoes = normalizeServiceSessions({ sessoes: row.dias_semana });
            diasSemana = sessoes.map((item) => item.dia);
        } else {
            diasSemana = row.dias_semana
                .map((item) =>
                    String(item || '')
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean);
        }
    } else if (typeof row.dias_semana === 'string' && row.dias_semana) {
        try {
            const parsed = JSON.parse(row.dias_semana);
            if (
                Array.isArray(parsed) &&
                parsed.some((item) => item && typeof item === 'object')
            ) {
                sessoes = normalizeServiceSessions({ sessoes: parsed });
                diasSemana = sessoes.map((item) => item.dia);
            } else {
                diasSemana = Array.isArray(parsed)
                    ? parsed
                          .map((item) =>
                              String(item || '')
                                  .trim()
                                  .toLowerCase()
                          )
                          .filter(Boolean)
                    : [];
            }
        } catch {
            diasSemana = row.dias_semana
                .split(',')
                .map((item) =>
                    String(item || '')
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean);
        }
    }

    return {
        id: row.id_servico,
        periodicidade: periodicidadeLabel,
        tipoServico: tipoLabel,
        modalidade: row.modalidade,
        professor: row.professor,
        nivelEnsino: formatNivelEnsino(row.nivel_ensino),
        area: row.area,
        areaId: row.area_id == null ? '' : String(row.area_id),
        nAlunos: row.n_alunos,
        tipoServicoId: row.id_tiposervico ? String(row.id_tiposervico) : '',
        modalidadeId: row.id_modalidade ? String(row.id_modalidade) : '',
        nivelEnsinoId: row.nivel_ensino == null ? '' : String(row.nivel_ensino),
        disciplinaId: row.id_disciplina ? String(row.id_disciplina) : '',
        professorId: row.id_professor ? String(row.id_professor) : '',
        salaId: row.id_sala ? String(row.id_sala) : '',
        dataInicio,
        horaInicio,
        duracao: String(getDurationMinutes(horaInicio, horaFim)),
        diasSemana,
        sessoes,
        alunosIds: Array.isArray(row.alunos_ids)
            ? row.alunos_ids
                  .map(Number)
                  .filter((id) => Number.isInteger(id) && id > 0)
            : [],
    };
}

export function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function resolveIsPeriodic(serviceType, periodicidade, diasSemana) {
    const normalizedServiceType = normalizeText(serviceType);
    const normalizedPeriodicidade = normalizeText(periodicidade);

    if (
        normalizedServiceType === 'periodico' ||
        normalizedPeriodicidade === 'periodico'
    ) {
        return true;
    }

    if (
        normalizedServiceType === 'unico' ||
        normalizedPeriodicidade === 'unico'
    ) {
        return false;
    }

    return Array.isArray(diasSemana) && diasSemana.length > 1;
}

export async function resolveTipoServicoId(
    client,
    explicitId,
    tipoServicoLabel,
    tipoCanonical,
    contexto = ''
) {
    const explicitNumeric = Number(explicitId);
    if (Number.isInteger(explicitNumeric) && explicitNumeric > 0) {
        return explicitNumeric;
    }

    // Query diferentes tabelas dependendo do contexto
    const isExtraCurricular =
        contexto === 'extra' || contexto === 'extra-curricular';
    const tableName = isExtraCurricular
        ? 'tipo_servico_extracurricular'
        : 'tipo_servico';
    const idColumnName = isExtraCurricular
        ? 'id_tipo_servico_extra'
        : 'id_tiposervico';

    const { rows } = await client.query(
        `
			SELECT ${idColumnName}, nome
			FROM ${tableName}
			WHERE COALESCE(ativo, true) = true
			ORDER BY ${idColumnName}
		`
    );

    const searchKeys = new Set([
        normalizeText(tipoServicoLabel),
        normalizeText(tipoCanonical),
    ]);
    console.debug('[resolveTipoServicoId]', {
        tableName,
        idColumnName,
        contexto,
        tipoServicoLabel,
        tipoCanonical,
        searchKeys: Array.from(searchKeys),
        rowsFound: rows.length,
        rows: rows.map((r) => ({
            [idColumnName]: r[idColumnName],
            nome: r.nome,
        })),
    });

    for (const row of rows) {
        const nomeNormalized = normalizeText(row.nome);
        if (!nomeNormalized) {
            continue;
        }

        if (searchKeys.has(nomeNormalized)) {
            console.debug(
                '[resolveTipoServicoId] MATCH - exact searchKeys:',
                nomeNormalized
            );
            return Number(row[idColumnName]);
        }

        if (nomeNormalized.includes('period') && searchKeys.has('periodico')) {
            console.debug(
                '[resolveTipoServicoId] MATCH - period + periodico:',
                nomeNormalized
            );
            return Number(row[idColumnName]);
        }

        if (
            (nomeNormalized.includes('unico') ||
                nomeNormalized.includes('unica')) &&
            searchKeys.has('unico')
        ) {
            console.debug(
                '[resolveTipoServicoId] MATCH - unico:',
                nomeNormalized
            );
            return Number(row[idColumnName]);
        }

        if (
            normalizeText(contexto) === 'curricular' &&
            nomeNormalized.includes('curricular')
        ) {
            console.debug(
                '[resolveTipoServicoId] MATCH - curricular contexto:',
                nomeNormalized
            );
            return Number(row[idColumnName]);
        }
    }

    if (rows.length === 1) {
        console.debug(
            '[resolveTipoServicoId] MATCH - only 1 row available:',
            rows[0].nome
        );
        return Number(rows[0][idColumnName]);
    }

    console.debug('[resolveTipoServicoId] NO MATCH - returning null');
    return null;
}

/**
 * Resolve pacote de preço para uma combinação de disciplina + modalidade
 * Tenta encontrar match exato; se não existir, usa pacote fallback
 *
 * @param {Object} client - Cliente de pool de conexões BD
 * @param {number} disciplinaId - ID da disciplina
 * @param {number} modalidadeId - ID da modalidade
 * @returns {Object|null} Objecto com {id_pacote, preco}
 */
export async function resolvePacote(client, disciplinaId, modalidadeId) {
    const byMatch = await client.query(
        `
			SELECT id_pacote, preco
			FROM pacotes
			WHERE COALESCE(ativo, true) = true
			  AND id_disciplina = $1
			  AND id_modalidade = $2
			ORDER BY id_pacote
			LIMIT 1
		`,
        [disciplinaId, modalidadeId]
    );

    if (byMatch.rows.length) {
        return byMatch.rows[0];
    }

    const fallback = await client.query(
        `
			SELECT id_pacote, preco
			FROM pacotes
			WHERE COALESCE(ativo, true) = true
			ORDER BY id_pacote
			LIMIT 1
		`
    );

    return fallback.rows[0] || null;
}

export async function resolveInscricoesServicoColumn(client) {
    const { rows } = await client.query(
        `
			SELECT column_name
			FROM information_schema.columns
			WHERE table_name = 'inscricoes'
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

export async function carregarAlunosIdsServico(client, idServico) {
    const inscricoesServicoColumn =
        await resolveInscricoesServicoColumn(client);
    if (!inscricoesServicoColumn) {
        return [];
    }

    const { rows } = await client.query(
        `
			SELECT DISTINCT id_aluno
			FROM inscricoes
			WHERE ${inscricoesServicoColumn} = $1
			  AND LOWER(COALESCE(estado, 'ativa')) = 'ativa'
			ORDER BY id_aluno
		`,
        [idServico]
    );

    return rows
        .map((row) => Number(row.id_aluno))
        .filter((id) => Number.isInteger(id) && id > 0);
}

export async function inserirInscricoesServicoCurricular(
    client,
    idServico,
    alunosIds,
    disciplinaId,
    modalidadeId
) {
    const selectedAlunos = Array.from(
        new Set(
            (Array.isArray(alunosIds) ? alunosIds : [])
                .map(Number)
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );

    if (!selectedAlunos.length) {
        return;
    }

    const pacote = await resolvePacote(
        client,
        Number(disciplinaId),
        Number(modalidadeId)
    );
    if (!pacote) {
        const error = new Error(
            'Não existe nenhum pacote ativo configurado para associar alunos a este serviço. Contacte o administrador para criar um pacote para esta disciplina/modalidade.'
        );
        error.code = 'PACOTE_NAO_ENCONTRADO';
        error.statusCode = 400;
        throw error;
    }

    const inscricoesServicoColumn =
        await resolveInscricoesServicoColumn(client);
    if (!inscricoesServicoColumn) {
        const error = new Error(
            'Tabela inscricoes sem coluna de ligação ao serviço curricular.'
        );
        error.code = 'INSCRICOES_COLUNA_EM_FALTA';
        error.statusCode = 500;
        throw error;
    }

    const insertInscricaoQuery = `
		INSERT INTO inscricoes (
			id_aluno,
			${inscricoesServicoColumn},
			id_pacote,
			data_inscricao,
			estado,
			valor_final
		)
		SELECT
			$1::int,
			$2::int,
			$3::int,
			CURRENT_DATE,
			'ativa',
			$4::numeric
		WHERE NOT EXISTS (
			SELECT 1
			FROM inscricoes i
			WHERE i.id_aluno = $1::int
			  AND i.${inscricoesServicoColumn} = $2::int
		)
	`;

    for (const alunoId of selectedAlunos) {
        await client.query(insertInscricaoQuery, [
            alunoId,
            idServico,
            pacote.id_pacote,
            pacote.preco,
        ]);
    }
}

export async function sincronizarInscricoesServicoCurricular(
    client,
    idServico,
    alunosIds,
    disciplinaId,
    modalidadeId
) {
    const selectedAlunos = Array.from(
        new Set(
            (Array.isArray(alunosIds) ? alunosIds : [])
                .map(Number)
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );
    const inscricoesServicoColumn =
        await resolveInscricoesServicoColumn(client);
    if (!inscricoesServicoColumn) {
        return;
    }

    if (selectedAlunos.length) {
        await client.query(
            `
				UPDATE inscricoes
				SET estado = 'cancelada'
				WHERE ${inscricoesServicoColumn} = $1
				  AND LOWER(COALESCE(estado, 'ativa')) = 'ativa'
				  AND NOT (id_aluno = ANY($2::int[]))
			`,
            [idServico, selectedAlunos]
        );
    } else {
        await client.query(
            `
				UPDATE inscricoes
				SET estado = 'cancelada'
				WHERE ${inscricoesServicoColumn} = $1
				  AND LOWER(COALESCE(estado, 'ativa')) = 'ativa'
			`,
            [idServico]
        );
    }

    await inserirInscricoesServicoCurricular(
        client,
        idServico,
        selectedAlunos,
        disciplinaId,
        modalidadeId
    );
}

export async function carregarDetalheServicoCurricular(client, idServico) {
    const inscricoesServicoColumn =
        await resolveInscricoesServicoColumn(client);
    const alunosIdsSelect = inscricoesServicoColumn
        ? `
			COALESCE(
				(
					SELECT json_agg(DISTINCT i.id_aluno ORDER BY i.id_aluno)
					FROM inscricoes i
					WHERE i.${inscricoesServicoColumn} = s.id_servico
					  AND LOWER(COALESCE(i.estado, 'ativa')) = 'ativa'
				),
				'[]'::json
			) AS alunos_ids
		`
        : `'[]'::json AS alunos_ids`;

    const query = `
		SELECT
			s.id_servico,
			s.id_tiposervico,
			s.id_modalidade,
			s.id_disciplina,
			s.id_professor,
			s.id_sala,
			s.data_inicio,
			s.hora_inicio,
			s.hora_fim,
			s.dias_semana,
			s.tipo AS tipo_canonical,
			CASE
				WHEN s.data_fim IS NOT NULL AND s.data_fim > s.data_inicio THEN 'Periódico'
				ELSE 'Único'
			END AS periodicidade,
			COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço') AS tipo_servico,
			COALESCE(m.nome, 'Sem modalidade') AS modalidade,
			d.id_nivel AS nivel_ensino,
			COALESCE(d.nome, 'Sem disciplina') AS area,
			COALESCE(s.capacidade_max, 0)::int AS n_alunos,
			${alunosIdsSelect}
		FROM servicos_curriculares s
		LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
		LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
		LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
		WHERE s.id_servico = $1
		LIMIT 1
	`;

    const { rows } = await client.query(query, [idServico]);
    return rows[0] || null;
}

/**
 * Lista todos os serviços curriculares ativos com informações de modalidade e nível
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Array de serviços mapeados para formato DTO
 */
/**
 * Lista todas as opções disponíveis para criação de novo serviço
 * Retorna: tipos, modalidades, disciplinas, níveis, professores, salas, alunos
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Objecto com arrays de todas as opções de filtro
 */
/**
 * Cria novo serviço curricular com professores, alunos e horário
 * Executa como transação: insere serviço, alunos inscritos e entradas de agenda
 *
 * @param {Object} req - Objecto com body contendo {tipoServico, modalidadeId, disciplinaId, professorId, salaId, dataInicio, horaInicio, duracao, alunosIds, diasSemana}
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Serviço criado com seus dados ou erro 400/500
 */
export async function atualizarServicoBase(
    req,
    res,
    tableName,
    contextoLabel,
    entidadeLog
) {
    const client = await db.connect();
    let emailContext = null;

    try {
        const idServico = Number(req.params?.id);
        if (!Number.isInteger(idServico) || idServico <= 0) {
            return res.status(400).json({ message: 'ID de serviço inválido.' });
        }

        const {
            tipoServico,
            idTipoServico,
            id_tiposervico,
            tipoServicoId,
            serviceType,
            periodicidade,
            modalidadeId,
            disciplinaId,
            areaId,
            professorId,
            salaId,
            dataInicio,
            dataFim,
            horaInicio,
            duracao,
            diasSemana,
            sessoes,
        } = req.body || {};

        const isExtra = tableName === 'servicos_extracurriculares';
        const hasArea = Boolean(String(areaId ?? '').trim());

        if (
            !tipoServico ||
            !modalidadeId ||
            (!isExtra ? !disciplinaId : !hasArea) ||
            !professorId ||
            !salaId ||
            !dataInicio ||
            (!Array.isArray(sessoes) && (!horaInicio || !duracao))
        ) {
            return res.status(400).json({
                message: `Preencha todos os campos obrigatórios para atualizar o serviço ${contextoLabel}.`,
            });
        }

        const schedule = getPrimarySchedule({
            sessoes,
            diasSemana,
            horaInicio,
            duracao,
        });
        const horaFim = schedule.horaFim;
        if (!horaFim) {
            return res
                .status(400)
                .json({ message: 'Hora de início ou duração inválida.' });
        }

        const anoLetivo = getAnoLetivo(dataInicio);
        const normalizedTipo = String(tipoServico || '')
            .trim()
            .toLowerCase();
        const isPeriodic = resolveIsPeriodic(
            serviceType,
            periodicidade,
            schedule.sessoes.length ? schedule.sessoes : diasSemana
        );
        const tipoDb =
            normalizedTipo === 'periodico' || normalizedTipo === 'unico'
                ? normalizedTipo
                : isPeriodic
                  ? 'periodico'
                  : 'unico';

        const diasSemanaJson = schedule.diasSemanaJson;

        // tipoServico resolution will be done after detecting which column the
        // servicos_extracurriculares table uses and which tipo table it references (if extra).

        const calculatedDataFim = isExtra
            ? // Extra-curricular: usar dataFim fornecido ou 31 Agosto
              dataFim || getDataFimAnoLetivo(dataInicio)
            : // Curricular: calcular baseado no tipo
              isPeriodic
              ? getDataFimAnoLetivo(dataInicio)
              : dataInicio;

        // ==================== VALIDAÇÕES DE CONFLITOS ====================

        // Validar sobreposição de professor (excluindo o serviço atual)
        const professorCheck = await verificarSobrepoisaoProfessor(
            Number(professorId),
            dataInicio,
            calculatedDataFim,
            schedule.horaInicio,
            horaFim,
            diasSemanaJson,
            idServico // Excluir este serviço da validação
        );
        if (professorCheck.hasConflict) {
            return res.status(409).json({
                code: 'PROFESSOR_CONFLICT',
                message: `Professor possui conflito de horário com ${professorCheck.conflicts.length} aula(s) existente(s).`,
                conflicts: professorCheck.conflicts,
            });
        }

        // ================== FIM VALIDAÇÕES DE CONFLITOS ==================

        await client.query('BEGIN');
        await ensureDiasSemanaColumn(client, tableName);

        if (isExtra) {
            await ensureAreaColumn(client, tableName);
        }

        const extraAreaMetadata = isExtra
            ? await resolveExtraAreaMetadata(client)
            : null;
        const tipoInfo = isExtra
            ? // For extra-curricular services, always use id_tipo_servico_extra
              {
                  column: 'id_tipo_servico_extra',
                  refTable: 'tipo_servico_extracurricular',
              }
            : null;
        if (isExtra)
            console.info('[servicos] atualizar - detected tipoInfo:', tipoInfo);

        let tipoServicoResolvedId = null;
        if (isExtra) {
            // For extra-curricular services, always search in tipo_servico_extracurricular
            // regardless of which FK was detected
            const resolveContext = 'extra';
            tipoServicoResolvedId = await resolveTipoServicoId(
                client,
                idTipoServico ?? id_tiposervico ?? tipoServicoId,
                tipoServico,
                tipoDb,
                resolveContext
            );
            console.info(
                '[servicos] atualizar - resolveContext:',
                resolveContext,
                'resolvedId:',
                tipoServicoResolvedId
            );

            if (
                !Number.isInteger(tipoServicoResolvedId) ||
                tipoServicoResolvedId <= 0
            ) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message:
                        'Tipo de serviço inválido. Selecione um tipo de serviço válido.',
                });
            }
        } else {
            tipoServicoResolvedId = await resolveTipoServicoId(
                client,
                idTipoServico ?? id_tiposervico ?? tipoServicoId,
                tipoServico,
                tipoDb,
                contextoLabel
            );

            if (
                !Number.isInteger(tipoServicoResolvedId) ||
                tipoServicoResolvedId <= 0
            ) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message:
                        'Tipo de serviço inválido. Selecione um tipo de serviço válido.',
                });
            }
        }

        const { rows: oldRows } = await client.query(
            `
				SELECT *
				FROM ${tableName}
				WHERE id_servico = $1
				LIMIT 1
			`,
            [idServico]
        );

        if (!oldRows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        const updateValues = isExtra
            ? [
                  Number(professorId),
                  Number(modalidadeId),
                  tipoServicoResolvedId,
                  Number(salaId),
                  tipoDb,
                  anoLetivo,
                  dataInicio,
                  calculatedDataFim,
                  schedule.horaInicio,
                  horaFim,
              ]
            : [
                  Number(professorId),
                  Number(disciplinaId),
                  Number(modalidadeId),
                  tipoServicoResolvedId,
                  Number(salaId),
                  tipoDb,
                  anoLetivo,
                  dataInicio,
                  calculatedDataFim,
                  schedule.horaInicio,
                  horaFim,
              ];

        const updateQuery = isExtra
            ? (() => {
                  const extraAreaColumn =
                      extraAreaMetadata?.serviceAreaColumn ||
                      extraAreaMetadata?.serviceAreaTextColumn ||
                      null;
                  const extraAreaValue = extraAreaMetadata?.serviceAreaColumn
                      ? Number.isFinite(Number(areaId))
                          ? Number(areaId)
                          : null
                      : String(areaId ?? '').trim();
                  const updateSet = [
                      'id_professor = $1',
                      'id_modalidade = $2',
                      `${tipoInfo.column} = $3`,
                      'id_sala = $4',
                      'tipo = $5',
                      'ano_letivo = $6',
                      'data_inicio = $7',
                      'data_fim = $8',
                      'hora_inicio = $9',
                      'hora_fim = $10',
                  ];

                  if (extraAreaColumn) {
                      updateSet.push(`${extraAreaColumn} = $11`);
                      updateValues.push(extraAreaValue);
                  }

                  updateSet.push(`dias_semana = $${updateValues.length + 1}`);
                  updateValues.push(diasSemanaJson, idServico);

                  return `
			UPDATE ${tableName}
			SET
				${updateSet.join(',\n\t\t\t\t')}
			WHERE id_servico = $${updateValues.length}
			RETURNING id_servico
		`;
              })()
            : `
			UPDATE ${tableName}
			SET
				id_professor = $1,
				id_disciplina = $2,
				id_modalidade = $3,
				id_tiposervico = $4,
				id_sala = $5,
				tipo = $6,
				ano_letivo = $7,
				data_inicio = $8,
				data_fim = $9,
				hora_inicio = $10,
				hora_fim = $11,
				dias_semana = $12
			WHERE id_servico = $13
			RETURNING id_servico
		`;

        if (!isExtra) {
            updateValues.push(diasSemanaJson, idServico);
        }

        const { rows: updatedRows } = await client.query(
            updateQuery,
            updateValues
        );
        if (!updatedRows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        const detailsQuery = isExtra
            ? (() => {
                  const extraAreaJoin =
                      extraAreaMetadata?.serviceAreaColumn &&
                      extraAreaMetadata?.areaTableExists
                          ? `LEFT JOIN areas_extracurriculares a ON a.${extraAreaMetadata.areaIdColumn} = s.${extraAreaMetadata.serviceAreaColumn}`
                          : extraAreaMetadata?.areaTableExists &&
                              extraAreaMetadata?.serviceAreaTextColumn &&
                              extraAreaMetadata?.areaNomeColumn
                            ? `LEFT JOIN areas_extracurriculares a ON LOWER(a.${extraAreaMetadata.areaNomeColumn}) = LOWER(COALESCE(s.${extraAreaMetadata.serviceAreaTextColumn}, ''))`
                            : '';
                  const extraAreaNameSelect =
                      extraAreaMetadata?.areaTableExists &&
                      extraAreaMetadata?.areaNomeColumn
                          ? `COALESCE(NULLIF(a.${extraAreaMetadata.areaNomeColumn}, ''), 'Sem área') AS area`
                          : extraAreaMetadata?.serviceAreaTextColumn
                            ? `COALESCE(NULLIF(s.${extraAreaMetadata.serviceAreaTextColumn}, ''), 'Sem área') AS area`
                            : `NULL::text AS area`;
                  const extraAreaLevelSelect =
                      extraAreaMetadata?.areaTableExists &&
                      extraAreaMetadata?.areaNivelColumn
                          ? `a.${extraAreaMetadata.areaNivelColumn} AS nivel_ensino`
                          : `NULL::int AS nivel_ensino`;

                  return `
			SELECT
				s.id_servico,
				s.id_tiposervico,
				s.id_modalidade,
                s.id_professor,
                s.id_sala,
                s.data_inicio,
                s.hora_inicio,
                s.hora_fim,
                s.dias_semana,
                s.tipo AS tipo_canonical,
                CASE
                    WHEN s.data_fim IS NOT NULL AND s.data_fim > s.data_inicio THEN 'Periódico'
                    ELSE 'Único'
                END AS periodicidade,
                COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço') AS tipo_servico,
                COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Sem professor') AS professor,
                ${extraAreaLevelSelect},
                ${extraAreaNameSelect},
                COALESCE(s.capacidade_max, 0)::int AS n_alunos
            FROM ${tableName} s
            LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
            LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
            LEFT JOIN professores p ON p.id_professor = s.id_professor
            LEFT JOIN users u ON u.id_user = p.id_user
            LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
            ${extraAreaJoin}
			WHERE s.id_servico = $1
			LIMIT 1
		`;
              })()
            : `
			SELECT
				s.id_servico,
				s.id_tiposervico,
				s.id_modalidade,
				s.id_disciplina,
				s.id_professor,
				s.id_sala,
				s.data_inicio,
				s.hora_inicio,
				s.hora_fim,
				s.dias_semana,
                s.tipo AS tipo_canonical,
				CASE
					WHEN s.data_fim IS NOT NULL AND s.data_fim > s.data_inicio THEN 'Periódico'
					ELSE 'Único'
				END AS periodicidade,
				COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço') AS tipo_servico,
				COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Sem professor') AS professor,
				d.id_nivel AS nivel_ensino,
				COALESCE(d.nome, 'Sem disciplina') AS area,
				COALESCE(s.capacidade_max, 0)::int AS n_alunos
			FROM ${tableName} s
			LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
			LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
			LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN professores p ON p.id_professor = s.id_professor
            LEFT JOIN users u ON u.id_user = p.id_user
            LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
			WHERE s.id_servico = $1
			LIMIT 1
		`;

        const { rows } = await client.query(detailsQuery, [idServico]);

        if (
            tableName === 'servicos_curriculares' &&
            rows[0] &&
            hasScheduleChanged(oldRows[0], rows[0])
        ) {
            const salaAnterior = await resolveSalaNomeById(
                client,
                oldRows[0]?.id_sala
            );
            const salaNova = await resolveSalaNomeById(
                client,
                rows[0]?.id_sala
            );
            const destinatarios =
                await carregarDestinatariosReagendamentoCurricular(
                    client,
                    idServico
                );

            emailContext = {
                destinatarios,
                tituloSessao: `${rows[0]?.area || 'Sessão'}${rows[0]?.modalidade ? ` - ${rows[0].modalidade}` : ''}`,
                dataAnterior: formatDatePt(oldRows[0]?.data_inicio),
                horaAnterior: `${normalizeTimeLabel(oldRows[0]?.hora_inicio) || '--:--'} - ${normalizeTimeLabel(oldRows[0]?.hora_fim) || '--:--'}`,
                salaAnterior,
                dataNova: formatDatePt(rows[0]?.data_inicio),
                horaNova: `${normalizeTimeLabel(rows[0]?.hora_inicio) || '--:--'} - ${normalizeTimeLabel(rows[0]?.hora_fim) || '--:--'}`,
                salaNova,
                motivo: String(req.body?.motivoReagendamento || '').trim(),
            };
        }

        await client.query('COMMIT');

        await registarUpdate(
            req.userId ?? null,
            entidadeLog,
            idServico,
            oldRows[0],
            rows[0]
        );

        const mapped = mapServicoRow(rows[0]);
        mapped.nivelEnsino = formatNivelEnsino(rows[0]?.nivel_ensino);

        if (emailContext) {
            try {
                await enviarNotificacoesReagendamento(emailContext);
            } catch (emailError) {
                console.error(
                    'Erro ao enviar notificações de reagendamento:',
                    emailError?.message || emailError
                );
            }
        }

        return res.status(200).json({ servico: mapped });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }
        console.error(
            `Erro ao atualizar serviço ${contextoLabel}:`,
            error.message
        );
        return res
            .status(500)
            .json({ message: `Erro ao atualizar serviço ${contextoLabel}.` });
    } finally {
        client.release();
    }
}

export async function eliminarServicoBase(
    req,
    res,
    tableName,
    contextoLabel,
    entidadeLog
) {
    try {
        const idServico = Number(req.params?.id);
        if (!Number.isInteger(idServico) || idServico <= 0) {
            return res.status(400).json({ message: 'ID de serviço inválido.' });
        }

        const { rows: oldRows } = await db.query(
            `
				SELECT *
				FROM ${tableName}
				WHERE id_servico = $1
				LIMIT 1
			`,
            [idServico]
        );

        if (!oldRows.length) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        const { rows: colRows } = await db.query(
            `
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = $1
				  AND column_name = 'ativo'
				LIMIT 1
			`,
            [tableName]
        );

        const hasAtivo = colRows.length > 0;
        const query = hasAtivo
            ? `
				UPDATE ${tableName}
				SET ativo = false
				WHERE id_servico = $1
				RETURNING id_servico
			`
            : `
				DELETE FROM ${tableName}
				WHERE id_servico = $1
				RETURNING id_servico
			`;

        const { rows } = await db.query(query, [idServico]);
        if (!rows.length) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        await registarDelete(
            req.userId ?? null,
            entidadeLog,
            idServico,
            oldRows[0]
        );

        return res.status(200).json({
            message: `Serviço ${contextoLabel} removido com sucesso.`,
            id: rows[0].id_servico,
        });
    } catch (error) {
        console.error(
            `Erro ao remover serviço ${contextoLabel}:`,
            error.message
        );
        return res
            .status(500)
            .json({ message: `Erro ao remover serviço ${contextoLabel}.` });
    }
}

/**
 * Lista opções para criação de serviço extra-curricular
 * (tipos, modalidades, áreas, níveis, professores, salas)
 */
