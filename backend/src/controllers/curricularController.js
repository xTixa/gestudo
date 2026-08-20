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
    getPrimarySchedule,
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
 * SERVICOS CURRICULARES CONTROLLER
 * Controller focado nas rotas deste tipo de servico.
 */

export async function listarServicosCurriculares(req, res) {
    try {
        await ensureServiceVersionColumns(db, 'servicos_curriculares');
        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(db);
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
                COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Sem professor') AS professor,
				d.id_nivel AS nivel_ensino,
				COALESCE(d.nome, 'Sem disciplina') AS area,
				COALESCE(s.capacidade_max, 0)::int AS n_alunos,
				${alunosIdsSelect}
			FROM servicos_curriculares s
			LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
			LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
			LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN professores p ON p.id_professor = s.id_professor
            LEFT JOIN users u ON u.id_user = p.id_user
            LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
			WHERE COALESCE(s.ativo, true) = true
			  AND NOT EXISTS (
				SELECT 1
				FROM servicos_curriculares newer
				WHERE COALESCE(newer.ativo, true) = true
				  AND COALESCE(newer.id_servico_origem, newer.id_servico) = COALESCE(s.id_servico_origem, s.id_servico)
				  AND newer.data_inicio > s.data_inicio
			  )
			ORDER BY s.created_at DESC, s.id_servico DESC
		`;

        const { rows } = await db.query(query);
        return res.status(200).json({ servicos: rows.map(mapServicoRow) });
    } catch (error) {
        console.error('Erro ao listar serviços curriculares:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao carregar serviços curriculares.' });
    }
}

export async function listarOpcoesServicoCurricular(req, res) {
    try {
        const extraAreaMetadata = await resolveExtraAreaMetadata(db);
        const [
            modalidadesResult,
            disciplinasResult,
            professoresResult,
            salasResult,
            alunosResult,
            tiposServicoResult,
        ] = await Promise.all([
            db.query(
                `SELECT id_modalidade AS id, nome FROM modalidades WHERE COALESCE(ativa, true) = true ORDER BY nome`
            ),
            db.query(
                `SELECT id_disciplina AS id, nome, id_nivel FROM disciplinas ORDER BY nome`
            ),
            db.query(`
				SELECT p.id_professor AS id, COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), CONCAT('Professor #', p.id_professor::text)) AS nome
				FROM professores p
				LEFT JOIN users u ON u.id_user = p.id_user
                LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
				WHERE COALESCE(u.role, '') = 'professor'
				ORDER BY nome
			`),
            db.query(
                `SELECT id_sala AS id, nome FROM salas ORDER BY nome`
            ),
            db.query(`
				SELECT
					a.id_aluno AS id,
					COALESCE(NULLIF(TRIM(pes.nome), ''), CONCAT('Aluno #', a.id_aluno::text)) AS nome,
					COALESCE(a.ano::text, '') AS ano
				FROM alunos a
				LEFT JOIN pessoas pes ON pes.id_pessoa = a.id_pessoa
				ORDER BY nome
			`),
            db.query(
                `SELECT id_tiposervico AS id, nome FROM tipo_servico WHERE COALESCE(ativo, true) = true ORDER BY nome`
            ),
        ]);

        const areaWhereClause = extraAreaMetadata.areaActiveColumn
            ? `WHERE COALESCE(${extraAreaMetadata.areaActiveColumn}, true) = true`
            : '';

        const areasResult = extraAreaMetadata.areaTableExists
            ? await db.query(
                  `
				SELECT
					${extraAreaMetadata.areaIdColumn} AS id,
					${extraAreaMetadata.areaNomeColumn} AS nome,
					${
                        extraAreaMetadata.areaNivelColumn
                            ? `${extraAreaMetadata.areaNivelColumn}::text`
                            : "''"
                    } AS nivelId
				FROM areas_extracurriculares
				${areaWhereClause}
				ORDER BY nome
			`
              )
            : { rows: [] };

        const tiposServico = tiposServicoResult.rows.map((row) => ({
            id: String(row.id),
            nome: String(row.nome || ''),
        }));

        const niveisMap = new Map();
        disciplinasResult.rows.forEach((row) => {
            const nivelRaw = row.id_nivel;
            if (nivelRaw == null) {
                return;
            }

            const key = String(nivelRaw);
            if (!niveisMap.has(key)) {
                niveisMap.set(key, { id: key, nome: formatNivelEnsino(key) });
            }
        });

        return res.status(200).json({
            tiposServico,
            modalidades: modalidadesResult.rows,
            disciplinas: disciplinasResult.rows.map((row) => ({
                id: row.id,
                nome: row.nome,
                nivelId: row.id_nivel == null ? '' : String(row.id_nivel),
            })),
            areas: Array.isArray(areasResult.rows)
                ? areasResult.rows.map((row) => ({
                      id: row.id,
                      nome: String(row.nome || ''),
                      nivelId: row.nivelId == null ? '' : String(row.nivelId),
                  }))
                : [],
            niveisEnsino: Array.from(niveisMap.values()),
            professores: professoresResult.rows,
            salas: salasResult.rows,
            alunos: alunosResult.rows.map((row) => ({
                id: row.id,
                nome: row.nome,
                ano: row.ano || '',
            })),
        });
    } catch (error) {
        console.error(
            'Erro ao listar opções de serviço curricular:',
            error.message
        );
        return res
            .status(500)
            .json({ message: 'Erro ao carregar opções para novo serviço.' });
    }
}

export async function criarServicoCurricular(req, res) {
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
            horaInicio,
            duracao,
            alunosIds,
            diasSemana,
            sessoes,
        } = req.body || {};

        if (
            !tipoServico ||
            !modalidadeId ||
            !(disciplinaId || areaId) ||
            !dataInicio ||
            (!Array.isArray(sessoes) && (!horaInicio || !duracao))
        ) {
            return res.status(400).json({
                message:
                    'Preencha todos os campos obrigatórios para criar o serviço.',
            });
        }

        await ensureDiasSemanaColumn(client, 'servicos_curriculares');
        await ensureServiceVersionColumns(client, 'servicos_curriculares');

        const capacidadeMax = Array.isArray(alunosIds) ? alunosIds.length : 0;
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

        // ==================== VALIDAÇÕES DE CONFLITOS ====================

        // Calcular data_fim para validação
        const dataFimValidacao = isPeriodic
            ? getDataFimAnoLetivo(dataInicio)
            : dataInicio;

        if (salaId) {
            const salaCheck = await verificarConflitoSalaDatabase(
                Number(salaId),
                dataInicio,
                dataFimValidacao,
                schedule.horaInicio,
                horaFim,
                diasSemanaJson,
                null
            );
            if (salaCheck.hasConflict) {
                return res.status(409).json({
                    code: 'SALA_CONFLICT',
                    message:
                        'Sala possui conflito de horario com servico(s) existente(s).',
                    conflicts: salaCheck.conflicts,
                });
            }
        }

        // Validar sobreposição de professor
        if (professorId) {
            const professorCheck = await verificarSobrepoisaoProfessor(
                Number(professorId),
                dataInicio,
                dataFimValidacao,
                schedule.horaInicio,
                horaFim,
                diasSemanaJson,
                null
            );
            if (professorCheck.hasConflict) {
                return res.status(409).json({
                    code: 'PROFESSOR_CONFLICT',
                    message:
                        'Professor possui conflito de horário com aula(s) existente(s).',
                    conflicts: professorCheck.conflicts,
                });
            }
        }

        // Validar sobreposição de alunos
        if (Array.isArray(alunosIds) && alunosIds.length > 0) {
            const alunosCheck = await verificarSobrepoisaoAlunos(
                alunosIds.map(Number),
                dataInicio,
                dataFimValidacao,
                schedule.horaInicio,
                horaFim,
                diasSemanaJson,
                null
            );
            if (alunosCheck.hasConflict) {
                const conflictingAlunos = Object.values(
                    alunosCheck.conflictsByAluno
                );
                return res.status(409).json({
                    code: 'ALUNOS_CONFLICT',
                    message: `${conflictingAlunos.length} aluno(s) possui(em) conflito de horário.`,
                    conflictsByAluno: alunosCheck.conflictsByAluno,
                });
            }
        }

        // ================== FIM VALIDAÇÕES DE CONFLITOS ==================

        const tipoServicoResolvedId = await resolveTipoServicoId(
            client,
            idTipoServico ?? id_tiposervico ?? tipoServicoId,
            tipoServico,
            tipoDb,
            'curricular'
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

        await client.query('BEGIN');

        const insertQuery = `
			INSERT INTO servicos_curriculares (
				id_professor,
				id_disciplina,
				id_modalidade,
				id_tiposervico,
				id_sala,
				tipo,
				ano_letivo,
				data_inicio,
				data_fim,
				hora_inicio,
				hora_fim,
				capacidade_max,
				dias_semana,
				ativo
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
			RETURNING id_servico
		`;

        const dataFim = isPeriodic
            ? getDataFimAnoLetivo(dataInicio)
            : dataInicio;

        const insertValues = [
            professorId ? Number(professorId) : null,
            Number(disciplinaId),
            Number(modalidadeId),
            tipoServicoResolvedId,
            salaId ? Number(salaId) : null,
            tipoDb,
            anoLetivo,
            dataInicio,
            dataFim,
            schedule.horaInicio,
            horaFim,
            Math.max(1, capacidadeMax),
            diasSemanaJson,
        ];

        const { rows: insertedRows } = await client.query(
            insertQuery,
            insertValues
        );
        const idServico = insertedRows[0]?.id_servico;
        await client.query(
            `
				UPDATE servicos_curriculares
				SET id_servico_origem = $1
				WHERE id_servico = $1
			`,
            [idServico]
        );

        if (Array.isArray(alunosIds) && alunosIds.length) {
            const pacote = await resolvePacote(
                client,
                Number(disciplinaId),
                Number(modalidadeId)
            );
            if (!pacote) {
                throw new Error(
                    'Não existe pacote ativo para associar inscrições dos alunos.'
                );
            }

            const inscricoesServicoColumn =
                await resolveInscricoesServicoColumn(client);
            if (!inscricoesServicoColumn) {
                throw new Error(
                    'Tabela inscricoes sem coluna de ligação ao serviço curricular.'
                );
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

            for (const alunoIdRaw of alunosIds) {
                const alunoId = Number(alunoIdRaw);
                if (!Number.isInteger(alunoId)) {
                    continue;
                }

                await client.query(insertInscricaoQuery, [
                    alunoId,
                    idServico,
                    pacote.id_pacote,
                    pacote.preco,
                ]);
            }
        }

        const detailsQuery = `
			SELECT
				s.id_servico,
                s.tipo AS tipo_canonical,
				CASE
					WHEN s.data_fim IS NOT NULL AND s.data_fim > s.data_inicio THEN 'Periódico'
					ELSE 'Único'
				END AS periodicidade,
				COALESCE(NULLIF(s.tipo, ''), 'Serviço') AS tipo_servico,
				COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                COALESCE(NULLIF(pes.nome, ''), NULLIF(u.email, ''), 'Sem professor') AS professor,
				d.id_nivel AS nivel_ensino,
				COALESCE(d.nome, 'Sem disciplina') AS area,
				COALESCE(s.capacidade_max, 0)::int AS n_alunos
			FROM servicos_curriculares s
			LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
			LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN professores p ON p.id_professor = s.id_professor
            LEFT JOIN users u ON u.id_user = p.id_user
            LEFT JOIN pessoas pes ON pes.id_pessoa = p.id_pessoa
			WHERE s.id_servico = $1
			LIMIT 1
		`;

        const { rows } = await client.query(detailsQuery, [idServico]);

        await client.query('COMMIT');
        const mapped = mapServicoRow(rows[0]);
        mapped.nivelEnsino = formatNivelEnsino(rows[0]?.nivel_ensino);

        await registarInsert(
            req.userId ?? null,
            'servico_curricular',
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
        console.error('Erro ao criar serviço curricular:', error.message);
        if (error.statusCode) {
            return res
                .status(error.statusCode)
                .json({ code: error.code, message: error.message });
        }
        return res
            .status(500)
            .json({ message: 'Erro ao criar serviço curricular.' });
    } finally {
        client.release();
    }
}

export async function atualizarServicoCurricular(req, res) {
    const client = await db.connect();

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
            professorId,
            salaId,
            horaInicio,
            duracao,
            diasSemana,
            sessoes,
            alunosIds,
        } = req.body || {};

        await ensureDiasSemanaColumn(client, 'servicos_curriculares');
        await ensureServiceVersionColumns(client, 'servicos_curriculares');
        await client.query('BEGIN');

        const { rows: oldRows } = await client.query(
            `
				SELECT *
				FROM servicos_curriculares
				WHERE id_servico = $1
				FOR UPDATE
			`,
            [idServico]
        );

        if (!oldRows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        const oldServico = oldRows[0];
        const oldStart = normalizeDateKey(oldServico.data_inicio);
        const oldEnd = normalizeDateKey(oldServico.data_fim) || oldStart;
        const tomorrow = addDaysToDateKey(todayDateKey(), 1);
        let effectiveDate = normalizeDateKey(
            req.body?.aplicarDesde || req.body?.effectiveDate
        );

        if (!effectiveDate) {
            effectiveDate =
                oldStart && oldStart > tomorrow ? oldStart : tomorrow;
        }
        if (oldStart && effectiveDate < oldStart) {
            effectiveDate = oldStart;
        }
        if (oldEnd && effectiveDate > oldEnd) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message:
                    'O serviço já terminou antes da data escolhida para aplicar alterações.',
            });
        }

        const nextProfessorId =
            professorId !== undefined
                ? professorId
                    ? Number(professorId)
                    : null
                : oldServico.id_professor != null
                  ? Number(oldServico.id_professor)
                  : null;
        const nextDisciplinaId =
            disciplinaId !== undefined
                ? Number(disciplinaId)
                : Number(oldServico.id_disciplina);
        const nextModalidadeId =
            modalidadeId !== undefined
                ? Number(modalidadeId)
                : Number(oldServico.id_modalidade);
        const nextTipoDb = resolveIsPeriodic(
            serviceType,
            periodicidade,
            Array.isArray(sessoes) && sessoes.length ? sessoes : diasSemana
        )
            ? 'periodico'
            : 'unico';
        const nextTipoServicoId =
            tipoServico || idTipoServico || id_tiposervico || tipoServicoId
                ? await resolveTipoServicoId(
                      client,
                      idTipoServico ?? id_tiposervico ?? tipoServicoId,
                      tipoServico,
                      nextTipoDb,
                      'curricular'
                  )
                : Number(oldServico.id_tiposervico);
        const nextSalaId =
            salaId !== undefined
                ? salaId
                    ? Number(salaId)
                    : null
                : oldServico.id_sala != null
                  ? Number(oldServico.id_sala)
                  : null;
        const schedule = getPrimarySchedule({
            sessoes,
            diasSemana,
            horaInicio: horaInicio || oldServico.hora_inicio,
            duracao:
                duracao ||
                getDurationMinutes(
                    normalizeTimeLabel(oldServico.hora_inicio),
                    normalizeTimeLabel(oldServico.hora_fim)
                ),
        });
        const nextHoraInicio = schedule.horaInicio;
        const nextHoraFim = schedule.horaFim;

        if (
            (nextSalaId != null &&
                (!Number.isInteger(nextSalaId) || nextSalaId <= 0)) ||
            !nextHoraInicio ||
            !nextHoraFim
        ) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Sala, hora ou duração inválida para o serviço.',
            });
        }

        const nextDiasSemana = schedule.sessoes.length
            ? schedule.sessoes
            : Array.isArray(diasSemana)
              ? diasSemana
              : parseDiasSemanaValue(oldServico.dias_semana);
        const nextDiasSemanaJson = JSON.stringify(nextDiasSemana);
        const selectedAlunos = Array.isArray(alunosIds)
            ? Array.from(
                  new Set(
                      alunosIds
                          .map(Number)
                          .filter((id) => Number.isInteger(id) && id > 0)
                  )
              )
            : await carregarAlunosIdsServico(client, idServico);

        if (nextSalaId) {
            const salaCheck = await verificarConflitoSalaDatabase(
                nextSalaId,
                effectiveDate,
                oldEnd,
                nextHoraInicio,
                nextHoraFim,
                nextDiasSemanaJson,
                idServico,
                client
            );
            if (salaCheck.hasConflict) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    code: 'SALA_CONFLICT',
                    message:
                        'Sala possui conflito de horario com servico(s) existente(s).',
                    conflicts: salaCheck.conflicts,
                });
            }
        }

        if (nextProfessorId) {
            const professorCheck = await verificarSobrepoisaoProfessor(
                Number(nextProfessorId),
                effectiveDate,
                oldEnd,
                nextHoraInicio,
                nextHoraFim,
                nextDiasSemanaJson,
                idServico,
                client
            );
            if (professorCheck.hasConflict) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    code: 'PROFESSOR_CONFLICT',
                    message: `Professor possui conflito de horário com ${professorCheck.conflicts.length} aula(s) existente(s).`,
                    conflicts: professorCheck.conflicts,
                });
            }
        }

        if (selectedAlunos.length) {
            const alunosCheck = await verificarSobrepoisaoAlunos(
                selectedAlunos,
                effectiveDate,
                oldEnd,
                nextHoraInicio,
                nextHoraFim,
                nextDiasSemanaJson,
                idServico,
                client
            );
            if (alunosCheck.hasConflict) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    code: 'ALUNOS_CONFLICT',
                    message: `${Object.keys(alunosCheck.conflictsByAluno).length} aluno(s) possui(em) conflito de horário.`,
                    conflictsByAluno: alunosCheck.conflictsByAluno,
                });
            }
        }

        const shouldUpdateInPlace = effectiveDate <= oldStart;
        let nextServicoId = idServico;

        if (shouldUpdateInPlace) {
            await client.query(
                `
					UPDATE servicos_curriculares
					SET
						id_sala = $1,
                        id_professor = $2,
                        id_disciplina = $3,
                        id_modalidade = $4,
                        id_tiposervico = $5,
                        tipo = $6,
						hora_inicio = $7,
						hora_fim = $8,
						dias_semana = $9,
						capacidade_max = $10,
						id_servico_origem = COALESCE(id_servico_origem, id_servico),
						versao_criada_em = COALESCE(versao_criada_em, CURRENT_TIMESTAMP)
					WHERE id_servico = $11
				`,
                [
                    nextSalaId,
                    nextProfessorId,
                    nextDisciplinaId,
                    nextModalidadeId,
                    nextTipoServicoId,
                    nextTipoDb,
                    nextHoraInicio,
                    nextHoraFim,
                    nextDiasSemanaJson,
                    Math.max(1, selectedAlunos.length),
                    idServico,
                ]
            );
            await sincronizarInscricoesServicoCurricular(
                client,
                idServico,
                selectedAlunos,
                nextDisciplinaId,
                nextModalidadeId
            );
        } else {
            const previousEffectiveDate = addDaysToDateKey(effectiveDate, -1);
            const originId =
                Number(oldServico.id_servico_origem) > 0
                    ? Number(oldServico.id_servico_origem)
                    : idServico;

            await client.query(
                `
					UPDATE servicos_curriculares
					SET
						data_fim = $1,
						id_servico_origem = COALESCE(id_servico_origem, id_servico)
					WHERE id_servico = $2
				`,
                [previousEffectiveDate, idServico]
            );

            const insertResult = await client.query(
                `
					INSERT INTO servicos_curriculares (
						id_professor,
						id_disciplina,
						id_modalidade,
						id_tiposervico,
						id_sala,
						tipo,
						ano_letivo,
						data_inicio,
						data_fim,
						hora_inicio,
						hora_fim,
						capacidade_max,
						dias_semana,
						ativo,
						id_servico_origem,
						versao_criada_em
					)
					VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14,CURRENT_TIMESTAMP)
					RETURNING id_servico
				`,
                [
                    nextProfessorId,
                    nextDisciplinaId,
                    nextModalidadeId,
                    nextTipoServicoId,
                    nextSalaId,
                    nextTipoDb,
                    getAnoLetivo(effectiveDate),
                    effectiveDate,
                    oldEnd,
                    nextHoraInicio,
                    nextHoraFim,
                    Math.max(1, selectedAlunos.length),
                    nextDiasSemanaJson,
                    originId,
                ]
            );

            nextServicoId = insertResult.rows[0]?.id_servico;
            await inserirInscricoesServicoCurricular(
                client,
                nextServicoId,
                selectedAlunos,
                nextDisciplinaId,
                nextModalidadeId
            );
        }

        const nextRow = await carregarDetalheServicoCurricular(
            client,
            nextServicoId
        );

        await client.query('COMMIT');

        await registarUpdate(
            req.userId ?? null,
            'servico_curricular',
            idServico,
            oldServico,
            nextRow
        );

        const mapped = mapServicoRow(nextRow);
        mapped.nivelEnsino = formatNivelEnsino(nextRow?.nivel_ensino);

        return res.status(200).json({
            servico: mapped,
            versioned: !shouldUpdateInPlace,
            previousServiceId: idServico,
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }
        console.error('Erro ao atualizar serviço curricular:', error.message);
        if (error.statusCode) {
            return res
                .status(error.statusCode)
                .json({ code: error.code, message: error.message });
        }
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar serviço curricular.' });
    } finally {
        client.release();
    }
}

export async function eliminarServicoCurricular(req, res) {
    return eliminarServicoBase(
        req,
        res,
        'servicos_curriculares',
        'curricular',
        'servico_curricular'
    );
}
