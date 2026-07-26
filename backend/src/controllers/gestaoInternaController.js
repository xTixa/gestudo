import { db } from '../config/db.js';
import {
    registarInsert,
    registarUpdate,
    registarDelete,
} from '../services/logService.js';

/**
 * ========================================
 * GestaoInterna CONTROLLER
 * ========================================
 * Fornece operações CRUD genéricas para dados de referência:
 * - Disciplinas
 * - Salas
 * - Modalidades
 * - Pacotes
 * ========================================
 */

/**
 * Cita identificadores de base de dados (tabelas, colunas) para evitar SQL injection
 * Envolve identificador em aspas duplas e escapa aspas internas
 *
 * @param {string} identifier - O identificador a processar
 * @returns {string} Identificador com citação SQL
 */
function quoteIdent(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

/**
 * Verifica se um erro de eliminação é causado por registos associados
 * (violação de FK RESTRICT/foreign key) e responde com uma mensagem clara.
 * Devolve true se o erro foi tratado (resposta já enviada).
 */
function respondIfRestrictedDelete(error, res, entidadeLabel) {
    if (error?.code === '23001' || error?.code === '23503') {
        res.status(409).json({
            message: `Não é possível eliminar ${entidadeLabel}: existem registos associados (serviços ou pacotes).`,
        });
        return true;
    }
    return false;
}

/**
 * Procura tabela em base de dados usando lista de nomes candidatos
 * Tenta match exato primeiro, depois match parcial da string
 *
 * @param {Array<string>} candidates - Lista de nomes a procurar
 * @returns {Object|null} Objecto com {table_schema, table_name} ou null se não encontrada
 */
async function findTableByCandidates(candidates) {
    const { rows } = await db.query(
        `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
    `
    );

    const normalizedCandidates = candidates.map((candidate) =>
        String(candidate).toLowerCase()
    );

    const exactMatch = rows.find((row) =>
        normalizedCandidates.includes(String(row.table_name).toLowerCase())
    );
    if (exactMatch) {
        return exactMatch;
    }

    const looseMatch = rows.find((row) => {
        const tableName = String(row.table_name).toLowerCase();
        return normalizedCandidates.some(
            (candidate) =>
                tableName.includes(candidate) || candidate.includes(tableName)
        );
    });

    return looseMatch || null;
}

/**
 * Operação genérica para listar dados de um catálogo/tabela
 * Encontra a tabela, executa SELECT * e retorna todos os registos
 *
 * @param {Array<string>} candidates - Nomes candidatos de tabela a procurar
 * @param {string} entityKey - Chave para retornar no JSON (ex: 'disciplinas', 'salas')
 * @param {Object} res - Objecto de resposta HTTP
 * @returns {JSON} Objecto com array de registos ou empty array
 */
async function listarCatalogo(candidates, entityKey, res) {
    try {
        const table = await findTableByCandidates(candidates);

        if (!table) {
            return res.status(200).json({ [entityKey]: [] });
        }

        const query = `
      SELECT *
      FROM ${quoteIdent(table.table_schema)}.${quoteIdent(table.table_name)}
      ORDER BY 1
    `;

        const { rows } = await db.query(query);
        return res.status(200).json({ [entityKey]: rows });
    } catch (error) {
        console.error(`Erro ao listar ${entityKey}:`, error.message);
        return res.status(500).json({ message: `Erro ao obter ${entityKey}.` });
    }
}

/**
 * Obtém lista de nomes de colunas de uma tabela
 *
 * @param {Object} table - Objecto com {table_schema, table_name}
 * @returns {Array<string>} Lista de nomes de colunas em lowercase
 */
async function getTableColumns(table) {
    const { rows } = await db.query(
        `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
        [table.table_schema, table.table_name]
    );

    return rows.map((row) => String(row.column_name).toLowerCase());
}

/**
 * Obtém nome da coluna de chave primária de uma tabela
 *
 * @param {Object} table - Objecto com {table_schema, table_name}
 * @returns {string|null} Nome da coluna de chave primária ou null se não encontrada
 */
async function getPrimaryKeyColumn(table) {
    const { rows } = await db.query(
        `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position
      LIMIT 1
    `,
        [table.table_schema, table.table_name]
    );

    return rows[0]?.column_name
        ? String(rows[0].column_name).toLowerCase()
        : null;
}

/**
 * Obtém informações sobre a tabela de modalidades (naming flexíbel)
 * Localiza nomes de colunas: nome, descrição, chave primária
 *
 * @returns {Object|null} Objecto com {table, columns, primaryKeyColumn, nomeColumn, descricaoColumn} ou null
 */
async function getModalidadesTableInfo() {
    const table = await findTableByCandidates(['modalidades', 'modalidade']);

    if (!table) {
        return null;
    }

    const columns = await getTableColumns(table);
    const primaryKeyColumn = await getPrimaryKeyColumn(table);

    const nomeColumn = ['nome', 'designacao', 'designação', 'titulo'].find(
        (candidate) => columns.includes(candidate)
    );
    const descricaoColumn = [
        'descricao',
        'descrição',
        'detalhe',
        'detalhes',
    ].find((candidate) => columns.includes(candidate));

    return {
        table,
        columns,
        primaryKeyColumn,
        nomeColumn,
        descricaoColumn,
    };
}

/**
 * Obtém informações sobre a tabela de salas (naming flexíbel)
 * Localiza nomes de colunas: nome, capacidade, chave primária
 *
 * @returns {Object|null} Objecto com {table, columns, primaryKeyColumn, nomeColumn, capacidadeColumn} ou null
 */
async function getSalasTableInfo() {
    const table = await findTableByCandidates(['salas', 'sala']);

    if (!table) {
        return null;
    }

    const columns = await getTableColumns(table);
    const primaryKeyColumn = await getPrimaryKeyColumn(table);

    const nomeColumn = ['nome', 'designacao', 'designação', 'titulo'].find(
        (candidate) => columns.includes(candidate)
    );
    const capacidadeColumn = ['capacidade', 'lotacao', 'lotação'].find(
        (candidate) => columns.includes(candidate)
    );

    return {
        table,
        columns,
        primaryKeyColumn,
        nomeColumn,
        capacidadeColumn,
    };
}

/**
 * Obtém informações sobre a tabela de disciplinas (naming flexíbel)
 * Localiza nomes de colunas: nome, nível_ensino, chave primária
 *
 * @returns {Object|null} Objecto com {table, columns, primaryKeyColumn, nomeColumn, nivelColumn} ou null
 */
async function getDisciplinasTableInfo() {
    const table = await findTableByCandidates(['disciplinas', 'disciplina']);

    if (!table) {
        return null;
    }

    const columns = await getTableColumns(table);
    const primaryKeyColumn = await getPrimaryKeyColumn(table);

    const nomeColumn = [
        'nome',
        'disciplina',
        'designacao',
        'designação',
        'titulo',
    ].find((candidate) => columns.includes(candidate));
    const nivelColumn = [
        'nivel_ensino',
        'id_nivel_ensino',
        'nivel_ensino_id',
        'nivel',
        'nivel_id',
        'id_nivel',
    ].find((candidate) => columns.includes(candidate));

    return {
        table,
        columns,
        primaryKeyColumn,
        nomeColumn,
        nivelColumn,
    };
}

export async function listarDisciplinasCatalogo(req, res) {
    return listarCatalogo(['disciplinas', 'disciplina'], 'disciplinas', res);
}

export async function listarSalasCatalogo(req, res) {
    return listarCatalogo(['salas', 'sala'], 'salas', res);
}

export async function listarModalidadesCatalogo(req, res) {
    return listarCatalogo(['modalidades', 'modalidade'], 'modalidades', res);
}

export async function listarPacotesCatalogo(req, res) {
    return listarCatalogo(['pacotes', 'pacote'], 'pacotes', res);
}

/**
 * Obtém informações sobre a tabela de pacotes (naming flexíbel)
 * Localiza nomes de colunas: nome, preço, horas, modalidade, disciplina, chave primária
 *
 * @returns {Object|null} Objecto com {table, columns, primaryKeyColumn, ...} ou null
 */
async function getPacotesTableInfo() {
    const table = await findTableByCandidates(['pacotes', 'pacote']);

    if (!table) {
        return null;
    }

    const columns = await getTableColumns(table);
    const primaryKeyColumn = await getPrimaryKeyColumn(table);

    const nomeColumn = ['nome', 'designacao', 'designação', 'titulo'].find(
        (candidate) => columns.includes(candidate)
    );
    const precoColumn = ['preco', 'preço', 'valor'].find((candidate) =>
        columns.includes(candidate)
    );
    const horasColumn = ['horas_mensais', 'horas', 'carga_horaria'].find(
        (candidate) => columns.includes(candidate)
    );
    const modalidadeColumn = ['id_modalidade', 'modalidade_id'].find(
        (candidate) => columns.includes(candidate)
    );
    const disciplinaColumn = ['id_disciplina', 'disciplina_id'].find(
        (candidate) => columns.includes(candidate)
    );
    const ativoColumn = ['ativo', 'status'].find((candidate) =>
        columns.includes(candidate)
    );

    return {
        table,
        columns,
        primaryKeyColumn,
        nomeColumn,
        precoColumn,
        horasColumn,
        modalidadeColumn,
        disciplinaColumn,
        ativoColumn,
    };
}

export async function criarPacoteCatalogo(req, res) {
    try {
        const info = await getPacotesTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de pacotes não encontrada.' });
        }

        if (!info.nomeColumn || !info.precoColumn) {
            return res.status(400).json({
                message:
                    'A tabela de pacotes não possui colunas de nome/preço.',
            });
        }

        const nome = String(req.body?.nome ?? '').trim();
        const precoRaw = req.body?.preco;
        const horasRaw = req.body?.horas;
        const idModalidadeRaw = req.body?.idModalidade;
        const idDisciplinaRaw = req.body?.idDisciplina;

        if (!nome) {
            return res
                .status(400)
                .json({ message: 'Nome do pacote é obrigatório.' });
        }

        const precoInformado = !(precoRaw === '' || precoRaw == null);
        const preco = precoInformado ? Number(precoRaw) : null;
        if (precoInformado && Number.isNaN(preco)) {
            return res
                .status(400)
                .json({ message: 'O preço deve ser um número válido.' });
        }

        const insertColumns = [info.nomeColumn, info.precoColumn];
        const insertValues = [nome, preco];

        if (info.horasColumn) {
            const horas =
                horasRaw === '' || horasRaw == null ? null : Number(horasRaw);
            if (
                horas != null &&
                (!Number.isInteger(horas) ||
                    horas % 2 !== 0 ||
                    horas < 4 ||
                    horas > 20)
            ) {
                return res.status(400).json({
                    message:
                        'Horas mensais inválidas. Deve ser um número par entre 4 e 20.',
                });
            }
            insertColumns.push(info.horasColumn);
            insertValues.push(horas);
        }

        if (info.modalidadeColumn) {
            insertColumns.push(info.modalidadeColumn);
            insertValues.push(
                idModalidadeRaw === '' || idModalidadeRaw == null
                    ? null
                    : Number(idModalidadeRaw)
            );
        }

        if (info.disciplinaColumn) {
            insertColumns.push(info.disciplinaColumn);
            insertValues.push(
                idDisciplinaRaw === '' || idDisciplinaRaw == null
                    ? null
                    : Number(idDisciplinaRaw)
            );
        }

        if (info.ativoColumn) {
            insertColumns.push(info.ativoColumn);
            insertValues.push(true);
        }

        const placeholders = insertValues.map((_, index) => `$${index + 1}`);
        const query = `
      INSERT INTO ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      (${insertColumns.map((column) => quoteIdent(column)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

        const { rows } = await db.query(query, insertValues);
        const novoRegisto = rows[0];

        await registarInsert(
            req.userId,
            'pacotes',
            novoRegisto,
            novoRegisto[info.primaryKeyColumn]
        );

        return res.status(201).json(novoRegisto);
    } catch (error) {
        console.error('Erro ao criar pacote:', error.message);
        return res.status(500).json({ message: 'Erro ao criar pacote.' });
    }
}

export async function atualizarPacoteCatalogo(req, res) {
    try {
        const info = await getPacotesTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de pacotes não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message: 'Não foi possível identificar a chave primária de pacotes.',
            });
        }

        const id = req.params.id;

        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res.status(404).json({ message: 'Pacote não encontrado.' });
        }
        const dadosAntigos = oldRows[0];

        const nome = String(req.body?.nome ?? '').trim();
        const precoRaw = req.body?.preco;
        const horasRaw = req.body?.horas;
        const idModalidadeRaw = req.body?.idModalidade;
        const idDisciplinaRaw = req.body?.idDisciplina;

        const setClauses = [];
        const values = [];

        if (info.nomeColumn && nome) {
            values.push(nome);
            setClauses.push(`${quoteIdent(info.nomeColumn)} = $${values.length}`);
        }

        if (info.precoColumn && precoRaw !== undefined) {
            const precoInformado = !(precoRaw === '' || precoRaw == null);
            const preco = precoInformado ? Number(precoRaw) : null;
            if (precoInformado && Number.isNaN(preco)) {
                return res.status(400).json({ message: 'Preço inválido.' });
            }
            values.push(preco);
            setClauses.push(`${quoteIdent(info.precoColumn)} = $${values.length}`);
        }

        if (info.horasColumn && horasRaw !== undefined) {
            const horas =
                horasRaw === '' || horasRaw == null ? null : Number(horasRaw);
            if (
                horas != null &&
                (!Number.isInteger(horas) ||
                    horas % 2 !== 0 ||
                    horas < 4 ||
                    horas > 20)
            ) {
                return res.status(400).json({
                    message:
                        'Horas mensais inválidas. Deve ser um número par entre 4 e 20.',
                });
            }
            values.push(horas);
            setClauses.push(`${quoteIdent(info.horasColumn)} = $${values.length}`);
        }

        if (info.modalidadeColumn && idModalidadeRaw !== undefined) {
            values.push(
                idModalidadeRaw === '' || idModalidadeRaw == null
                    ? null
                    : Number(idModalidadeRaw)
            );
            setClauses.push(
                `${quoteIdent(info.modalidadeColumn)} = $${values.length}`
            );
        }

        if (info.disciplinaColumn && idDisciplinaRaw !== undefined) {
            values.push(
                idDisciplinaRaw === '' || idDisciplinaRaw == null
                    ? null
                    : Number(idDisciplinaRaw)
            );
            setClauses.push(
                `${quoteIdent(info.disciplinaColumn)} = $${values.length}`
            );
        }

        if (!setClauses.length) {
            return res
                .status(400)
                .json({ message: 'Sem campos válidos para atualizar.' });
        }

        values.push(id);

        const query = `
      UPDATE ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      SET ${setClauses.join(', ')}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $${values.length}
      RETURNING *
    `;

        const { rows } = await db.query(query, values);

        await registarUpdate(req.userId, 'pacotes', id, dadosAntigos, rows[0]);

        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar pacote:', error.message);
        return res.status(500).json({ message: 'Erro ao atualizar pacote.' });
    }
}

export async function eliminarPacoteCatalogo(req, res) {
    try {
        const info = await getPacotesTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de pacotes não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message: 'Não foi possível identificar a chave primária de pacotes.',
            });
        }

        const id = req.params.id;

        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res.status(404).json({ message: 'Pacote não encontrado.' });
        }

        const query = `
      DELETE FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
      RETURNING *
    `;

        const { rows } = await db.query(query, [id]);

        await registarDelete(req.userId, 'pacotes', id, oldRows[0], 'alert');

        return res
            .status(200)
            .json({ message: 'Pacote eliminado com sucesso.' });
    } catch (error) {
        if (respondIfRestrictedDelete(error, res, 'o pacote')) return;
        console.error('Erro ao eliminar pacote:', error.message);
        return res.status(500).json({ message: 'Erro ao eliminar pacote.' });
    }
}

export async function criarDisciplinaCatalogo(req, res) {
    try {
        const info = await getDisciplinasTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de disciplinas não encontrada.' });
        }

        if (!info.nomeColumn) {
            return res.status(400).json({
                message: 'A tabela de disciplinas não possui coluna de nome.',
            });
        }

        const nome = String(req.body?.nome ?? '').trim();
        const nivelEnsino = req.body?.nivelEnsino;

        if (!nome) {
            return res
                .status(400)
                .json({ message: 'Nome da disciplina é obrigatório.' });
        }

        const insertColumns = [info.nomeColumn];
        const insertValues = [nome];

        if (info.nivelColumn) {
            insertColumns.push(info.nivelColumn);
            insertValues.push(
                nivelEnsino === '' || nivelEnsino == null ? null : nivelEnsino
            );
        }

        const placeholders = insertValues.map((_, index) => `$${index + 1}`);
        const query = `
      INSERT INTO ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      (${insertColumns.map((column) => quoteIdent(column)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

        const { rows } = await db.query(query, insertValues);
        const novoRegisto = rows[0];

        // Registar a ação no log
        await registarInsert(
            req.userId,
            'disciplinas',
            novoRegisto,
            novoRegisto[info.primaryKeyColumn]
        );

        return res.status(201).json(novoRegisto);
    } catch (error) {
        console.error('Erro ao criar disciplina:', error.message);
        return res.status(500).json({ message: 'Erro ao criar disciplina.' });
    }
}

export async function atualizarDisciplinaCatalogo(req, res) {
    try {
        const info = await getDisciplinasTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de disciplinas não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message:
                    'Não foi possível identificar a chave primária de disciplinas.',
            });
        }

        const id = req.params.id;

        // Buscar o registo antigo para logging
        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res
                .status(404)
                .json({ message: 'Disciplina não encontrada.' });
        }
        const dadosAntigos = oldRows[0];

        const nome = String(req.body?.nome ?? '').trim();
        const nivelEnsino = req.body?.nivelEnsino;

        const setClauses = [];
        const values = [];

        if (info.nomeColumn && nome) {
            values.push(nome);
            setClauses.push(
                `${quoteIdent(info.nomeColumn)} = $${values.length}`
            );
        }

        if (info.nivelColumn) {
            values.push(
                nivelEnsino === '' || nivelEnsino == null ? null : nivelEnsino
            );
            setClauses.push(
                `${quoteIdent(info.nivelColumn)} = $${values.length}`
            );
        }

        if (!setClauses.length) {
            return res
                .status(400)
                .json({ message: 'Sem campos válidos para atualizar.' });
        }

        values.push(id);

        const query = `
      UPDATE ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      SET ${setClauses.join(', ')}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $${values.length}
      RETURNING *
    `;

        const { rows } = await db.query(query, values);

        // Registar a ação no log
        await registarUpdate(
            req.userId,
            'disciplinas',
            id,
            dadosAntigos,
            rows[0]
        );

        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar disciplina:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar disciplina.' });
    }
}

export async function eliminarDisciplinaCatalogo(req, res) {
    try {
        const info = await getDisciplinasTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de disciplinas não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message:
                    'Não foi possível identificar a chave primária de disciplinas.',
            });
        }

        const id = req.params.id;

        // Buscar o registo antigo para logging
        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res
                .status(404)
                .json({ message: 'Disciplina não encontrada.' });
        }

        const query = `
      DELETE FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
      RETURNING *
    `;

        const { rows } = await db.query(query, [id]);

        // Registar a ação no log
        await registarDelete(
            req.userId,
            'disciplinas',
            id,
            oldRows[0],
            'alert'
        );

        return res
            .status(200)
            .json({ message: 'Disciplina eliminada com sucesso.' });
    } catch (error) {
        if (respondIfRestrictedDelete(error, res, 'a disciplina')) return;
        console.error('Erro ao eliminar disciplina:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao eliminar disciplina.' });
    }
}

export async function criarModalidadeCatalogo(req, res) {
    try {
        const info = await getModalidadesTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de modalidades não encontrada.' });
        }

        if (!info.nomeColumn) {
            return res.status(400).json({
                message: 'A tabela de modalidades não possui coluna de nome.',
            });
        }

        const nome = String(req.body?.nome ?? '').trim();
        const descricao = String(req.body?.descricao ?? '').trim();

        if (!nome) {
            return res
                .status(400)
                .json({ message: 'Nome da modalidade é obrigatório.' });
        }

        const insertColumns = [info.nomeColumn];
        const insertValues = [nome];

        if (info.descricaoColumn) {
            insertColumns.push(info.descricaoColumn);
            insertValues.push(descricao || null);
        }

        const placeholders = insertValues.map((_, index) => `$${index + 1}`);
        const query = `
      INSERT INTO ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      (${insertColumns.map((column) => quoteIdent(column)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

        const { rows } = await db.query(query, insertValues);
        const novoRegisto = rows[0];

        // Registar a ação no log
        await registarInsert(
            req.userId,
            'modalidades',
            novoRegisto,
            novoRegisto[info.primaryKeyColumn]
        );

        return res.status(201).json(novoRegisto);
    } catch (error) {
        console.error('Erro ao criar modalidade:', error.message);
        return res.status(500).json({ message: 'Erro ao criar modalidade.' });
    }
}

export async function atualizarModalidadeCatalogo(req, res) {
    try {
        const info = await getModalidadesTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de modalidades não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message:
                    'Não foi possível identificar a chave primária de modalidades.',
            });
        }

        const id = req.params.id;

        // Buscar o registo antigo para logging
        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res
                .status(404)
                .json({ message: 'Modalidade não encontrada.' });
        }
        const dadosAntigos = oldRows[0];

        const nome = String(req.body?.nome ?? '').trim();
        const descricao = String(req.body?.descricao ?? '').trim();

        const setClauses = [];
        const values = [];

        if (info.nomeColumn && nome) {
            values.push(nome);
            setClauses.push(
                `${quoteIdent(info.nomeColumn)} = $${values.length}`
            );
        }

        if (info.descricaoColumn) {
            values.push(descricao || null);
            setClauses.push(
                `${quoteIdent(info.descricaoColumn)} = $${values.length}`
            );
        }

        if (setClauses.length === 0) {
            return res
                .status(400)
                .json({ message: 'Sem campos válidos para atualizar.' });
        }

        values.push(id);

        const query = `
      UPDATE ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      SET ${setClauses.join(', ')}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $${values.length}
      RETURNING *
    `;

        const { rows } = await db.query(query, values);

        // Registar a ação no log
        await registarUpdate(
            req.userId,
            'modalidades',
            id,
            dadosAntigos,
            rows[0]
        );

        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar modalidade:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar modalidade.' });
    }
}

export async function eliminarModalidadeCatalogo(req, res) {
    try {
        const info = await getModalidadesTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de modalidades não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message:
                    'Não foi possível identificar a chave primária de modalidades.',
            });
        }

        const id = req.params.id;

        // Buscar o registo antigo para logging
        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res
                .status(404)
                .json({ message: 'Modalidade não encontrada.' });
        }

        const query = `
      DELETE FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
      RETURNING *
    `;

        const { rows } = await db.query(query, [id]);

        // Registar a ação no log
        await registarDelete(
            req.userId,
            'modalidades',
            id,
            oldRows[0],
            'alert'
        );

        return res
            .status(200)
            .json({ message: 'Modalidade eliminada com sucesso.' });
    } catch (error) {
        if (respondIfRestrictedDelete(error, res, 'a modalidade')) return;
        console.error('Erro ao eliminar modalidade:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao eliminar modalidade.' });
    }
}

export async function criarSalaCatalogo(req, res) {
    try {
        const info = await getSalasTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de salas não encontrada.' });
        }

        if (!info.nomeColumn) {
            return res.status(400).json({
                message: 'A tabela de salas não possui coluna de nome.',
            });
        }

        const nome = String(req.body?.nome ?? '').trim();
        const capacidadeRaw = req.body?.capacidade;

        if (!nome) {
            return res
                .status(400)
                .json({ message: 'Nome da sala é obrigatório.' });
        }

        const insertColumns = [info.nomeColumn];
        const insertValues = [nome];

        if (info.capacidadeColumn) {
            const capacidade =
                capacidadeRaw === '' || capacidadeRaw == null
                    ? null
                    : Number(capacidadeRaw);
            if (capacidade != null && Number.isNaN(capacidade)) {
                return res
                    .status(400)
                    .json({ message: 'Capacidade inválida.' });
            }

            insertColumns.push(info.capacidadeColumn);
            insertValues.push(capacidade);
        }

        const placeholders = insertValues.map((_, index) => `$${index + 1}`);
        const query = `
      INSERT INTO ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      (${insertColumns.map((column) => quoteIdent(column)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

        const { rows } = await db.query(query, insertValues);
        const novoRegisto = rows[0];

        // Registar a ação no log
        await registarInsert(
            req.userId,
            'salas',
            novoRegisto,
            novoRegisto[info.primaryKeyColumn]
        );

        return res.status(201).json(novoRegisto);
    } catch (error) {
        console.error('Erro ao criar sala:', error.message);
        return res.status(500).json({ message: 'Erro ao criar sala.' });
    }
}

export async function atualizarSalaCatalogo(req, res) {
    try {
        const info = await getSalasTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de salas não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message:
                    'Não foi possível identificar a chave primária de salas.',
            });
        }

        const id = req.params.id;

        // Buscar o registo antigo para logging
        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res.status(404).json({ message: 'Sala não encontrada.' });
        }
        const dadosAntigos = oldRows[0];

        const nome = String(req.body?.nome ?? '').trim();
        const capacidadeRaw = req.body?.capacidade;

        const setClauses = [];
        const values = [];

        if (info.nomeColumn && nome) {
            values.push(nome);
            setClauses.push(
                `${quoteIdent(info.nomeColumn)} = $${values.length}`
            );
        }

        if (info.capacidadeColumn) {
            const capacidade =
                capacidadeRaw === '' || capacidadeRaw == null
                    ? null
                    : Number(capacidadeRaw);
            if (capacidade != null && Number.isNaN(capacidade)) {
                return res
                    .status(400)
                    .json({ message: 'Capacidade inválida.' });
            }

            values.push(capacidade);
            setClauses.push(
                `${quoteIdent(info.capacidadeColumn)} = $${values.length}`
            );
        }

        if (setClauses.length === 0) {
            return res
                .status(400)
                .json({ message: 'Sem campos válidos para atualizar.' });
        }

        values.push(id);

        const query = `
      UPDATE ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      SET ${setClauses.join(', ')}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $${values.length}
      RETURNING *
    `;

        const { rows } = await db.query(query, values);

        // Registar a ação no log
        await registarUpdate(req.userId, 'salas', id, dadosAntigos, rows[0]);

        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar sala:', error.message);
        return res.status(500).json({ message: 'Erro ao atualizar sala.' });
    }
}

export async function eliminarSalaCatalogo(req, res) {
    try {
        const info = await getSalasTableInfo();
        if (!info) {
            return res
                .status(404)
                .json({ message: 'Tabela de salas não encontrada.' });
        }

        if (!info.primaryKeyColumn) {
            return res.status(400).json({
                message:
                    'Não foi possível identificar a chave primária de salas.',
            });
        }

        const id = req.params.id;

        // Buscar o registo antigo para logging
        const selectQuery = `
      SELECT * FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
    `;
        const { rows: oldRows } = await db.query(selectQuery, [id]);
        if (!oldRows.length) {
            return res.status(404).json({ message: 'Sala não encontrada.' });
        }

        const query = `
      DELETE FROM ${quoteIdent(info.table.table_schema)}.${quoteIdent(info.table.table_name)}
      WHERE ${quoteIdent(info.primaryKeyColumn)} = $1
      RETURNING *
    `;

        const { rows } = await db.query(query, [id]);

        // Registar a ação no log
        await registarDelete(req.userId, 'salas', id, oldRows[0], 'alert');

        return res.status(200).json({ message: 'Sala eliminada com sucesso.' });
    } catch (error) {
        if (respondIfRestrictedDelete(error, res, 'a sala')) return;
        console.error('Erro ao eliminar sala:', error.message);
        return res.status(500).json({ message: 'Erro ao eliminar sala.' });
    }
}
