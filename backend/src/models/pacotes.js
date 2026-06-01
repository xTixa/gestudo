import { db } from '../config/db.js';

/**
 * MODEL: Pacotes
 * Operações de dados para tabela pacotes (planos de preços)
 *
 * Schema:
 * - id_pacote (PK): Identificador único
 * - id_disciplina (FK): Disciplina associada
 * - id_modalidade (FK): Modalidade associada
 * - preco: Valor do pacote
 * - descricao: Descrição do pacote
 * - ativo: Status do pacote
 * - created_at: Data de criação
 */

// =============== CREATE ===============

/**
 * Cria novo pacote de preços
 */
export async function criarPacote(
    idDisciplina,
    idModalidade,
    preco,
    descricao = '',
    ativo = true
) {
    const query = `
    INSERT INTO pacotes (id_disciplina, id_modalidade, preco, descricao, ativo)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_pacote, id_disciplina, id_modalidade, preco, descricao, ativo, created_at
  `;
    const { rows } = await db.query(query, [
        idDisciplina,
        idModalidade,
        preco,
        descricao,
        ativo,
    ]);
    return rows[0];
}

// =============== READ ===============

/**
 * Obtém pacote por ID
 */
export async function obterPacote(idPacote) {
    const query = `
    SELECT
      p.id_pacote, p.id_disciplina, p.id_modalidade, p.preco, p.descricao, p.ativo,
      d.nome AS disciplina, m.nome AS modalidade,
      p.created_at
    FROM pacotes p
    LEFT JOIN disciplinas d ON d.id_disciplina = p.id_disciplina
    LEFT JOIN modalidades m ON m.id_modalidade = p.id_modalidade
    WHERE p.id_pacote = $1
  `;
    const { rows } = await db.query(query, [idPacote]);
    return rows[0];
}

/**
 * Lista todos os pacotes
 */
export async function listarPacotes() {
    const query = `
    SELECT
      p.id_pacote, p.id_disciplina, p.id_modalidade, p.preco, p.descricao, p.ativo,
      d.nome AS disciplina, m.nome AS modalidade
    FROM pacotes p
    LEFT JOIN disciplinas d ON d.id_disciplina = p.id_disciplina
    LEFT JOIN modalidades m ON m.id_modalidade = p.id_modalidade
    ORDER BY p.preco DESC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Lista pacotes ativos
 */
export async function listarPacotesAtivos() {
    const query = `
    SELECT * FROM pacotes
    WHERE COALESCE(ativo, true) = true
    ORDER BY preco DESC
  `;
    const { rows } = await db.query(query);
    return rows;
}

/**
 * Obtém pacote por disciplina e modalidade
 */
export async function obterPacotePorDisciplinaModalidade(
    idDisciplina,
    idModalidade
) {
    const query = `
    SELECT * FROM pacotes
    WHERE id_disciplina = $1 AND id_modalidade = $2
      AND COALESCE(ativo, true) = true
    LIMIT 1
  `;
    const { rows } = await db.query(query, [idDisciplina, idModalidade]);
    return rows[0];
}

/**
 * Lista pacotes de uma disciplina
 */
export async function listarPacotesPorDisciplina(idDisciplina) {
    const query = `
    SELECT * FROM pacotes
    WHERE id_disciplina = $1 AND COALESCE(ativo, true) = true
    ORDER BY preco ASC
  `;
    const { rows } = await db.query(query, [idDisciplina]);
    return rows;
}

/**
 * Lista pacotes de uma modalidade
 */
export async function listarPacotesPorModalidade(idModalidade) {
    const query = `
    SELECT * FROM pacotes
    WHERE id_modalidade = $1 AND COALESCE(ativo, true) = true
    ORDER BY preco ASC
  `;
    const { rows } = await db.query(query, [idModalidade]);
    return rows;
}

/**
 * Lista pacotes num intervalo de preços
 */
export async function listarPacotesEntrePRecos(precoMin, precoMax) {
    const query = `
    SELECT * FROM pacotes
    WHERE preco >= $1 AND preco <= $2
      AND COALESCE(ativo, true) = true
    ORDER BY preco ASC
  `;
    const { rows } = await db.query(query, [precoMin, precoMax]);
    return rows;
}

// =============== UPDATE ===============

/**
 * Atualiza dados de pacote
 */
export async function atualizarPacote(idPacote, dados) {
    const { id_disciplina, id_modalidade, preco, descricao, ativo } = dados;

    const setClauses = [];
    const values = [];

    if (id_disciplina !== undefined) {
        values.push(id_disciplina);
        setClauses.push(`id_disciplina = $${values.length}`);
    }
    if (id_modalidade !== undefined) {
        values.push(id_modalidade);
        setClauses.push(`id_modalidade = $${values.length}`);
    }
    if (preco !== undefined) {
        values.push(preco);
        setClauses.push(`preco = $${values.length}`);
    }
    if (descricao !== undefined) {
        values.push(descricao);
        setClauses.push(`descricao = $${values.length}`);
    }
    if (ativo !== undefined) {
        values.push(ativo);
        setClauses.push(`ativo = $${values.length}`);
    }

    if (setClauses.length === 0) return null;

    values.push(idPacote);

    const query = `
    UPDATE pacotes
    SET ${setClauses.join(', ')}
    WHERE id_pacote = $${values.length}
    RETURNING *
  `;

    const { rows } = await db.query(query, values);
    return rows[0];
}

/**
 * Altera preço de pacote
 */
export async function alterarPrecoPacote(idPacote, novoPreco) {
    const query = `
    UPDATE pacotes
    SET preco = $1
    WHERE id_pacote = $2
    RETURNING id_pacote, preco
  `;
    const { rows } = await db.query(query, [novoPreco, idPacote]);
    return rows[0];
}

/**
 * Altera status de pacote
 */
export async function alterarStatusPacote(idPacote, ativo) {
    const query = `
    UPDATE pacotes
    SET ativo = $1
    WHERE id_pacote = $2
    RETURNING id_pacote, ativo
  `;
    const { rows } = await db.query(query, [ativo, idPacote]);
    return rows[0];
}

// =============== DELETE ===============

/**
 * Remove pacote (soft delete)
 */
export async function removerPacote(idPacote) {
    const query = `
    UPDATE pacotes
    SET ativo = false
    WHERE id_pacote = $1
    RETURNING id_pacote
  `;
    const { rows } = await db.query(query, [idPacote]);
    return rows[0];
}

/**
 * Remove pacote permanentemente
 */
export async function removerPacotePermanente(idPacote) {
    const query = `DELETE FROM pacotes WHERE id_pacote = $1 RETURNING id_pacote`;
    const { rows } = await db.query(query, [idPacote]);
    return rows[0];
}

// =============== VALIDAÇÕES ===============

/**
 * Verifica se pacote existe
 */
export async function pacoteExiste(idPacote) {
    const query = `SELECT COUNT(*) as count FROM pacotes WHERE id_pacote = $1`;
    const { rows } = await db.query(query, [idPacote]);
    return rows[0].count > 0;
}

/**
 * Obtém preço médio dos pacotes
 */
export async function obterPrecoMedioPacotes() {
    const query = `
    SELECT AVG(preco) as preco_medio FROM pacotes
    WHERE COALESCE(ativo, true) = true
  `;
    const { rows } = await db.query(query);
    return rows[0].preco_medio || 0;
}
