import { db } from '../config/db.js';

/**
 * SERVICE: Agenda Validation Service
 * Valida conflitos de agendamento e restrições de professores
 */

/**
 * Verifica se há sobreposição de horários para um professor
 *
 * @param {number} professorId - ID do professor
 * @param {string} dataInicio - Data de início (YYYY-MM-DD)
 * @param {string} dataFim - Data de fim (YYYY-MM-DD)
 * @param {string} horaInicio - Hora de início (HH:MM)
 * @param {string} horaFim - Hora de fim (HH:MM)
 * @param {string|null} diasSemana - Dias da semana (JSON string ou null)
 * @param {number|null} excludeServiceId - ID do serviço a excluir da validação (para updates)
 * @returns {Promise<{conflicts: Array, hasConflict: boolean}>}
 */
export async function verificarSobrepoisaoProfessor(
    professorId,
    dataInicio,
    dataFim,
    horaInicio,
    horaFim,
    diasSemana,
    excludeServiceId = null,
    queryClient = db
) {
    try {
        // Parse dias_semana se for string
        let diasArray = [];
        if (diasSemana) {
            try {
                diasArray =
                    typeof diasSemana === 'string'
                        ? JSON.parse(diasSemana)
                        : diasSemana;
            } catch (e) {
                diasArray = [];
            }
        }

        // Query para encontrar conflitos
        const query = `
            SELECT 
                s.id_servico,
                s.tipo,
                COALESCE(d.nome, 'Sem disciplina') AS disciplina,
                s.data_inicio,
                s.data_fim,
                s.hora_inicio,
                s.hora_fim,
                s.dias_semana,
                COALESCE(m.nome, 'Sem modalidade') AS modalidade,
                COALESCE(sala.nome, 'Sem sala') AS sala
            FROM servicos_curriculares s
            LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
            LEFT JOIN salas sala ON sala.id_sala = s.id_sala
            WHERE s.id_professor = $1
              AND s.ativo = true
              ${excludeServiceId ? `AND s.id_servico != ${excludeServiceId}` : ''}
              AND NOT (s.data_fim < $2 OR s.data_inicio > $3)
            ORDER BY s.data_inicio, s.hora_inicio
        `;

        const { rows } = await queryClient.query(query, [
            professorId,
            dataInicio,
            dataFim,
        ]);

        // Verificar conflitos detalhadamente
        const conflicts = [];

        for (const existingService of rows) {
            const existingDiasArray = existingService.dias_semana
                ? JSON.parse(existingService.dias_semana)
                : [];

            // Se um serviço tem dias_semana definidos e o outro também, comparar dias
            const hasCommonDays =
                diasArray.length > 0 && existingDiasArray.length > 0
                    ? diasArray.some((day) => existingDiasArray.includes(day))
                    : !diasArray.length && !existingDiasArray.length;

            // Se não há dias comuns, não há conflito
            if (
                diasArray.length > 0 &&
                existingDiasArray.length > 0 &&
                !hasCommonDays
            ) {
                continue;
            }

            // Verificar sobreposição de horas
            const horaInicioMins = timeToMinutes(horaInicio);
            const horaFimMins = timeToMinutes(horaFim);
            const existingInicioMins = timeToMinutes(
                existingService.hora_inicio
            );
            const existingFimMins = timeToMinutes(existingService.hora_fim);

            if (
                horaInicioMins < existingFimMins &&
                horaFimMins > existingInicioMins
            ) {
                conflicts.push({
                    id: existingService.id_servico,
                    disciplina: existingService.disciplina,
                    dataInicio: existingService.data_inicio,
                    horaInicio: existingService.hora_inicio,
                    horaFim: existingService.hora_fim,
                    modalidade: existingService.modalidade,
                    sala: existingService.sala,
                });
            }
        }

        return {
            conflicts,
            hasConflict: conflicts.length > 0,
        };
    } catch (error) {
        console.error('Erro ao verificar sobreposição de professor:', error);
        throw error;
    }
}

/**
 * Verifica se há sobreposição de horários para alunos inscritos
 *
 * @param {Array<number>} alunosIds - Lista de IDs de alunos
 * @param {string} dataInicio - Data de início (YYYY-MM-DD)
 * @param {string} dataFim - Data de fim (YYYY-MM-DD)
 * @param {string} horaInicio - Hora de início (HH:MM)
 * @param {string} horaFim - Hora de fim (HH:MM)
 * @param {string|null} diasSemana - Dias da semana (JSON string ou null)
 * @param {number|null} excludeServiceId - ID do serviço a excluir
 * @returns {Promise<{conflictsByAluno: Object, hasConflict: boolean}>}
 */
export async function verificarSobrepoisaoAlunos(
    alunosIds,
    dataInicio,
    dataFim,
    horaInicio,
    horaFim,
    diasSemana,
    excludeServiceId = null,
    queryClient = db
) {
    try {
        if (!alunosIds || alunosIds.length === 0) {
            return { conflictsByAluno: {}, hasConflict: false };
        }

        // Parse dias_semana se for string
        let diasArray = [];
        if (diasSemana) {
            try {
                diasArray =
                    typeof diasSemana === 'string'
                        ? JSON.parse(diasSemana)
                        : diasSemana;
            } catch (e) {
                diasArray = [];
            }
        }

        // Query para encontrar serviços dos alunos em conflito potencial
        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(queryClient);
        if (!inscricoesServicoColumn) {
            return { conflictsByAluno: {}, hasConflict: false };
        }

        const placeholders = alunosIds.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT DISTINCT
                i.id_aluno,
                p.nome AS aluno_nome,
                s.id_servico,
                COALESCE(d.nome, 'Sem disciplina') AS disciplina,
                s.data_inicio,
                s.data_fim,
                s.hora_inicio,
                s.hora_fim,
                s.dias_semana,
                COALESCE(m.nome, 'Sem modalidade') AS modalidade
            FROM inscricoes i
            INNER JOIN alunos a ON a.id_aluno = i.id_aluno
            INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            INNER JOIN servicos_curriculares s ON s.id_servico = i.${inscricoesServicoColumn}
            LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
            WHERE i.id_aluno IN (${placeholders})
              AND i.estado = 'ativa'
              AND s.ativo = true
              ${excludeServiceId ? `AND s.id_servico != ${excludeServiceId}` : ''}
              AND NOT (s.data_fim < $${alunosIds.length + 1} OR s.data_inicio > $${alunosIds.length + 2})
            ORDER BY i.id_aluno, s.data_inicio, s.hora_inicio
        `;

        const { rows } = await queryClient.query(query, [
            ...alunosIds,
            dataInicio,
            dataFim,
        ]);

        // Agrupar conflitos por aluno
        const conflictsByAluno = {};

        for (const row of rows) {
            const existingDiasArray = row.dias_semana
                ? JSON.parse(row.dias_semana)
                : [];

            const hasCommonDays =
                diasArray.length > 0 && existingDiasArray.length > 0
                    ? diasArray.some((day) => existingDiasArray.includes(day))
                    : !diasArray.length && !existingDiasArray.length;

            if (
                diasArray.length > 0 &&
                existingDiasArray.length > 0 &&
                !hasCommonDays
            ) {
                continue;
            }

            const horaInicioMins = timeToMinutes(horaInicio);
            const horaFimMins = timeToMinutes(horaFim);
            const existingInicioMins = timeToMinutes(row.hora_inicio);
            const existingFimMins = timeToMinutes(row.hora_fim);

            if (
                horaInicioMins < existingFimMins &&
                horaFimMins > existingInicioMins
            ) {
                if (!conflictsByAluno[row.id_aluno]) {
                    conflictsByAluno[row.id_aluno] = {
                        alunoId: row.id_aluno,
                        alunoNome: row.aluno_nome,
                        conflitos: [],
                    };
                }

                conflictsByAluno[row.id_aluno].conflitos.push({
                    id: row.id_servico,
                    disciplina: row.disciplina,
                    dataInicio: row.data_inicio,
                    horaInicio: row.hora_inicio,
                    horaFim: row.hora_fim,
                    modalidade: row.modalidade,
                });
            }
        }

        const hasConflict = Object.keys(conflictsByAluno).length > 0;
        return { conflictsByAluno, hasConflict };
    } catch (error) {
        console.error('Erro ao verificar sobreposição de alunos:', error);
        throw error;
    }
}

/**
 * Verifica se o professor pode lecionar a disciplina (validação de área de formação)
 *
 * @param {number} professorId - ID do professor
 * @param {number} disciplinaId - ID da disciplina
 * @returns {Promise<{canTeach: boolean, professorArea: string, disciplinaArea: string, message: string}>}
 */
export async function verificarAreaFormacao(professorId, areaId) {
    try {
        // Obter área de formação do professor
        const professorQuery = `
            SELECT pr.area_ensino, p.nome
            FROM professores pr
            INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
            WHERE pr.id_professor = $1
        `;
        const { rows: professorRows } = await db.query(professorQuery, [
            professorId,
        ]);

        if (professorRows.length === 0) {
            return {
                canTeach: false,
                professorArea: '',
                disciplinaArea: '',
                message: 'Professor não encontrado.',
            };
        }

        const professor = professorRows[0];
        const professorArea = professor.area_ensino?.trim().toLowerCase() || '';

        // Obter área da disciplina
        const disciplinaQuery = `
            SELECT a.nome
            FROM areas_extracurriculares a
            WHERE a.id_area = $1
        `;
        const { rows: disciplinaRows } = await db.query(disciplinaQuery, [
            areaId,
        ]);

        if (disciplinaRows.length === 0) {
            return {
                canTeach: false,
                professorArea: professorArea,
                disciplinaArea: '',
                message: 'Disciplina não encontrada.',
            };
        }

        const disciplina = disciplinaRows[0];
        const disciplinaArea = disciplina.nome?.trim().toLowerCase() || '';

        // Validar compatibilidade (case-insensitive, trim)
        const canTeach =
            professorArea === disciplinaArea && professorArea !== '';

        return {
            canTeach,
            professorArea: professor.area_ensino,
            disciplinaArea: disciplina.nome,
            message: canTeach
                ? `Professor ${professor.nome} pode lecionar ${disciplina.nome}`
                : `Professor não está qualificado para lecionar ${disciplina.nome}. Área de formação: ${professorArea || 'não definida'}, Área da disciplina: ${disciplinaArea || 'não definida'}`,
        };
    } catch (error) {
        console.error('Erro ao verificar área de formação:', error);
        throw error;
    }
}

/**
 * Converte hora no formato HH:MM para minutos
 * @param {string} time - Hora no formato HH:MM
 * @returns {number} Minutos desde o início do dia
 */
function timeToMinutes(time) {
    if (!time) return 0;
    const [hours, minutes] = String(time).split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

async function resolveInscricoesServicoColumn(queryClient = db) {
    const { rows } = await queryClient.query(
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
 * Valida se há conflito completo para criação/atualização de serviço
 * Realiza todas as validações necessárias
 *
 * @param {Object} servicoData - Dados do serviço
 * @returns {Promise<{valid: boolean, errors: Array, warnings: Array}>}
 */
export async function validarServicoCompleto(servicoData) {
    const {
        professorId,
        disciplinaId,
        dataInicio,
        dataFim,
        horaInicio,
        horaFim,
        diasSemana,
        alunosIds,
        excludeServiceId,
    } = servicoData;

    const errors = [];
    const warnings = [];

    try {
        // 1. Validar área de formação do professor
        if (professorId && disciplinaId) {
            const areaCheck = await verificarAreaFormacao(
                professorId,
                disciplinaId
            );
            if (!areaCheck.canTeach) {
                errors.push(areaCheck.message);
            }
        }

        // 2. Validar sobreposição de professor
        if (professorId) {
            const professorCheck = await verificarSobrepoisaoProfessor(
                professorId,
                dataInicio,
                dataFim,
                horaInicio,
                horaFim,
                diasSemana,
                excludeServiceId
            );
            if (professorCheck.hasConflict) {
                errors.push(
                    `Professor possui conflito de horário com ${professorCheck.conflicts.length} aula(s) existente(s).`
                );
                professorCheck.conflicts.forEach((conflict) => {
                    warnings.push(
                        `Conflito com: ${conflict.disciplina} (${conflict.dataInicio} ${conflict.horaInicio}-${conflict.horaFim})`
                    );
                });
            }
        }

        // 3. Validar sobreposição de alunos
        if (alunosIds && alunosIds.length > 0) {
            const alunosCheck = await verificarSobrepoisaoAlunos(
                alunosIds,
                dataInicio,
                dataFim,
                horaInicio,
                horaFim,
                diasSemana,
                excludeServiceId
            );
            if (alunosCheck.hasConflict) {
                const numAlunos = Object.keys(
                    alunosCheck.conflictsByAluno
                ).length;
                errors.push(
                    `${numAlunos} aluno(s) possui(em) conflito de horário.`
                );
                Object.values(alunosCheck.conflictsByAluno).forEach((aluno) => {
                    warnings.push(
                        `${aluno.alunoNome}: ${aluno.conflitos.length} conflito(s)`
                    );
                });
            }
        }
    } catch (error) {
        console.error('Erro na validação completa do serviço:', error);
        errors.push('Erro ao validar conflitos de agendamento.');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
