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
import {
    ensureDiasSemanaColumn,
    ensureServiceVersionColumns,
    verificarConflitoSalaDatabase,
    ensureAreaColumn,
    getTableColumns,
    pickFirstColumn,
    pickLikelyIdColumn,
    pickLikelyNameColumn,
    pickLikelyActiveColumn,
    resolveExtraAreaMetadata,
    resolveTipoServicoColumn,
    formatNivelEnsino,
    addMinutesToTime,
    getDurationMinutes,
    normalizeDateKey,
    isISODateKey,
    addDaysToDateKey,
    todayDateKey,
    parseDiasSemanaValue,
    normalizeTimeLabel,
    hasScheduleChanged,
    formatDatePt,
    resolveSalaNomeById,
    carregarDestinatariosReagendamentoCurricular,
    enviarNotificacoesReagendamento,
    getAnoLetivo,
    getDataFimAnoLetivo,
    mapServicoRow,
    normalizeText,
    resolveIsPeriodic,
    resolveTipoServicoId,
    resolvePacote,
    resolveInscricoesServicoColumn,
    carregarAlunosIdsServico,
    inserirInscricoesServicoCurricular,
    sincronizarInscricoesServicoCurricular,
    carregarDetalheServicoCurricular,
    atualizarServicoBase,
    eliminarServicoBase,
    NIVEL_LABELS,
} from './servicosController.js';

/**
 * SERVICOS EXTRA-CURRICULARES CONTROLLER
 * Controller focado nas rotas deste tipo de servico.
 */

export async function listarServicosExtraCurriculares(req, res) {
    try {
        const tableCheck = await db.query(
            `
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = 'public'
				  AND table_name = 'servicos_extracurriculares'
				LIMIT 1
			`
        );

        if (!tableCheck.rows.length) {
            return res.status(200).json({ servicos: [] });
        }

        const extraAreaMetadata = await resolveExtraAreaMetadata(db);
        const tipoInfo = await resolveTipoServicoColumn(db);
        const serviceAreaColumn = extraAreaMetadata.serviceAreaColumn;
        const serviceAreaTextColumn = extraAreaMetadata.serviceAreaTextColumn;
        const areaIdColumn = extraAreaMetadata.areaIdColumn;
        const areaNomeColumn = extraAreaMetadata.areaNomeColumn;
        const areaNivelColumn = extraAreaMetadata.areaNivelColumn;
        const areaJoin =
            serviceAreaColumn && areaIdColumn
                ? `LEFT JOIN areas_extracurriculares a ON a.${areaIdColumn} = s.${serviceAreaColumn}`
                : extraAreaMetadata.areaTableExists &&
                    serviceAreaTextColumn &&
                    areaNomeColumn
                  ? `LEFT JOIN areas_extracurriculares a ON LOWER(a.${areaNomeColumn}) = LOWER(COALESCE(s.${serviceAreaTextColumn}, ''))`
                  : '';
        const areaIdSelect = serviceAreaColumn
            ? `s.${serviceAreaColumn} AS area_id,`
            : `NULL::text AS area_id,`;
        const areaLevelSelect =
            extraAreaMetadata.areaTableExists && areaNivelColumn
                ? `a.${areaNivelColumn} AS nivel_ensino`
                : `NULL::int AS nivel_ensino`;
        const areaNameSelect =
            extraAreaMetadata.areaTableExists && areaNomeColumn
                ? `COALESCE(NULLIF(a.${areaNomeColumn}, ''), 'Sem área') AS area`
                : serviceAreaTextColumn
                  ? `COALESCE(NULLIF(s.${serviceAreaTextColumn}, ''), 'Sem área') AS area`
                  : `NULL::text AS area`;

        const tipoNomeSelect =
            tipoInfo.refTable === 'tipo_servico_extracurricular'
                ? `COALESCE(NULLIF(tse.nome, ''), NULLIF(s.tipo, ''), 'Serviço Extra')`
                : `COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço Extra')`;

        const query = `
            SELECT
                s.id_servico,
                s.${tipoInfo.column} AS id_tiposervico,
				s.id_modalidade,
                ${areaIdSelect}
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
                ${tipoNomeSelect} AS tipo_servico,
				COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                ${areaLevelSelect},
                ${areaNameSelect},
				COALESCE(s.capacidade_max, 0)::int AS n_alunos
            FROM servicos_extracurriculares s
            ${
                tipoInfo.refTable === 'tipo_servico_extracurricular'
                    ? `LEFT JOIN tipo_servico_extracurricular tse ON tse.id_tipo_servico_extra = s.${tipoInfo.column}`
                    : `LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.${tipoInfo.column}`
            }
			LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
            ${areaJoin}
			WHERE COALESCE(s.ativo, true) = true
			ORDER BY s.created_at DESC, s.id_servico DESC
		`;

        const { rows } = await db.query(query);
        return res.status(200).json({ servicos: rows.map(mapServicoRow) });
    } catch (error) {
        console.error(
            'Erro ao listar serviços extra-curriculares:',
            error.message
        );
        return res
            .status(500)
            .json({ message: 'Erro ao carregar serviços extra-curriculares.' });
    }
}



export async function criarServicoExtraCurricular(req, res) {
    const client = await db.connect();
    try {
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
        } = req.body || {};

        if (
            !tipoServico ||
            !modalidadeId ||
            (!disciplinaId && !areaId) ||
            !professorId ||
            !salaId ||
            !dataInicio ||
            !horaInicio ||
            !duracao
        ) {
            return res.status(400).json({
                message:
                    'Preencha todos os campos obrigatórios para criar o serviço extra-curricular.',
            });
        }

        const horaFim = addMinutesToTime(horaInicio, Number(duracao));
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
            diasSemana
        );
        const tipoDb =
            normalizedTipo === 'periodico' || normalizedTipo === 'unico'
                ? normalizedTipo
                : isPeriodic
                  ? 'periodico'
                  : 'unico';

        // tipoServico resolution will be done after detecting which column the
        // servicos_extracurriculares table uses and which tipo table it references.

        // Para extra-curriculares: se dataFim não fornecida, usar 31 Agosto
        // Se fornecida, usar a data do utilizador
        let calculatedDataFim = dataFim;
        if (!calculatedDataFim) {
            calculatedDataFim = getDataFimAnoLetivo(dataInicio);
        }

        // ==================== VALIDAÇÕES DE CONFLITOS ====================

        const diasSemanaJson = Array.isArray(diasSemana)
            ? JSON.stringify(diasSemana)
            : null;

        // Validar área de formação do professor nos serviços extra-curriculares
        if (areaId) {
            const areaCheck = await verificarAreaFormacao(
                Number(professorId),
                Number(areaId)
            );
            if (!areaCheck.canTeach) {
                return res.status(400).json({
                    code: 'PROFESSOR_AREA_MISMATCH',
                    message: areaCheck.message,
                    details: {
                        professorArea: areaCheck.professorArea,
                        disciplinaArea: areaCheck.disciplinaArea,
                    },
                });
            }
        }

        // Validar sobreposição de professor
        const professorCheck = await verificarSobrepoisaoProfessor(
            Number(professorId),
            dataInicio,
            calculatedDataFim,
            horaInicio,
            horaFim,
            diasSemanaJson,
            null
        );
        if (professorCheck.hasConflict) {
            return res.status(409).json({
                code: 'PROFESSOR_CONFLICT',
                message:
                    'Professor possui conflito de horário com atividade(s) existente(s).',
                conflicts: professorCheck.conflicts,
            });
        }

        // ================== FIM VALIDAÇÕES DE CONFLITOS ==================

        const extraAreaMetadata = await resolveExtraAreaMetadata(client);
        // For extra-curricular services, always use id_tipo_servico_extra
        // (don't rely on FK detection which might return curricular column)
        const tipoInfo = {
            column: 'id_tipo_servico_extra',
            refTable: 'tipo_servico_extracurricular',
        };
        console.info('[servicos] criarExtra - detected tipoInfo:', tipoInfo);

        // For extra-curricular services, always search in tipo_servico_extracurricular
        // regardless of which FK was detected, since that's the correct table for extras
        const resolveContext = 'extra';
        const tipoServicoResolvedId = await resolveTipoServicoId(
            client,
            idTipoServico ?? id_tiposervico ?? tipoServicoId,
            tipoServico,
            tipoDb,
            resolveContext
        );
        console.info(
            '[servicos] criarExtra - resolveContext:',
            resolveContext,
            'resolvedId:',
            tipoServicoResolvedId
        );

        if (
            !Number.isInteger(tipoServicoResolvedId) ||
            tipoServicoResolvedId <= 0
        ) {
            return res.status(400).json({
                message:
                    'Tipo de serviço inválido. Selecione um tipo de serviço válido.',
            });
        }
        const areaValue = String(areaId ?? disciplinaId ?? '').trim();
        const serviceAreaColumn = extraAreaMetadata.serviceAreaColumn;
        const serviceAreaTextColumn = extraAreaMetadata.serviceAreaTextColumn;
        const persistedAreaValue = serviceAreaColumn
            ? Number.isFinite(Number(areaValue))
                ? Number(areaValue)
                : null
            : areaValue;

        const insertColumns = [
            'id_professor',
            'id_modalidade',
            tipoInfo.column,
            'id_sala',
            'tipo',
            'ano_letivo',
            'data_inicio',
            'data_fim',
            'hora_inicio',
            'hora_fim',
            'capacidade_max',
            'dias_semana',
        ];

        const insertValues = [
            Number(professorId),
            Number(modalidadeId),
            tipoServicoResolvedId,
            Number(salaId),
            tipoDb,
            anoLetivo,
            dataInicio,
            calculatedDataFim,
            horaInicio,
            horaFim,
            1,
            diasSemanaJson,
        ];

        if (serviceAreaColumn) {
            insertColumns.splice(4, 0, serviceAreaColumn);
            insertValues.splice(4, 0, persistedAreaValue);
        } else if (serviceAreaTextColumn) {
            insertColumns.splice(4, 0, serviceAreaTextColumn);
            insertValues.splice(4, 0, areaValue);
        }

        const insertQuery = `
			INSERT INTO servicos_extracurriculares (${insertColumns.join(', ')}, ativo)
			VALUES (${insertValues.map((_, index) => `$${index + 1}`).join(', ')}, true)
			RETURNING id_servico
		`;

        await client.query('BEGIN');
        const { rows: insertedRows } = await client.query(
            insertQuery,
            insertValues
        );
        const idServico = insertedRows[0]?.id_servico;

        const tipoNomeSelect =
            tipoInfo.refTable === 'tipo_servico_extracurricular'
                ? `COALESCE(NULLIF(tse.nome, ''), NULLIF(s.tipo, ''), 'Serviço Extra')`
                : `COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço Extra')`;

        const detailsAreaJoin =
            serviceAreaColumn && extraAreaMetadata.areaTableExists
                ? `LEFT JOIN areas_extracurriculares a ON a.${extraAreaMetadata.areaIdColumn} = s.${serviceAreaColumn}`
                : extraAreaMetadata.areaTableExists &&
                    serviceAreaTextColumn &&
                    extraAreaMetadata.areaNomeColumn
                  ? `LEFT JOIN areas_extracurriculares a ON LOWER(a.${extraAreaMetadata.areaNomeColumn}) = LOWER(COALESCE(s.${serviceAreaTextColumn}, ''))`
                  : '';
        const detailsAreaNameSelect =
            extraAreaMetadata.areaTableExists &&
            extraAreaMetadata.areaNomeColumn
                ? `COALESCE(NULLIF(a.${extraAreaMetadata.areaNomeColumn}, ''), 'Sem área') AS area`
                : serviceAreaTextColumn
                  ? `COALESCE(NULLIF(s.${serviceAreaTextColumn}, ''), 'Sem área') AS area`
                  : `NULL::text AS area`;
        const detailsAreaLevelSelect =
            extraAreaMetadata.areaTableExists &&
            extraAreaMetadata.areaNivelColumn
                ? `a.${extraAreaMetadata.areaNivelColumn} AS nivel_ensino`
                : `NULL::int AS nivel_ensino`;

        const detailsQuery = `
            SELECT
                s.id_servico,
                s.${tipoInfo.column} AS id_tiposervico,
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
                ${tipoNomeSelect} AS tipo_servico,
                COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                ${detailsAreaLevelSelect},
                ${detailsAreaNameSelect},
                COALESCE(s.capacidade_max, 0)::int AS n_alunos
            FROM servicos_extracurriculares s
            ${
                tipoInfo.refTable === 'tipo_servico_extracurricular'
                    ? `LEFT JOIN tipo_servico_extracurricular tse ON tse.id_tipo_servico_extra = s.${tipoInfo.column}`
                    : `LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.${tipoInfo.column}`
            }
            LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
            ${detailsAreaJoin}
            WHERE s.id_servico = $1
            LIMIT 1
        `;

        const { rows } = await client.query(detailsQuery, [idServico]);
        await client.query('COMMIT');

        const mapped = mapServicoRow(rows[0]);
        mapped.nivelEnsino = formatNivelEnsino(rows[0]?.nivel_ensino);

        await registarInsert(
            req.userId ?? null,
            'servico_extra_curricular',
            rows[0],
            idServico
        );

        return res.status(201).json({ servico: mapped });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }
        console.error('Erro ao criar serviço extra-curricular:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao criar serviço extra-curricular.' });
    } finally {
        client.release();
    }
}



export async function atualizarServicoExtraCurricular(req, res) {
    return atualizarServicoBase(
        req,
        res,
        'servicos_extracurriculares',
        'extra-curricular',
        'servico_extra_curricular'
    );
}



export async function eliminarServicoExtraCurricular(req, res) {
    return eliminarServicoBase(
        req,
        res,
        'servicos_extracurriculares',
        'extra-curricular',
        'servico_extra_curricular'
    );
}



export async function listarOpcoesServicoExtraCurricular(req, res) {
    try {
        const extraAreaMetadata = await resolveExtraAreaMetadata(db);

        const [
            modalidadesResult,
            areasResult,
            professoresResult,
            salasResult,
            tiposServicoExtraResult,
            niveisExtraResult,
        ] = await Promise.all([
            db.query(
                `SELECT id_modalidade AS id, nome FROM modalidades WHERE COALESCE(ativa, true) = true ORDER BY nome`
            ),
            // Áreas de extra-curriculares
            extraAreaMetadata.areaTableExists
                ? db.query(
                      `
                    SELECT
                        ${extraAreaMetadata.areaIdColumn} AS id,
                        ${extraAreaMetadata.areaNomeColumn} AS nome
                    FROM areas_extracurriculares
                    ${extraAreaMetadata.areaActiveColumn ? `WHERE COALESCE(${extraAreaMetadata.areaActiveColumn}, true) = true` : ''}
                    ORDER BY nome
                `
                  )
                : Promise.resolve({ rows: [] }),
            db.query(`
				SELECT p.id_professor AS id, COALESCE(u.email, CONCAT('Professor #', p.id_professor::text)) AS nome
				FROM professores p
				LEFT JOIN users u ON u.id_user = p.id_user
				WHERE COALESCE(u.role, '') = 'professor'
				  AND COALESCE(u.status, true) = true
				ORDER BY nome
			`),
            db.query(
                `SELECT id_sala AS id, nome FROM salas WHERE COALESCE(ativa, true) = true ORDER BY nome`
            ),
            // Tipos de serviço específicos para extra-curriculares
            db
                .query(
                    `SELECT id_tipo_servico_extra AS id, nome FROM tipo_servico_extracurricular WHERE COALESCE(ativo, true) = true ORDER BY nome`
                )
                .catch(() => Promise.resolve({ rows: [] })),
            // Níveis específicos para extra-curriculares
            db
                .query(
                    `SELECT id_nivel_extra AS id, nome FROM nivel_extracurricular WHERE COALESCE(ativo, true) = true ORDER BY ordem, nome`
                )
                .catch(() => Promise.resolve({ rows: [] })),
        ]);

        const tiposServico =
            tiposServicoExtraResult.rows.length > 0
                ? tiposServicoExtraResult.rows.map((row) => ({
                      id: String(row.id),
                      nome: String(row.nome || ''),
                  }))
                : [];

        const niveisEnsino =
            niveisExtraResult.rows.length > 0
                ? niveisExtraResult.rows.map((row) => ({
                      id: String(row.id),
                      nome: String(row.nome || ''),
                  }))
                : [];

        return res.status(200).json({
            tiposServico,
            modalidades: modalidadesResult.rows,
            areas: Array.isArray(areasResult.rows)
                ? areasResult.rows.map((row) => ({
                      id: row.id,
                      nome: String(row.nome || ''),
                  }))
                : [],
            niveisEnsino,
            professores: professoresResult.rows,
            salas: salasResult.rows,
        });
    } catch (error) {
        console.error(
            'Erro ao listar opções de serviço extra-curricular:',
            error.message
        );
        return res
            .status(500)
            .json({ message: 'Erro ao carregar opções para novo serviço.' });
    }
}

