import { db } from '../config/db.js';

/**
 * MODEL: Servicos
 * Operações de dados para tabela servicos (serviços curriculares e extra-curriculares)
 *
 * Schema:
 * - id_servico (PK): Identificador único
 * - tipo: Tipo de serviço (Periódico, Único)
 * - id_disciplina (FK): Referência para tabela disciplinas
 * - id_modalidade (FK): Referência para tabela modalidades
 * - id_professor (FK): Responsável do serviço
 * - id_sala (FK): Sala de aula
 * - data_inicio: Data de início
 * - data_fim: Data de término
 * - hora_inicio: Hora de início
 * - hora_fim: Hora de término
 * - capacidade_max: Número máximo de alunos
 * - ativo: Status do serviço
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo serviço
 */
export async function criarServico(dadosServico) {
    const {
        tipo,
        idDisciplina,
        idModalidade,
        idProfessor,
        idSala,
        dataInicio,
        dataFim,
        horaInicio,
        horaFim,
        capacidadeMax,
        ativo,
    } = dadosServico;

    const query = `
    INSERT INTO servicos (tipo, id_disciplina, id_modalidade, id_professor, id_sala,
                         data_inicio, data_fim, hora_inicio, hora_fim, capacidade_max, ativo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id_servico, tipo, id_disciplina, id_modalidade, id_professor, id_sala,
              data_inicio, data_fim, hora_inicio, hora_fim, capacidade_max, ativo, created_at
  `;

    const { rows } = await db.query(query, [
        tipo,
        idDisciplina,
        idModalidade,
        idProfessor,
        idSala,
        dataInicio,
        dataFim,
        horaInicio,
        horaFim,
        capacidadeMax,
        ativo !== false ? true : false,
    ]);

    return rows[0];
}

// =============== READ ===============

/**
 * Obtém serviço por ID
 */
export async function obterServico(idServico) {
    const query = `
    SELECT
      s.id_servico, s.tipo, s.id_disciplina, s.id_modalidade,
      s.id_professor, s.id_sala,
      d.nome AS disciplina, m.nome AS modalidade,
      sa.nome AS sala, p.nome AS professor,
      s.data_inicio, s.data_fim, s.hora_inicio, s.hora_fim,
      s.capacidade_max, s.ativo, s.created_at
    FROM servicos s
    LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
    LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
    LEFT JOIN salas sa ON sa.id_sala = s.id_sala
    LEFT JOIN professores pr ON pr.id_professor = s.id_professor
    LEFT JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
    WHERE s.id_servico = $1
  `;

    const { rows } = await db.query(query, [idServico]);
    return rows[0];
}

/**
 * Lista todos os serviços
 */
export async function listarServicos() {
    const query = `
    SELECT
      s.id_servico, s.tipo, s.id_disciplina, s.id_modalidade,
      d.nome AS disciplina, m.nome AS modalidade,
      s.data_inicio, s.data_fim, s.ativo, s.created_at
    FROM servicos s
    LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
    LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
    ORDER BY s.created_at DESC
  `;

    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista serviços ativos
 */
export async function listarServicosAtivos() {
    const query = `
    SELECT * FROM servicos
    WHERE COALESCE(ativo, true) = true
    ORDER BY created_at DESC
  `;

    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista serviços por tipo
 */
export async function listarServicosPorTipo(tipo) {
    const query = `
    SELECT * FROM servicos
    WHERE tipo = $1 AND COALESCE(ativo, true) = true
    ORDER BY created_at DESC
  `;

    const { rows } = await db.query(query, [tipo]);
    return rows;
}

/**
 * Lista serviços por disciplina
 */
export async function listarServicosPorDisciplina(idDisciplina) {
    const query = `
    SELECT * FROM servicos
    WHERE id_disciplina = $1 AND COALESCE(ativo, true) = true
    ORDER BY created_at DESC
  `;

    const { rows } = await db.query(query, [idDisciplina]);
    return rows;
}

/**
 * Lista serviços por modalidade
 */
export async function listarServicosPorModalidade(idModalidade) {
    const query = `
    SELECT * FROM servicos
    WHERE id_modalidade = $1 AND COALESCE(ativo, true) = true
    ORDER BY created_at DESC
  `;

    const { rows } = await db.query(query, [idModalidade]);
    return rows;
}

/**
 * Lista serviços de um professor
 */
export async function listarServicosProfessor(idProfessor) {
    const query = `
    SELECT * FROM servicos
    WHERE id_professor = $1 AND COALESCE(ativo, true) = true
    ORDER BY data_inicio DESC
  `;

    const { rows } = await db.query(query, [idProfessor]);
    return rows;
}

/**
 * Lista serviços num intervalo de datas
 */
export async function listarServicosEntreDatas(dataInicio, dataFim) {
    const query = `
    SELECT * FROM servicos
    WHERE data_inicio >= $1 AND data_inicio <= $2
      AND COALESCE(ativo, true) = true
    ORDER BY data_inicio ASC
  `;

    const { rows } = await db.query(query, [dataInicio, dataFim]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de serviço
 */
export async function atualizarServico(idServico, dadosAtualizacao) {
    const validadosDados = {};

    // Listar campos permitidos
    const camposPermitidos = [
        'tipo',
        'id_disciplina',
        'id_modalidade',
        'id_professor',
        'id_sala',
        'data_inicio',
        'data_fim',
        'hora_inicio',
        'hora_fim',
        'capacidade_max',
        'ativo',
    ];

    camposPermitidos.forEach((campo) => {
        if (dadosAtualizacao[campo] !== undefined) {
            validadosDados[campo] = dadosAtualizacao[campo];
        }
    });

    if (Object.keys(validadosDados).length === 0) return null;

    const setClauses = [];
    const values = [];

    Object.entries(validadosDados).forEach(([chave, valor]) => {
        values.push(valor);
        setClauses.push(`${chave} = $${values.length}`);
    });

    values.push(idServico);

    const query = `
    UPDATE servicos
    SET ${setClauses.join(', ')}
    WHERE id_servico = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

/**
 * Altera status/ativação de serviço
 */
export async function alterarStatusServico(idServico, ativo) {
    const query = `
    UPDATE servicos
    SET ativo = $1
    WHERE id_servico = $2
    RETURNING id_servico, ativo
  `;

    const { rows } = await db.query(query, [ativo, idServico]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove serviço (soft delete)
 */
export async function removerServico(idServico) {
    const query = `
    UPDATE servicos
    SET ativo = false
    WHERE id_servico = $1
    RETURNING id_servico
  `;

    const { rows } = await db.query(query, [idServico]);
    return rows[0];
}

/**
 * Remove serviço permanentemente
 */
export async function removerServicoPermanente(idServico) {
    const query = `DELETE FROM servicos WHERE id_servico = $1 RETURNING id_servico`;
    const { rows } = await db.query(query, [idServico]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se serviço existe
 */
export async function servicoExiste(idServico) {
    const query = `SELECT COUNT(*) as count FROM servicos WHERE id_servico = $1`;
    const { rows } = await db.query(query, [idServico]);
    return rows[0].count > 0;
}

/**
 * Conta inscrições num serviço
 */
export async function contarInscricoesServico(idServico) {
    const query = `
    SELECT COUNT(*) as count
    FROM inscricoes
    WHERE id_servico = $1
  `;
    const { rows } = await db.query(query, [idServico]);
    return rows[0].count;
}

/**
 * Verifica se serviço tem lugar disponível
 */
export async function temLugarDisponivel(idServico) {
    const query = `
    SELECT
      s.capacidade_max,
      (SELECT COUNT(*) FROM inscricoes WHERE id_servico = $1) AS inscritos
    FROM servicos s
    WHERE s.id_servico = $1
  `;
    const { rows } = await db.query(query, [idServico]);

    if (!rows[0]) return false;

    const { capacidade_max, inscritos } = rows[0];
    return inscritos < capacidade_max;
}
