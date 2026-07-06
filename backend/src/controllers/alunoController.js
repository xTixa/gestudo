import { db } from '../config/db.js';
import bcrypt from 'bcryptjs';
import {
    enviarEmailCredenciaisIniciais,
    enviarEmailContaCriadaEE,
    enviarEmailRecuperacaoPassword,
    enviarEmailRecuperacaoPasswordEE,
} from '../services/emailService.js';
import {
    registarDelete,
    registarInsert,
    registarUpdate,
} from '../services/logService.js';
import { notificarGestoresCriacaoConta } from '../services/alertasDispatchService.js';

/**
 * ========================================
 * ALUNO CONTROLLER
 * ========================================
 * Responsável pela gestão de alunos (estudantes) no sistema.
 * ========================================
 */

/**
 * GET /api/alunos
 * Lista todos os alunos registados no sistema
 */

function gerarPasswordTemporaria() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `Temp@${dia}${mes}${ano}`;
}

function gerarCartaoCidadaoPlaceholder(prefix = 'ND') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

function toNullableText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function toSqlDateOrNull(value) {
    if (value == null || value === '') {
        return null;
    }

    const parsed = new Date(String(value).trim());
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

function isFutureSqlDate(dateText) {
    if (!dateText) return false;
    const today = new Date().toISOString().slice(0, 10);
    return dateText > today;
}

function getDuplicateErrorMessage(error) {
    const constraint = String(error?.constraint || '').toLowerCase();
    const detail = String(error?.detail || '').toLowerCase();

    if (constraint.includes('users') && constraint.includes('email')) {
        return 'Já existe um utilizador com este email.';
    }

    if (constraint.includes('pessoas') && constraint.includes('nif')) {
        return 'Já existe uma pessoa registada com este NIF.';
    }

    if (detail.includes('(email)')) {
        return 'Já existe um utilizador com este email.';
    }

    if (detail.includes('(nif)')) {
        return 'Já existe uma pessoa registada com este NIF.';
    }

    return 'Já existe um registo com os dados fornecidos.';
}

async function getAllowedUserRoles(client) {
    try {
        const { rows } = await client.query(
            `
                SELECT pg_get_constraintdef(c.oid) AS constraint_def
                FROM pg_constraint c
                INNER JOIN pg_class t ON t.oid = c.conrelid
                INNER JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE c.contype = 'c'
                  AND n.nspname = 'public'
                  AND t.relname = 'users'
                  AND c.conname = 'users_role_check'
                LIMIT 1
            `
        );

        const constraintDef = String(rows?.[0]?.constraint_def || '');
        const matches = constraintDef.matchAll(/'([^']+)'/g);
        const parsedRoles = [...matches].map((match) => match[1]);

        return new Set(parsedRoles);
    } catch {
        return new Set();
    }
}

async function resolveGuardianUserRole(client) {
    const allowedRoles = await getAllowedUserRoles(client);
    const preferredOrder = [
        'encarregado',
        'aluno',
        'professor',
        'gestor',
        'admin',
    ];

    for (const role of preferredOrder) {
        if (allowedRoles.has(role)) {
            return role;
        }
    }

    if (allowedRoles.size > 0) {
        return Array.from(allowedRoles)[0];
    }

    return 'aluno';
}

async function resolveInscricoesServicoColumn(client) {
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

async function getTableColumns(client, tableName) {
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

function pickFirstColumn(columns, candidates) {
    for (const candidate of candidates) {
        const normalized = String(candidate || '').toLowerCase();
        if (columns.includes(normalized)) {
            return normalized;
        }
    }

    return null;
}

function quoteIdent(identifier) {
    return `"${String(identifier || '').replaceAll('"', '""')}"`;
}

async function deleteDependentRowsByFk(
    client,
    targetTable,
    targetColumn,
    targetValue
) {
    const { rows } = await client.query(
        `
            SELECT
                nsp.nspname AS schema_name,
                cls.relname AS table_name,
                att_child.attname AS child_column,
                att_parent.attname AS parent_column
            FROM pg_constraint c
            INNER JOIN pg_class cls ON cls.oid = c.conrelid
            INNER JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
            INNER JOIN pg_attribute att_child
                ON att_child.attrelid = c.conrelid
               AND att_child.attnum = c.conkey[1]
            INNER JOIN pg_attribute att_parent
                ON att_parent.attrelid = c.confrelid
               AND att_parent.attnum = c.confkey[1]
            WHERE c.contype = 'f'
              AND array_length(c.conkey, 1) = 1
              AND array_length(c.confkey, 1) = 1
              AND c.confrelid = $1::regclass
              AND att_parent.attname = $2
              AND nsp.nspname = 'public'
        `,
        [targetTable, targetColumn]
    );

    for (const row of rows) {
        const tableName = String(row.table_name || '').trim();
        const childColumn = String(row.child_column || '').trim();

        if (!tableName || !childColumn) {
            continue;
        }

        const query = `
            DELETE FROM ${quoteIdent(tableName)}
            WHERE ${quoteIdent(childColumn)} = $1
        `;

        await client.query(query, [targetValue]);
    }
}

function sanitizeSavepointName(rawName) {
    const normalized = String(rawName || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || 'sp_delete';
}

async function deleteByIdSafely(client, tableName, idColumn, idValue) {
    if (idValue === null || idValue === undefined) {
        return false;
    }

    const savepoint = sanitizeSavepointName(`sp_${tableName}_${idColumn}`);

    await client.query(`SAVEPOINT ${savepoint}`);

    try {
        const result = await client.query(
            `
                DELETE FROM ${quoteIdent(tableName)}
                WHERE ${quoteIdent(idColumn)} = $1
            `,
            [idValue]
        );

        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return result.rowCount > 0;
    } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);

        if (error?.code === '23503') {
            return false;
        }

        throw error;
    }
}

function pickLikelyIdColumn(columns) {
    const list = Array.isArray(columns)
        ? columns.map((column) => String(column || '').toLowerCase())
        : [];

    return (
        pickFirstColumn(list, ['id_area_extracurricular', 'id_area', 'id']) ||
        list.find((column) => /^id_/.test(column) || column.endsWith('_id')) ||
        null
    );
}

function pickLikelyNameColumn(columns) {
    const list = Array.isArray(columns)
        ? columns.map((column) => String(column || '').toLowerCase())
        : [];

    return (
        pickFirstColumn(list, [
            'nome',
            'area',
            'descricao',
            'designacao',
            'nome_area',
            'nomearea',
            'titulo',
        ]) ||
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
        ) ||
        null
    );
}

function pickLikelyActiveColumn(columns) {
    const list = Array.isArray(columns)
        ? columns.map((column) => String(column || '').toLowerCase())
        : [];

    return pickFirstColumn(list, ['ativa', 'ativo', 'is_active', 'active']);
}

async function resolveExtraAreaMetadata(client) {
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

async function resolvePacotesDescricaoColumn(client) {
    const pacoteColumns = await getTableColumns(client, 'pacotes').catch(
        () => []
    );

    return pickFirstColumn(pacoteColumns, [
        'descricao',
        'nome',
        'designacao',
        'titulo',
    ]);
}

async function resolveServicoExtraPrecoColumn(client) {
    const extraColumns = await getTableColumns(
        client,
        'servicos_extracurriculares'
    ).catch(() => []);

    return pickFirstColumn(extraColumns, [
        'preco',
        'valor',
        'preco_base',
        'custo',
        'price',
    ]);
}

async function carregarPerfilAlunoPorIdAluno(executor, idAluno) {
    const alunoQuery = `
		SELECT
			a.id_aluno,
			a.id_user,
			a.id_pessoa,
			a.id_encarregado,
			a.escola,
			a.ano,
			a.turma
		FROM alunos a
		WHERE a.id_aluno = $1
		LIMIT 1
	`;

    const pessoaQuery = `
		SELECT
			p.id_pessoa,
			p.nome,
			p.data_nasc,
			p.cc,
			p.nif,
			p.morada,
			p.localidade,
			p.cod_postal,
			p.telemovel,
			p.telefone,
			p.created_at
		FROM pessoas p
		WHERE p.id_pessoa = $1
	`;

    const userQuery = `
		SELECT
			u.id_user,
			u.email,
            u.imagem_perfil_url,
			u.role,
			u.status,
			u.created_at
		FROM users u
		WHERE u.id_user = $1
	`;

    const encarregadoQuery = `
		SELECT
			e.id_encarregado,
			e.id_pessoa,
			e.parentesco,
			p.nome,
			p.data_nasc,
			p.cc,
			p.nif,
			p.morada,
			p.localidade,
			p.cod_postal,
			p.telemovel,
			p.telefone,
			u.id_user,
			u.email,
            u.imagem_perfil_url,
			u.role
		FROM encarregados e
		INNER JOIN pessoas p ON p.id_pessoa = e.id_pessoa
		LEFT JOIN users u ON u.id_user = e.id_user
		WHERE e.id_encarregado = $1
	`;

    const alunoResult = await executor.query(alunoQuery, [idAluno]);
    if (!alunoResult.rows.length) {
        return null;
    }

    const aluno = alunoResult.rows[0];
    const pessoaResult = await executor.query(pessoaQuery, [aluno.id_pessoa]);
    const userResult = await executor.query(userQuery, [aluno.id_user]);
    const encarregadoResult = await executor.query(encarregadoQuery, [
        aluno.id_encarregado,
    ]);

    const pessoa = pessoaResult.rows[0] || null;
    const user = userResult.rows[0] || null;
    const encarregado = encarregadoResult.rows[0]
        ? {
              id_encarregado: encarregadoResult.rows[0].id_encarregado,
              parentesco: encarregadoResult.rows[0].parentesco,
              pessoa: {
                  id_pessoa: encarregadoResult.rows[0].id_pessoa,
                  nome: encarregadoResult.rows[0].nome,
                  data_nasc: encarregadoResult.rows[0].data_nasc,
                  cc: encarregadoResult.rows[0].cc,
                  nif: encarregadoResult.rows[0].nif,
                  morada: encarregadoResult.rows[0].morada,
                  localidade: encarregadoResult.rows[0].localidade,
                  cod_postal: encarregadoResult.rows[0].cod_postal,
                  telemovel: encarregadoResult.rows[0].telemovel,
                  telefone: encarregadoResult.rows[0].telefone,
                  user: encarregadoResult.rows[0].id_user
                      ? {
                            id_user: encarregadoResult.rows[0].id_user,
                            email: encarregadoResult.rows[0].email,
                            imagem_perfil_url:
                                encarregadoResult.rows[0].imagem_perfil_url ||
                                null,
                            role: encarregadoResult.rows[0].role,
                        }
                      : null,
              },
          }
        : null;

    const servicosSubscritos = [];
    const inscricoesColumns = await getTableColumns(
        executor,
        'inscricoes'
    ).catch(() => []);
    const pacoteDescricaoColumn = await resolvePacotesDescricaoColumn(executor);
    const pacoteDescricaoSelect = pacoteDescricaoColumn
        ? `p.${pacoteDescricaoColumn}`
        : 'NULL::text';
    const inscricoesServicoColumn =
        await resolveInscricoesServicoColumn(executor);
    const inscricoesExtraServicoColumn = pickFirstColumn(inscricoesColumns, [
        'id_servico_extracurricular',
        'id_servico_extra_curricular',
        'id_servico_extra',
        'servico_extra_id',
        'id_servicos_extra',
        'id_servicoextra',
    ]);

    if (inscricoesServicoColumn) {
        const servicosQuery = `
			SELECT
				s.id_servico,
				COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço') AS tipo_servico,
				COALESCE(m.nome, 'Sem modalidade') AS modalidade,
				COALESCE(d.nome, 'Sem disciplina') AS disciplina,
				s.data_inicio,
				s.hora_inicio,
				s.hora_fim,
				i.data_inscricao,
				COALESCE(i.valor_final, p.preco) AS valor,
				p.id_pacote,
                ${pacoteDescricaoSelect} AS pacote_descricao,
				'curricular' AS origem
			FROM inscricoes i
			INNER JOIN servicos_curriculares s ON s.id_servico = i.${inscricoesServicoColumn}
			LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
			LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
			LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
			LEFT JOIN pacotes p ON p.id_pacote = i.id_pacote
			WHERE i.id_aluno = $1::int
			  AND LOWER(COALESCE(i.estado, '')) = 'ativa'
			ORDER BY i.data_inscricao DESC, s.data_inicio DESC, s.id_servico DESC
		`;

        const servicosResult = await executor.query(servicosQuery, [idAluno]);
        servicosSubscritos.push(
            ...servicosResult.rows.map((row) => ({
                id_servico: row.id_servico,
                tipoServico: row.tipo_servico,
                modalidade: row.modalidade,
                disciplina: row.disciplina,
                dataInicio: row.data_inicio,
                horaInicio: row.hora_inicio,
                horaFim: row.hora_fim,
                dataInscricao: row.data_inscricao,
                valor: row.valor,
                idPacote: row.id_pacote,
                pacoteDescricao: row.pacote_descricao,
                origem: row.origem,
            }))
        );
    }

    if (inscricoesExtraServicoColumn) {
        const extraAreaMetadata = await resolveExtraAreaMetadata(executor);
        const extraPrecoColumn = await resolveServicoExtraPrecoColumn(executor);
        const extraPrecoSelect = extraPrecoColumn
            ? `s.${extraPrecoColumn}`
            : 'NULL::numeric';
        const extraAreaTextSelect = extraAreaMetadata.serviceAreaTextColumn
            ? `s.${extraAreaMetadata.serviceAreaTextColumn}`
            : 'NULL::text';
        const extraAreaJoin =
            extraAreaMetadata.areaTableExists &&
            extraAreaMetadata.serviceAreaColumn
                ? `LEFT JOIN areas_extracurriculares a ON a.${extraAreaMetadata.areaIdColumn} = s.${extraAreaMetadata.serviceAreaColumn}`
                : extraAreaMetadata.areaTableExists &&
                    extraAreaMetadata.serviceAreaTextColumn
                  ? `LEFT JOIN areas_extracurriculares a ON LOWER(a.${extraAreaMetadata.areaNomeColumn}) = LOWER(COALESCE(s.${extraAreaMetadata.serviceAreaTextColumn}, ''))`
                  : '';
        const extraAreaSelect =
            extraAreaMetadata.areaTableExists &&
            extraAreaMetadata.areaNomeColumn
                ? `COALESCE(NULLIF(a.${extraAreaMetadata.areaNomeColumn}, ''), NULLIF(${extraAreaTextSelect}, ''), 'Sem área') AS area`
                : `COALESCE(NULLIF(${extraAreaTextSelect}, ''), 'Sem área') AS area`;

        const extraQuery = `
			SELECT
				s.id_servico,
				COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço Extra') AS tipo_servico,
				COALESCE(m.nome, 'Sem modalidade') AS modalidade,
				${extraAreaSelect},
				s.data_inicio,
				s.hora_inicio,
				s.hora_fim,
				i.data_inscricao,
                COALESCE(i.valor_final, ${extraPrecoSelect}) AS valor,
				s.id_sala,
				NULL::text AS pacote_descricao,
				'extra' AS origem
			FROM inscricoes i
			INNER JOIN servicos_extracurriculares s ON s.id_servico = i.${inscricoesExtraServicoColumn}
			LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
			LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
			${extraAreaJoin}
			WHERE i.id_aluno = $1::int
			  AND LOWER(COALESCE(i.estado, '')) = 'ativa'
			ORDER BY i.data_inscricao DESC, s.data_inicio DESC, s.id_servico DESC
		`;

        const extraResult = await executor.query(extraQuery, [idAluno]);
        servicosSubscritos.push(
            ...extraResult.rows.map((row) => ({
                id_servico: row.id_servico,
                tipoServico: row.tipo_servico,
                modalidade: row.modalidade,
                disciplina: row.area || row.tipo_servico,
                area: row.area,
                dataInicio: row.data_inicio,
                horaInicio: row.hora_inicio,
                horaFim: row.hora_fim,
                dataInscricao: row.data_inscricao,
                valor: row.valor,
                idPacote: null,
                pacoteDescricao: row.pacote_descricao,
                origem: row.origem,
            }))
        );
    }

    return {
        id_aluno: aluno.id_aluno,
        id_user: aluno.id_user,
        id_pessoa: aluno.id_pessoa,
        id_encarregado: aluno.id_encarregado,
        escola: aluno.escola,
        ano: aluno.ano,
        turma: aluno.turma,
        pessoa,
        user,
        encarregado,
        encarregado_nome: encarregado?.pessoa?.nome || '',
        encarregado_parentesco: encarregado?.parentesco || '',
        encarregado_morada: encarregado?.pessoa?.morada || '',
        encarregado_localidade: encarregado?.pessoa?.localidade || '',
        encarregado_cod_postal: encarregado?.pessoa?.cod_postal || '',
        encarregado_email: encarregado?.pessoa?.user?.email || '',
        servicosSubscritos,
    };
}

/**
 * ========================================
 * ALUNO CONTROLLER
 * ========================================
 * Responsável pela gestão de alunos (estudantes) no sistema.
 * Fornece operações para listar, criar, atualizar e remover dados de alunos.
 *
 * Principais funções:
 * - listarAlunos: Retorna lista completa de alunos com dados pessoais, contacto e encarregado
 * ========================================
 */

/**
 * Lista todos os alunos registados no sistema
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Array de alunos com dados completos (ID, nome, ano, turma, escola, encarregado, contacto, email)
 */
export async function listarAlunos(req, res) {
    try {
        const query = `
            SELECT
                a.id_aluno,
                a.id_user,
                p.nome,
                p.nif,
                p.data_nasc AS data_nascimento,
                p.cc,
                p.morada,
                p.localidade,
                p.cod_postal,
                p.telemovel AS contacto,
                p.telefone,
                a.ano,
                a.turma,
                a.escola,
                pe.nome AS encarregado,
                pe.telemovel AS ee_contacto,
                e.parentesco AS ee_parentesco,
                ue.email AS ee_email,
                COALESCE(a.data_inicio, u.created_at::date) AS data_inicio,
                u.email,
                u.imagem_perfil_url,
                u.status
            FROM alunos a
            INNER JOIN users u ON u.id_user = a.id_user
            INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
            INNER JOIN pessoas pe ON pe.id_pessoa = e.id_pessoa
            LEFT JOIN users ue ON ue.id_user = e.id_user
            ORDER BY p.nome ASC
        `;

        const { rows } = await db.query(query);
        return res.status(200).json({ alunos: rows });
    } catch (error) {
        console.error('Erro ao listar alunos:', error.message);
        return res.status(500).json({ message: 'Erro ao obter alunos.' });
    }
}

export async function criarAluno(req, res) {
    const {
        nome_completo,
        cartao_cidadao,
        nif,
        morada,
        localidade,
        codigo_postal,
        data_nascimento,
        telemovel,
        telefone,
        ano_escolar,
        turma,
        escola,
        email,
        ee_nome_completo,
        ee_email,
        ee_cartao_cidadao,
        ee_nif,
        ee_morada,
        ee_localidade,
        ee_codigo_postal,
        ee_telemovel,
        ee_telefone,
        ee_parentesco,
    } = req.body || {};

    const alunoNome = String(nome_completo || '').trim();
    const alunoEmail = String(email || '')
        .trim()
        .toLowerCase();
    const encarregadoNome = String(ee_nome_completo || '').trim();
    const encarregadoNif = String(ee_nif || '').trim();
    const encarregadoEmail = String(ee_email || '')
        .trim()
        .toLowerCase();
    const dataNascimentoAluno = toSqlDateOrNull(data_nascimento);

    if (!alunoNome || !alunoEmail || !encarregadoNome) {
        return res.status(400).json({
            message:
                'Nome do aluno, email do aluno e nome do encarregado são obrigatórios.',
        });
    }

    if (!dataNascimentoAluno) {
        return res.status(400).json({
            message:
                'Data de nascimento do aluno é obrigatória e deve ser válida.',
        });
    }

    if (isFutureSqlDate(dataNascimentoAluno)) {
        return res.status(400).json({
            message: 'Data de nascimento do aluno não pode ser no futuro.',
        });
    }

    const client = await db.connect();
    let idAluno = null;
    let credenciais = null;

    try {
        await client.query('BEGIN');

        const existingUser = await client.query(
            `SELECT id_user FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [alunoEmail]
        );

        if (existingUser.rows.length) {
            await client.query('ROLLBACK');
            return res
                .status(400)
                .json({ message: 'Já existe um utilizador com esse email.' });
        }

        const passwordTemporaria = gerarPasswordTemporaria();
        const passwordHash = await bcrypt.hash(passwordTemporaria, 10);

        const userResult = await client.query(
            `
				INSERT INTO users (email, password, role, status, primeira_login)
				VALUES ($1, $2, 'aluno', true, true)
				RETURNING id_user, email, created_at, status
			`,
            [alunoEmail, passwordHash]
        );

        const pessoaAlunoResult = await client.query(
            `
				INSERT INTO pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel, telefone)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				RETURNING id_pessoa
			`,
            [
                alunoNome,
                dataNascimentoAluno,
                String(cartao_cidadao || '').trim() || null,
                String(nif || '').trim() || null,
                String(morada || '').trim() || null,
                String(localidade || '').trim() || null,
                String(codigo_postal || '').trim() || null,
                String(telemovel || '').trim() || null,
                String(telefone || '').trim() || null,
            ]
        );

        let idEncarregado = null;

        if (encarregadoNif) {
            const encarregadoExistente = await client.query(
                `
					SELECT e.id_encarregado
					FROM encarregados e
					INNER JOIN pessoas p ON p.id_pessoa = e.id_pessoa
					WHERE p.nif = $1
					LIMIT 1
				`,
                [encarregadoNif]
            );

            if (encarregadoExistente.rows.length) {
                idEncarregado = encarregadoExistente.rows[0].id_encarregado;
            }
        }

        if (!idEncarregado) {
            const guardianUserRole = await resolveGuardianUserRole(client);
            const guardianEmail =
                encarregadoEmail ||
                `encarregado.aluno.${Date.now()}@placeholder.local`;

            let idUserEncarregado = null;

            const guardianUserExisting = await client.query(
                `SELECT id_user FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
                [guardianEmail]
            );

            if (guardianUserExisting.rows.length) {
                idUserEncarregado = guardianUserExisting.rows[0].id_user;
            } else {
                const guardianTempPassword = gerarPasswordTemporaria();
                const guardianPasswordHash = await bcrypt.hash(
                    guardianTempPassword,
                    10
                );

                const guardianUserResult = await client.query(
                    `
                        INSERT INTO users (email, password, role, status, primeira_login)
                        VALUES ($1, $2, $3, true, true)
                        RETURNING id_user
                    `,
                    [guardianEmail, guardianPasswordHash, guardianUserRole]
                );

                idUserEncarregado = guardianUserResult.rows[0].id_user;
            }

            const pessoaEncarregadoResult = await client.query(
                `
					INSERT INTO pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel, telefone)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
					RETURNING id_pessoa
				`,
                [
                    encarregadoNome,
                    '1980-01-01',
                    toNullableText(ee_cartao_cidadao) ||
                        gerarCartaoCidadaoPlaceholder('EE'),
                    encarregadoNif || null,
                    String(ee_morada || '').trim() || null,
                    String(ee_localidade || '').trim() || null,
                    String(ee_codigo_postal || '').trim() || null,
                    String(ee_telemovel || '').trim() || null,
                    String(ee_telefone || '').trim() || null,
                ]
            );

            const encarregadoResult = await client.query(
                `
					INSERT INTO encarregados (id_user, id_pessoa, parentesco)
					VALUES ($1, $2, $3)
					RETURNING id_encarregado
				`,
                [
                    idUserEncarregado,
                    pessoaEncarregadoResult.rows[0].id_pessoa,
                    String(ee_parentesco || '').trim() || null,
                ]
            );

            idEncarregado = encarregadoResult.rows[0].id_encarregado;
        }

        const alunoResult = await client.query(
            `
				INSERT INTO alunos (id_user, id_pessoa, id_encarregado, ano, turma, escola)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id_aluno, id_user, id_pessoa, id_encarregado, ano, turma, escola
			`,
            [
                userResult.rows[0].id_user,
                pessoaAlunoResult.rows[0].id_pessoa,
                idEncarregado,
                ano_escolar == null || ano_escolar === ''
                    ? null
                    : Number(ano_escolar),
                String(turma || '').trim() || null,
                String(escola || '').trim() || null,
            ]
        );

        idAluno = alunoResult.rows[0].id_aluno;

        credenciais = {
            email: userResult.rows[0].email,
            passwordTemporaria,
            primeiraLogin: true,
        };

        await client.query('COMMIT');

        await registarInsert(
            req.userId,
            'alunos',
            {
                id_aluno: idAluno,
                nome: alunoNome,
                email: userResult.rows[0].email,
                ano: alunoResult.rows[0].ano,
                turma: alunoResult.rows[0].turma,
                escola: alunoResult.rows[0].escola,
            },
            idAluno
        );

        const emailResultado = await enviarEmailCredenciaisIniciais(
            alunoNome,
            alunoEmail,
            passwordTemporaria
        );
        const emailEnviado = emailResultado.ok === true;

        // Enviar também para o encarregado de educação se tiver email real
        if (
            encarregadoEmail &&
            !encarregadoEmail.includes('@placeholder.local')
        ) {
            await enviarEmailContaCriadaEE(
                alunoNome,
                encarregadoEmail,
                passwordTemporaria
            ).catch(() => {});
        }

        notificarGestoresCriacaoConta({
            actorUserId: req.userId,
            nome: alunoNome,
            email: alunoEmail,
            tipo: 'aluno',
        }).catch(() => {});

        return res.status(201).json({
            message: emailEnviado
                ? 'Aluno criado com sucesso. Credenciais temporárias enviadas por email.'
                : 'Aluno criado com sucesso, mas não foi possível enviar o email automático.',
            aluno: {
                id_aluno: idAluno,
                nome: alunoNome,
                email: userResult.rows[0].email,
                ano: alunoResult.rows[0].ano,
                turma: alunoResult.rows[0].turma,
                escola: alunoResult.rows[0].escola,
            },
            credenciais: {
                ...credenciais,
                emailEnviado,
                emailErro: emailEnviado
                    ? null
                    : emailResultado.error || 'Erro no envio',
            },
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        if (error?.code === '23505') {
            return res.status(400).json({
                message: getDuplicateErrorMessage(error),
            });
        }

        console.error('Erro ao criar aluno:', error.message);
        return res.status(500).json({ message: 'Erro ao criar aluno.' });
    } finally {
        client.release();
    }
}

/**
 * Obtém detalhes completos de um aluno específico
 *
 * @param {Object} req - Objecto de requisição (params: id)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Dados completos do aluno com pessoa, utilizador e encarregado de educação
 */
export async function obterAluno(req, res) {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de aluno inválido.' });
    }

    try {
        const alunoQuery = `
			SELECT
				a.id_aluno,
				a.id_user,
				a.id_pessoa,
				a.id_encarregado,
				a.escola,
				a.ano,
				a.turma,
				a.nivel_ensino,
				a.data_inicio,
				a.observacoes,
				a.aut_saida_nome_1,
				a.aut_saida_parentesco_1,
				a.aut_saida_nome_2,
				a.aut_saida_parentesco_2
			FROM alunos a
			WHERE a.id_aluno = $1
		`;

        const pessoaQuery = `
			SELECT
				p.id_pessoa,
				p.nome,
				p.data_nasc,
				p.cc,
				p.nif,
				p.morada,
				p.localidade,
				p.cod_postal,
				p.telemovel,
				p.telefone,
				p.created_at
			FROM pessoas p
			WHERE p.id_pessoa = $1
		`;

        const userQuery = `
			SELECT
				u.id_user,
				u.email,
                u.imagem_perfil_url,
				u.role,
				u.status,
				u.created_at
			FROM users u
			WHERE u.id_user = $1
		`;

        const encarregadoQuery = `
			SELECT
				e.id_encarregado,
				e.id_pessoa,
				e.parentesco,
				p.nome,
				p.data_nasc,
				p.cc,
				p.nif,
				p.morada,
				p.localidade,
				p.cod_postal,
				p.telemovel,
				p.telefone,
				u.id_user,
				u.email,
				u.role
			FROM encarregados e
			INNER JOIN pessoas p ON p.id_pessoa = e.id_pessoa
			LEFT JOIN users u ON u.id_user = e.id_user
			WHERE e.id_encarregado = $1
		`;

        // Obter dados do aluno
        const alunoResult = await db.query(alunoQuery, [id]);
        if (alunoResult.rows.length === 0) {
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const aluno = alunoResult.rows[0];

        // Obter dados da pessoa associada ao aluno
        const pessoapResult = await db.query(pessoaQuery, [aluno.id_pessoa]);
        const pessoa = pessoapResult.rows[0] || null;

        // Obter dados do utilizador
        const userResult = await db.query(userQuery, [aluno.id_user]);
        const user = userResult.rows[0] || null;

        // Obter dados do encarregado de educação
        const encarregadoResult = await db.query(encarregadoQuery, [
            aluno.id_encarregado,
        ]);
        const encarregado = encarregadoResult.rows[0]
            ? {
                  id_encarregado: encarregadoResult.rows[0].id_encarregado,
                  parentesco: encarregadoResult.rows[0].parentesco,
                  pessoa: {
                      id_pessoa: encarregadoResult.rows[0].id_pessoa,
                      nome: encarregadoResult.rows[0].nome,
                      data_nasc: encarregadoResult.rows[0].data_nasc,
                      cc: encarregadoResult.rows[0].cc,
                      nif: encarregadoResult.rows[0].nif,
                      morada: encarregadoResult.rows[0].morada,
                      localidade: encarregadoResult.rows[0].localidade,
                      cod_postal: encarregadoResult.rows[0].cod_postal,
                      telemovel: encarregadoResult.rows[0].telemovel,
                      telefone: encarregadoResult.rows[0].telefone,
                      user: encarregadoResult.rows[0].id_user
                          ? {
                                id_user: encarregadoResult.rows[0].id_user,
                                email: encarregadoResult.rows[0].email,
                                role: encarregadoResult.rows[0].role,
                            }
                          : null,
                  },
              }
            : null;

        const inscricoesServicoColumn =
            await resolveInscricoesServicoColumn(db);
        const pacoteDescricaoColumn = await resolvePacotesDescricaoColumn(db);
        const pacoteDescricaoSelect = pacoteDescricaoColumn
            ? `p.${pacoteDescricaoColumn}`
            : 'NULL::text';
        let servicosSubscritos = [];

        if (inscricoesServicoColumn) {
            const servicosQuery = `
				SELECT
					s.id_servico,
					COALESCE(NULLIF(ts.nome, ''), NULLIF(s.tipo, ''), 'Serviço') AS tipo_servico,
					COALESCE(m.nome, 'Sem modalidade') AS modalidade,
					COALESCE(d.nome, 'Sem disciplina') AS disciplina,
					s.data_inicio,
					s.hora_inicio,
					s.hora_fim,
					i.data_inscricao,
					COALESCE(i.valor_final, p.preco) AS valor,
					p.id_pacote,
                    ${pacoteDescricaoSelect} AS pacote_descricao
				FROM inscricoes i
				INNER JOIN servicos_curriculares s ON s.id_servico = i.${inscricoesServicoColumn}
				LEFT JOIN tipo_servico ts ON ts.id_tiposervico = s.id_tiposervico
				LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
				LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
				LEFT JOIN pacotes p ON p.id_pacote = i.id_pacote
				WHERE i.id_aluno = $1::int
				  AND LOWER(COALESCE(i.estado, '')) = 'ativa'
				ORDER BY i.data_inscricao DESC, s.data_inicio DESC, s.id_servico DESC
			`;

            const servicosResult = await db.query(servicosQuery, [id]);
            servicosSubscritos = servicosResult.rows.map((row) => ({
                id_servico: row.id_servico,
                tipoServico: row.tipo_servico,
                modalidade: row.modalidade,
                disciplina: row.disciplina,
                dataInicio: row.data_inicio,
                horaInicio: row.hora_inicio,
                horaFim: row.hora_fim,
                dataInscricao: row.data_inscricao,
                valor: row.valor,
                idPacote: row.id_pacote,
                pacoteDescricao: row.pacote_descricao,
            }));
        }

        return res.status(200).json({
            aluno: {
                id_aluno: aluno.id_aluno,
                id_user: aluno.id_user,
                id_pessoa: aluno.id_pessoa,
                id_encarregado: aluno.id_encarregado,
                escola: aluno.escola,
                ano: aluno.ano,
                turma: aluno.turma,
                nivel_ensino: aluno.nivel_ensino,
                data_inicio: aluno.data_inicio,
                observacoes: aluno.observacoes,
                aut_saida_nome_1: aluno.aut_saida_nome_1,
                aut_saida_parentesco_1: aluno.aut_saida_parentesco_1,
                aut_saida_nome_2: aluno.aut_saida_nome_2,
                aut_saida_parentesco_2: aluno.aut_saida_parentesco_2,
                pessoa: pessoa
                    ? {
                          ...pessoa,
                          user: user,
                      }
                    : null,
                encarregado: encarregado,
                servicosSubscritos,
            },
        });
    } catch (error) {
        console.error('Erro ao obter aluno:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao obter detalhes do aluno.' });
    }
}

/**
 * Obtém o perfil do aluno autenticado
 *
 * @param {Object} req - Objecto de requisição (req.userId)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Dados do aluno autenticado
 */
export async function obterMeuPerfil(req, res) {
    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const alunoResult = await db.query(
            `
				SELECT id_aluno
				FROM alunos
				WHERE id_user = $1
				LIMIT 1
			`,
            [req.userId]
        );

        if (!alunoResult.rows.length) {
            return res
                .status(404)
                .json({ message: 'Perfil de aluno não encontrado.' });
        }

        const perfil = await carregarPerfilAlunoPorIdAluno(
            db,
            alunoResult.rows[0].id_aluno
        );

        if (!perfil) {
            return res
                .status(404)
                .json({ message: 'Perfil de aluno não encontrado.' });
        }

        return res.status(200).json({ aluno: perfil });
    } catch (error) {
        console.error('Erro ao obter perfil do aluno:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao obter o perfil do aluno.' });
    }
}

/**
 * Atualiza o perfil do aluno autenticado
 *
 * @param {Object} req - Objecto de requisição (req.userId, body)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Resposta do update do aluno
 */
export async function atualizarMeuPerfil(req, res) {
    if (!req.userId) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const alunoResult = await db.query(
            `
				SELECT id_aluno
				FROM alunos
				WHERE id_user = $1
				LIMIT 1
			`,
            [req.userId]
        );

        if (!alunoResult.rows.length) {
            return res
                .status(404)
                .json({ message: 'Perfil de aluno não encontrado.' });
        }

        const alunoId = alunoResult.rows[0].id_aluno;
        return atualizarAluno(
            {
                ...req,
                params: {
                    ...(req.params || {}),
                    id: String(alunoId),
                },
            },
            res
        );
    } catch (error) {
        console.error('Erro ao atualizar perfil do aluno:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar o perfil do aluno.' });
    }
}

/**
 * Atualiza os dados de um aluno
 *
 * @param {Object} req - Objecto de requisição (params: id, body com campos editáveis)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Dados atualizados do aluno
 */
export async function atualizarAluno(req, res) {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de aluno inválido.' });
    }

    const {
        nome,
        data_nasc,
        cc,
        nif,
        morada,
        localidade,
        cod_postal,
        telemovel,
        telefone,
        email,
        imagem_perfil_url,
        escola,
        ano,
        turma,
        encarregado_nome,
        encarregado_parentesco,
        encarregado_morada,
        encarregado_localidade,
        encarregado_cod_postal,
        encarregado_telemovel,
        encarregado_telefone,
        encarregado_email,
    } = req.body || {};

    const hasAnyField = [
        nome,
        data_nasc,
        cc,
        nif,
        morada,
        localidade,
        cod_postal,
        telemovel,
        telefone,
        email,
        escola,
        ano,
        turma,
        encarregado_nome,
        encarregado_parentesco,
        encarregado_morada,
        encarregado_localidade,
        encarregado_cod_postal,
        encarregado_telemovel,
        encarregado_telefone,
        encarregado_email,
        imagem_perfil_url,
    ].some((value) => value !== undefined);

    if (!hasAnyField) {
        return res.status(400).json({ message: 'Sem dados para atualizar.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const alunoResult = await client.query(
            `
                SELECT id_aluno, id_user, id_pessoa, id_encarregado
				FROM alunos
				WHERE id_aluno = $1
				LIMIT 1
			`,
            [id]
        );

        if (!alunoResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const aluno = alunoResult.rows[0];
        const beforePerfil = await carregarPerfilAlunoPorIdAluno(client, id);

        const nextAlunoEmail =
            email == null ? '' : String(email).trim().toLowerCase();

        if (nextAlunoEmail) {
            const duplicateAlunoEmailResult = await client.query(
                `
                    SELECT id_user, role
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                      AND id_user <> $2
                    LIMIT 1
                `,
                [nextAlunoEmail, aluno.id_user]
            );

            if (duplicateAlunoEmailResult.rows.length) {
                await client.query('ROLLBACK');
                const existingRole = String(
                    duplicateAlunoEmailResult.rows[0]?.role || 'utilizador'
                ).trim();
                return res.status(400).json({
                    message: `Esse email já está associado a outro ${existingRole}.`,
                });
            }
        }

        await client.query(
            `
				UPDATE pessoas
				SET
					nome = COALESCE($1, nome),
					data_nasc = COALESCE($2, data_nasc),
					cc = COALESCE($3, cc),
					nif = COALESCE($4, nif),
					morada = COALESCE($5, morada),
					localidade = COALESCE($6, localidade),
					cod_postal = COALESCE($7, cod_postal),
					telemovel = COALESCE($8, telemovel),
					telefone = COALESCE($9, telefone)
				WHERE id_pessoa = $10
			`,
            [
                nome == null ? null : String(nome).trim(),
                data_nasc || null,
                cc == null ? null : String(cc).trim(),
                nif == null ? null : String(nif).trim(),
                morada == null ? null : String(morada).trim(),
                localidade == null ? null : String(localidade).trim(),
                cod_postal == null ? null : String(cod_postal).trim(),
                telemovel == null ? null : String(telemovel).trim(),
                telefone == null ? null : String(telefone).trim(),
                aluno.id_pessoa,
            ]
        );

        if (
            encarregado_nome !== undefined ||
            encarregado_parentesco !== undefined ||
            encarregado_morada !== undefined ||
            encarregado_localidade !== undefined ||
            encarregado_cod_postal !== undefined ||
            encarregado_telemovel !== undefined ||
            encarregado_telefone !== undefined ||
            encarregado_email !== undefined
        ) {
            const encarregadoPessoaResult = aluno.id_encarregado
                ? await client.query(
                      `
						SELECT id_pessoa
						FROM encarregados
						WHERE id_encarregado = $1
						LIMIT 1
					`,
                      [aluno.id_encarregado]
                  )
                : { rows: [] };
            const encarregadoIdPessoa =
                encarregadoPessoaResult.rows[0]?.id_pessoa ?? null;

            await client.query(
                `
					UPDATE pessoas
					SET
						nome = COALESCE($1, nome),
						morada = COALESCE($2, morada),
						localidade = COALESCE($3, localidade),
						cod_postal = COALESCE($4, cod_postal),
						telemovel = COALESCE($5, telemovel),
						telefone = COALESCE($6, telefone)
					WHERE id_pessoa = $7
				`,
                [
                    encarregado_nome == null
                        ? null
                        : String(encarregado_nome).trim(),
                    encarregado_morada == null
                        ? null
                        : String(encarregado_morada).trim(),
                    encarregado_localidade == null
                        ? null
                        : String(encarregado_localidade).trim(),
                    encarregado_cod_postal == null
                        ? null
                        : String(encarregado_cod_postal).trim(),
                    encarregado_telemovel == null
                        ? null
                        : String(encarregado_telemovel).trim(),
                    encarregado_telefone == null
                        ? null
                        : String(encarregado_telefone).trim(),
                    encarregadoIdPessoa,
                ]
            );

            if (encarregado_parentesco !== undefined) {
                await client.query(
                    `
						UPDATE encarregados
						SET parentesco = COALESCE($1, parentesco)
						WHERE id_encarregado = $2
					`,
                    [
                        encarregado_parentesco == null
                            ? null
                            : String(encarregado_parentesco).trim(),
                        aluno.id_encarregado,
                    ]
                );
            }

            if (encarregado_email !== undefined) {
                const nextGuardianEmail = String(encarregado_email || '')
                    .trim()
                    .toLowerCase();

                if (nextGuardianEmail) {
                    const currentGuardianUserResult = await client.query(
                        `
                            SELECT id_user
                            FROM encarregados
                            WHERE id_encarregado = $1
                            LIMIT 1
                        `,
                        [aluno.id_encarregado]
                    );

                    const currentGuardianUserId =
                        currentGuardianUserResult.rows[0]?.id_user ?? null;

                    const duplicateGuardianEmailResult = await client.query(
                        `
                            SELECT id_user, role
                            FROM users
                            WHERE LOWER(email) = LOWER($1)
                              AND ($2::int IS NULL OR id_user <> $2::int)
                            LIMIT 1
                        `,
                        [nextGuardianEmail, currentGuardianUserId]
                    );

                    if (duplicateGuardianEmailResult.rows.length) {
                        await client.query('ROLLBACK');
                        const existingRole = String(
                            duplicateGuardianEmailResult.rows[0]?.role ||
                                'utilizador'
                        ).trim();
                        return res.status(400).json({
                            message: `O email do encarregado já está associado a outro ${existingRole}.`,
                        });
                    }
                }

                await client.query(
                    `
						UPDATE users
						SET email = COALESCE($1, email)
						WHERE id_user = (SELECT id_user FROM encarregados WHERE id_encarregado = $2)
					`,
                    [
                        encarregado_email == null
                            ? null
                            : String(encarregado_email).trim(),
                        aluno.id_encarregado,
                    ]
                );
            }
        }

        await client.query(
            `
				UPDATE users
                SET email = COALESCE($1, email),
                    imagem_perfil_url = COALESCE($2, imagem_perfil_url)
                WHERE id_user = $3
			`,
            [
                email == null ? null : String(email).trim(),
                imagem_perfil_url == null
                    ? null
                    : String(imagem_perfil_url).trim(),
                aluno.id_user,
            ]
        );

        await client.query(
            `
				UPDATE alunos
				SET
					escola = COALESCE($1, escola),
					ano = COALESCE($2, ano),
					turma = COALESCE($3, turma)
				WHERE id_aluno = $4
			`,
            [
                escola == null ? null : String(escola).trim(),
                ano == null || ano === '' ? null : Number(ano),
                turma == null ? null : String(turma).trim(),
                id,
            ]
        );

        const updatedResult = await client.query(
            `
				SELECT
					a.id_aluno,
					a.escola,
					a.ano,
					a.turma,
					p.nome,
					p.data_nasc,
					p.cc,
					p.nif,
					p.morada,
					p.localidade,
					p.cod_postal,
					p.telemovel,
					p.telefone,
					e.parentesco,
                    u.email,
                    u.imagem_perfil_url
				FROM alunos a
				INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
				INNER JOIN users u ON u.id_user = a.id_user
				LEFT JOIN encarregados e ON e.id_encarregado = a.id_encarregado
				WHERE a.id_aluno = $1
				LIMIT 1
			`,
            [id]
        );
        const afterPerfil = await carregarPerfilAlunoPorIdAluno(client, id);

        await client.query('COMMIT');

        await Promise.allSettled([
            registarUpdate(
                req.userId ?? null,
                'alunos',
                Number(id),
                beforePerfil,
                afterPerfil
            ),
            registarInsert(req.userId ?? null, 'notificacao_broadcast', {
                tipo: 'perfil',
                titulo: 'Perfil do aluno atualizado',
                descricao: `${String(afterPerfil?.pessoa?.nome || afterPerfil?.nome || 'Aluno')} atualizou os dados do perfil.`,
                nivel: 'info',
            }),
        ]);

        return res.status(200).json({
            message: 'Aluno atualizado com sucesso.',
            aluno: updatedResult.rows[0],
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        console.error('Erro ao atualizar aluno:', error.message);
        return res.status(500).json({ message: 'Erro ao atualizar aluno.' });
    } finally {
        client.release();
    }
}

export async function alterarEstadoAluno(req, res) {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de aluno inválido.' });
    }

    if (typeof status !== 'boolean') {
        return res.status(400).json({
            message: 'Status inválido. Use true (ativo) ou false (stand by).',
        });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const alunoResult = await client.query(
            `
                SELECT id_aluno, id_user
                FROM alunos
                WHERE id_aluno = $1
                LIMIT 1
            `,
            [id]
        );

        if (!alunoResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const aluno = alunoResult.rows[0];
        const beforePerfil = await carregarPerfilAlunoPorIdAluno(client, id);

        const updateUserResult = await client.query(
            `
                UPDATE users
                SET status = $1
                WHERE id_user = $2
                RETURNING id_user, status
            `,
            [status, aluno.id_user]
        );

        if (!updateUserResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                message: 'Utilizador associado ao aluno não encontrado.',
            });
        }

        const afterPerfil = await carregarPerfilAlunoPorIdAluno(client, id);
        await client.query('COMMIT');

        await registarUpdate(
            req.userId ?? null,
            'alunos',
            Number(id),
            beforePerfil,
            afterPerfil
        );

        return res.status(200).json({
            message: status
                ? 'Aluno reativado com sucesso.'
                : 'Aluno colocado em stand by com sucesso.',
            alunoId: Number(id),
            status,
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        console.error('Erro ao alterar estado do aluno:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao alterar estado do aluno.' });
    } finally {
        client.release();
    }
}

export async function eliminarAlunoDefinitivo(req, res) {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de aluno inválido.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const alunoResult = await client.query(
            `
                SELECT id_aluno, id_user, id_pessoa
                FROM alunos
                WHERE id_aluno = $1
                LIMIT 1
            `,
            [id]
        );

        if (!alunoResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const aluno = alunoResult.rows[0];
        const beforePerfil = await carregarPerfilAlunoPorIdAluno(client, id);

        await deleteDependentRowsByFk(
            client,
            'public.alunos',
            'id_aluno',
            Number(id)
        );

        await client.query(
            `
                DELETE FROM alunos
                WHERE id_aluno = $1
            `,
            [id]
        );

        await deleteByIdSafely(client, 'users', 'id_user', aluno.id_user);
        await deleteByIdSafely(client, 'pessoas', 'id_pessoa', aluno.id_pessoa);

        await client.query('COMMIT');

        await registarDelete(
            req.userId ?? null,
            'alunos',
            Number(id),
            beforePerfil
        );

        return res.status(200).json({
            message:
                'Aluno eliminado definitivamente com sucesso. Será necessário novo registo para voltar a utilizar a ficha.',
            id_aluno: Number(id),
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // noop
        }

        if (error?.code === '23503') {
            return res.status(409).json({
                message: `Não foi possível eliminar o aluno porque ainda existem registos relacionados obrigatórios (${String(error?.constraint || 'FK desconhecida')}).`,
            });
        }

        console.error('Erro ao eliminar aluno definitivamente:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao eliminar aluno definitivamente.' });
    } finally {
        client.release();
    }
}

/**
 * Reseta a password de um aluno e reenvia credenciais por email (aluno e encarregado)
 *
 * @param {Object} req - Objecto de requisição (params: id)
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Confirmação do reset
 */
export async function resetarPasswordAluno(req, res) {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID de aluno inválido.' });
    }

    const client = await db.connect();

    try {
        const alunoResult = await client.query(
            `
            SELECT
                a.id_user,
                p.nome,
                u.email AS aluno_email,
                ue.email AS ee_email
            FROM alunos a
            INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            INNER JOIN users u ON u.id_user = a.id_user
            INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
            LEFT JOIN users ue ON ue.id_user = e.id_user
            WHERE a.id_aluno = $1
            LIMIT 1
            `,
            [id]
        );

        if (!alunoResult.rows.length) {
            client.release();
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const row = alunoResult.rows[0];
        const passwordTemporaria = gerarPasswordTemporaria();
        const passwordHash = await bcrypt.hash(passwordTemporaria, 10);

        await client.query(
            `UPDATE users SET password = $1, primeira_login = true WHERE id_user = $2`,
            [passwordHash, row.id_user]
        );

        client.release();

        // Enviar ao aluno
        await enviarEmailRecuperacaoPassword(
            row.nome,
            row.aluno_email,
            passwordTemporaria
        ).catch(() => {});

        // Enviar ao encarregado se tiver email real
        const eeEmail = String(row.ee_email || '').trim();
        if (eeEmail && !eeEmail.includes('@placeholder.local')) {
            await enviarEmailRecuperacaoPasswordEE(
                row.nome,
                eeEmail,
                passwordTemporaria
            ).catch(() => {});
        }

        return res.status(200).json({
            message:
                'Password resetada com sucesso. Novas credenciais enviadas por email.',
        });
    } catch (error) {
        try {
            client.release();
        } catch {
            // noop
        }
        console.error('Erro ao resetar password do aluno:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao resetar password do aluno.' });
    }
}
