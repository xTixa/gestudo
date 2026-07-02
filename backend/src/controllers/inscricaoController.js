import { db } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { enviarEmailCredenciaisIniciais, enviarEmailContaCriadaEE, enviarEmailAlerta } from '../services/emailService.js';
import { dispatchAlert } from '../services/alertasDispatchService.js';
import {
    registarInsert,
    registarUpdate,
    registarDelete,
} from '../services/logService.js';

/**
 * ========================================
 * INSCRICAO CONTROLLER
 * ========================================
 * Responsável pelas operações de inscrição de alunos em serviços.
 * ========================================
 */

/**
 * Cita identificadores de base de dados para evitar SQL injection
 *
 * @param {string} identifier - O identificador a processar
 * @returns {string} Identificador com citação SQL
 */
function quoteIdent(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

/**
 * Normaliza texto removendo acentos e caracteres especiais
 * Converte para lowercase e substitui espaços por underscores
 *
 * @param {*} value - O valor a normalizar
 * @returns {string} Texto normalizado
 */
function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Formata rótulo de nivel de ensino para exibição
 * Converte valores como '1_ciclo' para '1º Ciclo'
 *
 * @param {*} value - O valor a formatar
 * @returns {string} Rótulo formatado
 */
function formatLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    const map = {
        '1_ciclo': '1º Ciclo',
        '2_ciclo': '2º Ciclo',
        '3_ciclo': '3º Ciclo',
        secundario: 'Secundario',
        ensino_superior: 'Ensino Superior',
    };

    const key = normalizeText(raw);
    if (map[key]) {
        return map[key];
    }

    return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function gerarCartaoCidadaoPlaceholder(prefix = 'ND') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

// pessoas.nif é varchar(15) NOT NULL UNIQUE; o formulário público de inscrição não recolhe
// o NIF do encarregado, por isso é preciso gerar um placeholder único quando ele não vem preenchido.
function gerarNifPlaceholder() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `EE${timestamp}${random}`;
}

/**
 * Procura tabela em base de dados usando lista de nomes candidatos
 *
 * @param {Array<string>} candidates - Nomes a procurar
 * @returns {Object|null} Objecto com {table_schema, table_name} ou null
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
 * Normaliza linhas de opção para formato padrão com id, value e label
 * Encontra automaticamente colunas de nome e ID em registos da tabela
 *
 * @param {Array<Object>} rows - Registos da base de dados
 * @returns {Array<Object>} Array normalizado com {id, value, label, key, nivelRef, nivelRefKey}
 */
function normalizeOptionRows(rows) {
    const labelKeys = [
        'nome',
        'designacao',
        'descricao',
        'titulo',
        'disciplina',
        'nivel',
        'nome_nivel',
        'label',
        'value',
    ];

    return rows
        .map((row) => {
            const entries = Object.entries(row || {});
            const labelEntry =
                entries.find(([key]) =>
                    labelKeys.includes(String(key).toLowerCase())
                ) ||
                entries.find(
                    ([, value]) =>
                        typeof value === 'string' && value.trim() !== ''
                );

            const idEntry = entries.find(([key]) =>
                /(^id$|^id_|_id$)/i.test(String(key))
            );

            if (!labelEntry || !String(labelEntry[1]).trim()) {
                return null;
            }

            const label = String(labelEntry[1]).trim();
            const idValue = idEntry ? String(idEntry[1]) : label;

            const nivelEntry = entries.find(([key]) =>
                /nivel/i.test(String(key))
            );
            const nivelRef = nivelEntry ? String(nivelEntry[1]).trim() : '';

            return {
                id: idValue,
                value: label,
                label: formatLabel(label),
                key: normalizeText(label),
                nivelRef,
                nivelRefKey: normalizeText(nivelRef),
            };
        })
        .filter(Boolean);
}

/**
 * Lista opções de inscrição (filtros disponíveis)
 * Retorna disciplinas, níveis de ensino, modalidades e tipos de serviço para preenchimento de filtros
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Objecto com arrays de disciplinas, niveisEnsino, modalidades
 */
export async function listarOpcoesInscricao(req, res) {
    try {
        const [
            disciplinasTable,
            niveisTable,
            modalidadesTable,
            tiposServicoTable,
        ] = await Promise.all([
            findTableByCandidates(['disciplinas', 'disciplina']),
            findTableByCandidates([
                'nivel_ensino',
                'niveis_ensino',
                'nivelensino',
                'niveisensino',
                'nivel',
            ]),
            findTableByCandidates(['modalidades', 'modalidade']),
            findTableByCandidates([
                'tipo_servico',
                'tipos_servico',
                'tiposervico',
            ]),
        ]);

        if (
            !disciplinasTable ||
            !niveisTable ||
            !modalidadesTable ||
            !tiposServicoTable
        ) {
            return res.status(500).json({
                message:
                    'Nao foi possivel localizar as tabelas de disciplinas, nivel_ensino, modalidades e/ou tipos de servico.',
                detail: {
                    disciplinasTableFound: Boolean(disciplinasTable),
                    niveisTableFound: Boolean(niveisTable),
                    modalidadesTableFound: Boolean(modalidadesTable),
                    tiposServicoTableFound: Boolean(tiposServicoTable),
                },
            });
        }

        const disciplinasQuery = `SELECT * FROM ${quoteIdent(disciplinasTable.table_schema)}.${quoteIdent(disciplinasTable.table_name)} ORDER BY 1`;
        const niveisQuery = `SELECT * FROM ${quoteIdent(niveisTable.table_schema)}.${quoteIdent(niveisTable.table_name)} ORDER BY 1`;
        const modalidadesQuery = `SELECT * FROM ${quoteIdent(modalidadesTable.table_schema)}.${quoteIdent(modalidadesTable.table_name)} ORDER BY 1`;
        const tiposServicoQuery = `SELECT * FROM ${quoteIdent(tiposServicoTable.table_schema)}.${quoteIdent(tiposServicoTable.table_name)} ORDER BY 1`;

        const [
            disciplinasResult,
            niveisResult,
            modalidadesResult,
            tiposServicoResult,
        ] = await Promise.all([
            db.query(disciplinasQuery),
            db.query(niveisQuery),
            db.query(modalidadesQuery),
            db.query(tiposServicoQuery),
        ]);

        return res.status(200).json({
            disciplinas: normalizeOptionRows(disciplinasResult.rows),
            niveisEnsino: normalizeOptionRows(niveisResult.rows),
            modalidades: normalizeOptionRows(modalidadesResult.rows),
            tiposServico: normalizeOptionRows(tiposServicoResult.rows),
        });
    } catch (error) {
        console.error('Erro ao listar opcoes de inscricao:', error.message);
        return res.status(500).json({
            message: 'Erro ao obter opcoes de inscricao.',
        });
    }
}

function getBodyValue(body, key) {
    return String(body?.[key] ?? '').trim();
}

function toNullableText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function toLowerEmailOrNull(value) {
    const normalized = toNullableText(value);
    return normalized ? normalized.toLowerCase() : null;
}

function toSqlDateOrNull(value) {
    if (value == null || value === '') {
        return null;
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return null;
        }
        return value.toISOString().slice(0, 10);
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return null;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

function isValidDateInput(value) {
    return Boolean(toSqlDateOrNull(value));
}

function createHttpError(statusCode, message, detail) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (detail) {
        error.detail = detail;
    }
    return error;
}

function validarInscricaoParaAprovacao(inscricao) {
    const dataNascimento =
        inscricao?.data_nascimento || inscricao?.dados?.data_nascimento;

    if (!isValidDateInput(dataNascimento)) {
        throw createHttpError(
            400,
            'Não foi possível aprovar: data de nascimento do aluno em falta ou inválida.',
            {
                campo: 'data_nascimento',
                acao: 'Complete a data de nascimento na inscrição antes de aprovar.',
            }
        );
    }
}

function getDuplicateErrorMessage(error) {
    const constraint = String(error?.constraint || '').toLowerCase();
    const detail = String(error?.detail || '').toLowerCase();

    if (constraint.includes('cc') || detail.includes('(cc)')) {
        return 'Já existe uma pessoa registada com este cartão de cidadão.';
    }

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

    // Fallback defensivo para esquemas sem constraint legível.
    return 'aluno';
}

/**
 * Gera uma password aleatória com 12 caracteres
 * Inclui letras maiúsculas, minúsculas, números e caracteres especiais
 *
 * @returns {string} Password aleatória
 */
function gerarPasswordAleatoria() {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function ensureInscricoesPublicasTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS public.inscricoes_publicas (
            id_inscricao_publica BIGSERIAL PRIMARY KEY,
            data_inicio DATE,
            nome_completo TEXT NOT NULL,
            data_nascimento DATE,
            email TEXT,
            telemovel TEXT,
            telefone TEXT,
            cartao_cidadao TEXT,
            nif TEXT,
            morada TEXT,
            localidade TEXT,
            codigo_postal TEXT,
            escola TEXT,
            nivel_ensino TEXT,
            ano_escolar TEXT,
            turma TEXT,
            disciplina TEXT,
            tipo_servico TEXT,
            modalidade TEXT,
            pacote TEXT,
            obs TEXT,
            ee_nome TEXT,
            ee_nif TEXT,
            ee_email TEXT,
            ee_telemovel TEXT,
            ee_telefone TEXT,
            ee_morada TEXT,
            ee_localidade TEXT,
            ee_codigo_postal TEXT,
            ee_parentesco TEXT,
            aut_saida_nome_1 TEXT,
            aut_saida_parentesco_1 TEXT,
            aut_saida_nome_2 TEXT,
            aut_saida_parentesco_2 TEXT,
            estado TEXT NOT NULL DEFAULT 'pendente',
            dados JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function integrarInscricaoAprovada(inscricao) {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const email = toNullableText(inscricao?.email);
        const nomeAluno = toNullableText(inscricao?.nome_completo) || 'Aluno';
        const dataNascimentoAluno = toSqlDateOrNull(
            inscricao?.data_nascimento ?? inscricao?.dados?.data_nascimento
        );
        const ccAluno =
            toNullableText(inscricao?.cartao_cidadao) ||
            toNullableText(inscricao?.dados?.cartao_cidadao) ||
            gerarCartaoCidadaoPlaceholder('AL');
        const ccEncarregado =
            toNullableText(inscricao?.dados?.ee_cartao_cidadao) ||
            gerarCartaoCidadaoPlaceholder('EE');

        if (!email) {
            throw new Error('A inscrição aprovada não contém email do aluno.');
        }

        let idUser = null;
        let createdUser = false;
        let temporaryPassword = null;

        const existingUserResult = await client.query(
            `
                SELECT id_user
                FROM users
                WHERE LOWER(email) = LOWER($1)
                LIMIT 1
            `,
            [email]
        );

        if (existingUserResult.rows.length > 0) {
            idUser = existingUserResult.rows[0].id_user;
        } else {
            temporaryPassword = gerarPasswordAleatoria();
            const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

            const createdUserResult = await client.query(
                `
                    INSERT INTO users (email, password, role, status, primeira_login)
                    VALUES ($1, $2, 'aluno', true, true)
                    RETURNING id_user
                `,
                [email, hashedPassword]
            );

            idUser = createdUserResult.rows[0].id_user;
            createdUser = true;
        }

        const existingAlunoResult = await client.query(
            `
                SELECT id_aluno
                FROM alunos
                WHERE id_user = $1
                LIMIT 1
            `,
            [idUser]
        );

        if (existingAlunoResult.rows.length > 0) {
            await client.query('COMMIT');
            return {
                createdUser,
                createdAluno: false,
                createdEncarregado: false,
                temporaryPassword,
                email,
                nomeAluno,
                guardianUserRole: null,
                encarregadoEmail: null,
                encarregadoTemporaryPassword: null,
                encarregadoUserCreated: false,
            };
        }

        let idEncarregado = null;
        let createdEncarregado = false;
        const guardianUserRole = await resolveGuardianUserRole(client);
        let guardianUserRoleUsed = null;
        let encarregadoEmailFinal = null;
        let encarregadoTemporaryPassword = null;
        let encarregadoUserCreated = false;

        const encarregadoNif = toNullableText(inscricao?.ee_nif);
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

            if (encarregadoExistente.rows.length > 0) {
                idEncarregado = encarregadoExistente.rows[0].id_encarregado;
            }
        }

        if (!idEncarregado) {
            const encarregadoEmail =
                toLowerEmailOrNull(inscricao?.ee_email) ||
                toLowerEmailOrNull(inscricao?.dados?.ee_email) ||
                `encarregado.inscricao.${inscricao?.id_inscricao_publica || Date.now()}@placeholder.local`;
            encarregadoEmailFinal = encarregadoEmail;

            let idUserEncarregado = null;

            const existingEncarregadoUserResult = await client.query(
                `
                    SELECT id_user
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    LIMIT 1
                `,
                [encarregadoEmail]
            );

            if (existingEncarregadoUserResult.rows.length > 0) {
                idUserEncarregado =
                    existingEncarregadoUserResult.rows[0].id_user;

                const roleResult = await client.query(
                    `
                        SELECT role
                        FROM users
                        WHERE id_user = $1
                        LIMIT 1
                    `,
                    [idUserEncarregado]
                );

                guardianUserRoleUsed =
                    roleResult.rows[0]?.role || guardianUserRole;
            } else {
                const encarregadoPassword = gerarPasswordAleatoria();
                const encarregadoPasswordHash = await bcrypt.hash(
                    encarregadoPassword,
                    10
                );

                const createdEncarregadoUserResult = await client.query(
                    `
                        INSERT INTO users (email, password, role, status, primeira_login)
                        VALUES ($1, $2, $3, true, true)
                        RETURNING id_user
                    `,
                    [
                        encarregadoEmail,
                        encarregadoPasswordHash,
                        guardianUserRole,
                    ]
                );

                idUserEncarregado =
                    createdEncarregadoUserResult.rows[0].id_user;
                guardianUserRoleUsed = guardianUserRole;
                encarregadoTemporaryPassword = encarregadoPassword;
                encarregadoUserCreated = true;
            }

            // encarregados.id_user é UNIQUE: se este utilizador (ex: mesmo email
            // usado para um segundo educando) já tem um encarregado associado,
            // reutiliza-o em vez de tentar inserir outro (o que violaria a
            // constraint e devolvia "dados já registados").
            const existingEncarregadoResult = await client.query(
                `
                    SELECT id_encarregado
                    FROM encarregados
                    WHERE id_user = $1
                    LIMIT 1
                `,
                [idUserEncarregado]
            );

            if (existingEncarregadoResult.rows.length > 0) {
                idEncarregado = existingEncarregadoResult.rows[0].id_encarregado;
            } else {
                const pessoaEncarregadoResult = await client.query(
                    `
                        INSERT INTO pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel, telefone)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING id_pessoa
                    `,
                    [
                        toNullableText(inscricao?.ee_nome) || 'Encarregado',
                        '1980-01-01',
                        ccEncarregado,
                        encarregadoNif || gerarNifPlaceholder(),
                        toNullableText(inscricao?.ee_morada) || '',
                        toNullableText(inscricao?.ee_localidade) || '',
                        toNullableText(inscricao?.ee_codigo_postal) || '',
                        toNullableText(inscricao?.ee_telemovel) || '',
                        toNullableText(inscricao?.ee_telefone),
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
                        toNullableText(inscricao?.ee_parentesco) || 'Encarregado de Educação',
                    ]
                );

                idEncarregado = encarregadoResult.rows[0].id_encarregado;
                createdEncarregado = true;
            }
        }

        let idPessoaAluno = null;
        const alunoNif = toNullableText(inscricao?.nif);

        if (alunoNif) {
            const pessoaAlunoExistente = await client.query(
                `
                    SELECT id_pessoa
                    FROM pessoas
                    WHERE nif = $1
                    LIMIT 1
                `,
                [alunoNif]
            );

            if (pessoaAlunoExistente.rows.length > 0) {
                idPessoaAluno = pessoaAlunoExistente.rows[0].id_pessoa;
            }
        }

        if (!idPessoaAluno) {
            const pessoaAlunoResult = await client.query(
                `
                    INSERT INTO pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel, telefone)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id_pessoa
                `,
                [
                    nomeAluno,
                    dataNascimentoAluno,
                    ccAluno,
                    alunoNif,
                    toNullableText(inscricao?.morada),
                    toNullableText(inscricao?.localidade),
                    toNullableText(inscricao?.codigo_postal),
                    toNullableText(inscricao?.telemovel),
                    toNullableText(inscricao?.telefone),
                ]
            );

            idPessoaAluno = pessoaAlunoResult.rows[0].id_pessoa;
        }

        const anoEscolar = Number.parseInt(inscricao?.ano_escolar, 10);

        await client.query(
            `
                INSERT INTO alunos (id_user, id_pessoa, id_encarregado, ano, turma, escola)
                VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                idUser,
                idPessoaAluno,
                idEncarregado,
                Number.isFinite(anoEscolar) ? anoEscolar : null,
                toNullableText(inscricao?.turma),
                toNullableText(inscricao?.escola),
            ]
        );

        await client.query('COMMIT');

        return {
            createdUser,
            createdAluno: true,
            createdEncarregado,
            temporaryPassword,
            email,
            nomeAluno,
            guardianUserRole: guardianUserRoleUsed,
            encarregadoEmail: encarregadoEmailFinal,
            encarregadoTemporaryPassword,
            encarregadoUserCreated,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function notificarGestoresNovaInscricao({ nomeAluno, email, modalidade, tipoServico, id }) {
    try {
        const { rows: gestores } = await db.query(
            `SELECT id_user, email FROM users WHERE role IN ('gestor', 'admin') AND status = true AND email IS NOT NULL`
        );

        if (!gestores.length) return;

        const modalidadeStr = modalidade ? ` — ${modalidade}` : '';
        const tipoStr = tipoServico ? ` (${tipoServico})` : '';
        const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
        const link = appUrl ? `${appUrl}/gestor/inscricoes-publicas` : null;
        const titulo = 'Nova inscrição pública recebida';
        const descricao = `${nomeAluno} (${email}) submeteu uma nova inscrição${modalidadeStr}${tipoStr}. Referência #${id}.`;

        // Email para cada gestor
        await Promise.allSettled(
            gestores.map((g) =>
                enviarEmailAlerta({
                    email: g.email,
                    nome: 'Gestor',
                    titulo,
                    descricao,
                    nivel: 'info',
                    link,
                })
            )
        );

        // Notificação in-app para cada gestor
        await dispatchAlert({
            codigo: 'novos-pedidos-inscricao',
            for_user_ids: gestores.map((g) => g.id_user),
            titulo,
            descricao,
            nivel: 'info',
            canal: 'app',
            payload: { id_inscricao_publica: id, nome_aluno: nomeAluno },
            pushLink: link,
        });
    } catch (err) {
        console.error('[inscricaoController] Erro ao notificar gestores:', err.message);
    }
}

export async function criarInscricaoPublica(req, res) {
    try {
        await ensureInscricoesPublicasTable();

        const body = req.body || {};
        const nomeCompleto = getBodyValue(body, 'nome_completo');
        const email = getBodyValue(body, 'email');
        const telemovel = getBodyValue(body, 'telemovel');
        const eeNome = getBodyValue(body, 'ee_nome');

        if (!nomeCompleto || !email || !telemovel || !eeNome) {
            return res.status(400).json({
                message:
                    'Campos obrigatórios em falta (nome completo, email, telemóvel e nome do encarregado).',
            });
        }

        const insertQuery = `
            INSERT INTO public.inscricoes_publicas (
                data_inicio,
                nome_completo,
                data_nascimento,
                email,
                telemovel,
                telefone,
                cartao_cidadao,
                nif,
                morada,
                localidade,
                codigo_postal,
                escola,
                nivel_ensino,
                ano_escolar,
                turma,
                disciplina,
                tipo_servico,
                modalidade,
                pacote,
                obs,
                ee_nome,
                ee_nif,
                ee_email,
                ee_telemovel,
                ee_telefone,
                ee_morada,
                ee_localidade,
                ee_codigo_postal,
                ee_parentesco,
                aut_saida_nome_1,
                aut_saida_parentesco_1,
                aut_saida_nome_2,
                aut_saida_parentesco_2,
                dados
            )
            VALUES (
                NULLIF($1, '')::date,
                $2,
                NULLIF($3, '')::date,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17,
                $18,
                $19,
                $20,
                $21,
                $22,
                $23,
                $24,
                $25,
                $26,
                $27,
                $28,
                $29,
                $30,
                $31,
                $32,
                $33,
                $34::jsonb
            )
            RETURNING id_inscricao_publica, created_at
        `;

        const values = [
            getBodyValue(body, 'data_inicio'),
            nomeCompleto,
            getBodyValue(body, 'data_nascimento'),
            email,
            telemovel,
            getBodyValue(body, 'telefone'),
            getBodyValue(body, 'cartao_cidadao'),
            getBodyValue(body, 'nif'),
            getBodyValue(body, 'morada'),
            getBodyValue(body, 'localidade'),
            getBodyValue(body, 'codigo_postal'),
            getBodyValue(body, 'escola'),
            getBodyValue(body, 'nivel_ensino'),
            getBodyValue(body, 'ano_escolar'),
            getBodyValue(body, 'turma'),
            getBodyValue(body, 'disciplina'),
            getBodyValue(body, 'tipo_servico'),
            getBodyValue(body, 'modalidade'),
            getBodyValue(body, 'pacote'),
            getBodyValue(body, 'obs'),
            eeNome,
            getBodyValue(body, 'ee_nif'),
            getBodyValue(body, 'ee_email'),
            getBodyValue(body, 'ee_telemovel'),
            getBodyValue(body, 'ee_telefone'),
            getBodyValue(body, 'ee_morada'),
            getBodyValue(body, 'ee_localidade'),
            getBodyValue(body, 'ee_codigo_postal'),
            getBodyValue(body, 'ee_parentesco'),
            getBodyValue(body, 'aut_saida_nome_1'),
            getBodyValue(body, 'aut_saida_parentesco_1'),
            getBodyValue(body, 'aut_saida_nome_2'),
            getBodyValue(body, 'aut_saida_parentesco_2'),
            JSON.stringify(body),
        ];

        const result = await db.query(insertQuery, values);

        await registarInsert(
            req.userId ?? null,
            'inscricoes_publicas',
            {
                id_inscricao_publica: result.rows[0]?.id_inscricao_publica,
                nome_completo: nomeCompleto,
                email,
                estado: 'pendente',
                origem: 'formulario_publico',
            },
            result.rows[0]?.id_inscricao_publica || null
        );

        // Notificar gestores por email (fire-and-forget)
        notificarGestoresNovaInscricao({
            nomeAluno: nomeCompleto,
            email,
            modalidade: getBodyValue(body, 'modalidade'),
            tipoServico: getBodyValue(body, 'tipo_servico'),
            id: result.rows[0]?.id_inscricao_publica,
        });

        return res.status(201).json({
            message: 'Inscrição recebida com sucesso.',
            inscricao: result.rows[0],
        });
    } catch (error) {
        console.error('Erro ao criar inscrição pública:', error.message);
        return res.status(500).json({
            message: 'Erro ao registar inscrição.',
        });
    }
}

export async function listarInscricoesPublicas(req, res) {
    try {
        await ensureInscricoesPublicasTable();

        const estado = String(req.query?.estado || 'todos')
            .trim()
            .toLowerCase();

        // Localizar tabela de modalidades dinamicamente.
        const modalidadesTable = await findTableByCandidates([
            'modalidades',
            'modalidade',
        ]);

        // Descobrir qual a coluna de nome existe na tabela de modalidades.
        let modalidadeNameCol = null;
        if (modalidadesTable) {
            const { rows: cols } = await db.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = $2`,
                [modalidadesTable.table_schema, modalidadesTable.table_name]
            );
            const colNames = cols.map((c) => c.column_name.toLowerCase());
            modalidadeNameCol =
                ['nome', 'designacao', 'descricao', 'titulo', 'label'].find(
                    (c) => colNames.includes(c)
                ) || null;
        }

        const canJoin = Boolean(modalidadesTable && modalidadeNameCol);
        const modalidadeExpr = canJoin
            ? `COALESCE(m.${quoteIdent(modalidadeNameCol)}, ip.modalidade)`
            : 'ip.modalidade';

        const selectCols = canJoin
            ? `
                ip.id_inscricao_publica,
                ip.created_at,
                ip.estado,
                ip.nome_completo,
                ip.email,
                ip.telemovel,
                ip.escola,
                ip.nivel_ensino,
                ip.ano_escolar,
                ip.turma,
                ip.disciplina,
                ip.tipo_servico,
                ${modalidadeExpr} AS modalidade,
                ip.pacote,
                ip.ee_nome,
                ip.dados`
            : `
                id_inscricao_publica,
                created_at,
                estado,
                nome_completo,
                email,
                telemovel,
                escola,
                nivel_ensino,
                ano_escolar,
                turma,
                disciplina,
                tipo_servico,
                modalidade,
                pacote,
                ee_nome,
                dados`;

        const fromClause = canJoin
            ? `FROM public.inscricoes_publicas ip
               LEFT JOIN ${quoteIdent(modalidadesTable.table_schema)}.${quoteIdent(modalidadesTable.table_name)} m
                 ON m.id_modalidade::text = ip.modalidade
                 OR LOWER(m.${quoteIdent(modalidadeNameCol)}) = LOWER(ip.modalidade)`
            : `FROM public.inscricoes_publicas`;

        const queryBase = `SELECT ${selectCols} ${fromClause}`;

        const isEstadoFiltro = estado && estado !== 'todos';
        const whereCol = canJoin ? 'ip.estado' : 'estado';
        const orderCol = canJoin ? 'ip.created_at' : 'created_at';

        const { rows } = isEstadoFiltro
            ? await db.query(
                  `${queryBase} WHERE LOWER(COALESCE(${whereCol}, '')) = $1 ORDER BY ${orderCol} DESC`,
                  [estado]
              )
            : await db.query(`${queryBase} ORDER BY ${orderCol} DESC`);

        return res.status(200).json({ inscricoes: rows });
    } catch (error) {
        console.error('Erro ao listar inscrições públicas:', error.message);
        return res.status(500).json({
            message: 'Erro ao listar inscrições públicas.',
        });
    }
}

export async function atualizarEstadoInscricaoPublica(req, res) {
    try {
        await ensureInscricoesPublicasTable();

        const id = Number.parseInt(req.params?.id, 10);
        const estado = String(req.body?.estado || '')
            .trim()
            .toLowerCase();

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'ID inválido.' });
        }

        const allowed = new Set(['pendente', 'aprovada', 'rejeitada']);
        if (!allowed.has(estado)) {
            return res.status(400).json({
                message:
                    'Estado inválido. Use: pendente, aprovada ou rejeitada.',
            });
        }

        // Buscar dados da inscrição antes de atualizar
        const selectQuery = `
            SELECT *
            FROM public.inscricoes_publicas
            WHERE id_inscricao_publica = $1
        `;
        const selectResult = await db.query(selectQuery, [id]);

        if (!selectResult.rows.length) {
            return res
                .status(404)
                .json({ message: 'Inscrição não encontrada.' });
        }

        const inscricao = selectResult.rows[0];
        const estadoAnterior = inscricao.estado;

        let integracao = null;

        // Se a inscrição foi aprovada, criar/reusar aluno e encarregado
        // antes de atualizar o estado para evitar aprovações parciais.
        if (estado === 'aprovada') {
            validarInscricaoParaAprovacao(inscricao);
            integracao = await integrarInscricaoAprovada(inscricao);

            if (integracao.createdUser && integracao.temporaryPassword) {
                await enviarEmailCredenciaisIniciais(
                    integracao.nomeAluno,
                    integracao.email,
                    integracao.temporaryPassword
                );

                console.log(
                    `Email enviado para ${integracao.email} com inscrição aprovada`
                );
            }

            if (
                integracao.encarregadoUserCreated &&
                integracao.encarregadoTemporaryPassword &&
                integracao.encarregadoEmail &&
                !integracao.encarregadoEmail.includes('@placeholder.local')
            ) {
                await enviarEmailContaCriadaEE(
                    integracao.nomeAluno,
                    integracao.encarregadoEmail,
                    integracao.encarregadoTemporaryPassword
                ).catch((err) => {
                    console.error(
                        'Erro ao enviar email de credenciais ao encarregado:',
                        err.message
                    );
                });

                console.log(
                    `Email enviado para ${integracao.encarregadoEmail} (encarregado) com inscrição aprovada`
                );
            }
        }

        // Atualizar estado
        const { rows } = await db.query(
            `
                UPDATE public.inscricoes_publicas
                SET estado = $1
                WHERE id_inscricao_publica = $2
                RETURNING *
            `,
            [estado, id]
        );

        await registarUpdate(
            req.userId ?? null,
            'inscricoes_publicas',
            id,
            { estado: estadoAnterior },
            {
                estado,
                nome_completo: inscricao?.nome_completo || null,
                email: inscricao?.email || null,
            },
            'alert'
        );

        return res.status(200).json({
            message: 'Estado atualizado com sucesso.',
            inscricao: rows[0],
        });
    } catch (error) {
        console.error('Erro ao atualizar estado da inscrição:', error.message);

        if (error?.code === '23505') {
            return res.status(400).json({
                message: getDuplicateErrorMessage(error),
                detail: error?.detail || error.message,
            });
        }

        if (error?.code === '23502') {
            return res.status(400).json({
                message: `Não foi possível aprovar: campo obrigatório em falta (${error.column || 'desconhecido'}).`,
                detail: error?.detail || error.message,
            });
        }

        if (error?.code === '23514') {
            return res.status(400).json({
                message:
                    'Não foi possível aprovar: valor inválido para uma regra de validação da base de dados.',
                detail: error?.detail || error.message,
            });
        }

        const statusCode = Number.isInteger(error?.statusCode)
            ? error.statusCode
            : 500;

        return res.status(statusCode).json({
            message:
                statusCode >= 500
                    ? 'Erro ao atualizar estado da inscrição.'
                    : error.message,
            detail: error?.detail || error.message,
        });
    }
}

// Campos simples (texto) que o gestor pode corrigir antes de aprovar/rejeitar
const CAMPOS_EDITAVEIS_INSCRICAO = [
    'nome_completo',
    'email',
    'telemovel',
    'escola',
    'turma',
    'ee_nome',
];

/**
 * Quando o gestor corrige um campo de uma inscrição pública que já foi aprovada
 * (já existe um aluno criado), propaga a correção para os registos reais do
 * aluno/encarregado, em vez de a correção ficar presa apenas na inscrição.
 */
async function sincronizarAlunoComInscricaoPublica(emailAntesDaEdicao, inscricao) {
    if (!emailAntesDaEdicao) {
        return { synced: false };
    }

    const userResult = await db.query(
        `SELECT id_user FROM users WHERE LOWER(email) = LOWER($1) AND role = 'aluno' LIMIT 1`,
        [emailAntesDaEdicao]
    );
    const idUser = userResult.rows[0]?.id_user;
    if (!idUser) {
        return { synced: false };
    }

    const alunoResult = await db.query(
        `SELECT id_aluno, id_pessoa, id_encarregado FROM alunos WHERE id_user = $1 LIMIT 1`,
        [idUser]
    );
    const aluno = alunoResult.rows[0];
    if (!aluno) {
        return { synced: false };
    }

    await db.query(
        `UPDATE pessoas SET nome = COALESCE($1, nome), telemovel = COALESCE($2, telemovel) WHERE id_pessoa = $3`,
        [inscricao.nome_completo || null, inscricao.telemovel || null, aluno.id_pessoa]
    );

    await db.query(
        `UPDATE alunos SET escola = COALESCE($1, escola), turma = COALESCE($2, turma) WHERE id_aluno = $3`,
        [inscricao.escola || null, inscricao.turma || null, aluno.id_aluno]
    );

    if (inscricao.ee_nome && aluno.id_encarregado) {
        await db.query(
            `UPDATE pessoas SET nome = $1 WHERE id_pessoa = (SELECT id_pessoa FROM encarregados WHERE id_encarregado = $2)`,
            [inscricao.ee_nome, aluno.id_encarregado]
        );
    }

    let emailSincronizado = true;
    if (
        inscricao.email &&
        inscricao.email.toLowerCase() !== String(emailAntesDaEdicao).toLowerCase()
    ) {
        try {
            await db.query(`UPDATE users SET email = $1 WHERE id_user = $2`, [
                inscricao.email,
                idUser,
            ]);
        } catch (err) {
            if (err?.code === '23505') {
                emailSincronizado = false;
            } else {
                throw err;
            }
        }
    }

    return { synced: true, idUser, idAluno: aluno.id_aluno, emailSincronizado };
}

/**
 * PATCH /api/gestor/inscricoes-publicas/:id
 * Permite ao gestor corrigir campos da inscrição pública (ex: número de telemóvel
 * com um dígito a mais) e o plano de estudo (que pode ter várias disciplinas)
 * antes de aprovar ou rejeitar.
 */
export async function atualizarCamposInscricaoPublica(req, res) {
    try {
        await ensureInscricoesPublicasTable();

        const id = Number.parseInt(req.params?.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'ID inválido.' });
        }

        // Capturar o email atual antes de editar: é a chave usada para encontrar
        // o aluno já criado (se a inscrição já tiver sido aprovada anteriormente).
        const existingResult = await db.query(
            `SELECT email FROM public.inscricoes_publicas WHERE id_inscricao_publica = $1`,
            [id]
        );
        if (!existingResult.rows.length) {
            return res
                .status(404)
                .json({ message: 'Inscrição não encontrada.' });
        }
        const emailAntesDaEdicao = existingResult.rows[0].email;

        const body = req.body || {};
        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        const dadosPatch = {};

        for (const field of CAMPOS_EDITAVEIS_INSCRICAO) {
            if (!Object.prototype.hasOwnProperty.call(body, field)) {
                continue;
            }

            const value = String(body[field] ?? '').trim();
            if (!value) {
                return res.status(400).json({
                    message: `Campo '${field}' não pode ficar vazio.`,
                });
            }

            setClauses.push(`${field} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
            dadosPatch[field] = value;
        }

        if (Array.isArray(body.plano) && body.plano.length > 0) {
            const plano = body.plano.map((item) => ({
                disciplina: String(item?.disciplina ?? '').trim(),
                tipo_servico: String(item?.tipo_servico ?? '').trim(),
                modalidade: String(item?.modalidade ?? '').trim(),
                pacote: String(item?.pacote ?? '').trim(),
            }));

            for (let i = 0; i < plano.length; i++) {
                if (!plano[i].disciplina || !plano[i].modalidade) {
                    return res.status(400).json({
                        message: `Plano ${i + 1}: disciplina e modalidade são obrigatórias.`,
                    });
                }
            }

            const first = plano[0];
            setClauses.push(`disciplina = $${paramIndex}`);
            values.push(first.disciplina);
            paramIndex++;
            setClauses.push(`tipo_servico = $${paramIndex}`);
            values.push(first.tipo_servico || null);
            paramIndex++;
            setClauses.push(`modalidade = $${paramIndex}`);
            values.push(first.modalidade);
            paramIndex++;
            setClauses.push(`pacote = $${paramIndex}`);
            values.push(first.pacote || null);
            paramIndex++;

            dadosPatch.plano = plano;
            dadosPatch.disciplina = first.disciplina;
            dadosPatch.tipo_servico = first.tipo_servico;
            dadosPatch.modalidade = first.modalidade;
            dadosPatch.pacote = first.pacote;
        }

        if (setClauses.length === 0) {
            return res
                .status(400)
                .json({ message: 'Nenhum campo válido para atualizar.' });
        }

        setClauses.push(`dados = COALESCE(dados, '{}'::jsonb) || $${paramIndex}::jsonb`);
        values.push(JSON.stringify(dadosPatch));
        paramIndex++;
        setClauses.push(`updated_at = NOW()`);

        values.push(id);

        const { rows } = await db.query(
            `
                UPDATE public.inscricoes_publicas
                SET ${setClauses.join(', ')}
                WHERE id_inscricao_publica = $${paramIndex}
                RETURNING *
            `,
            values
        );

        if (!rows.length) {
            return res
                .status(404)
                .json({ message: 'Inscrição não encontrada.' });
        }

        await registarUpdate(
            req.userId ?? null,
            'inscricoes_publicas',
            id,
            null,
            dadosPatch,
            'alert'
        );

        let alunoSincronizado = null;
        try {
            alunoSincronizado = await sincronizarAlunoComInscricaoPublica(
                emailAntesDaEdicao,
                rows[0]
            );
        } catch (syncError) {
            console.warn(
                '[inscricaoController] Falha ao sincronizar aluno a partir da inscrição:',
                syncError.message
            );
        }

        return res.status(200).json({
            message: alunoSincronizado?.synced
                ? 'Inscrição e ficha do aluno atualizadas com sucesso.'
                : 'Inscrição atualizada com sucesso.',
            inscricao: rows[0],
            alunoSincronizado: Boolean(alunoSincronizado?.synced),
        });
    } catch (error) {
        console.error(
            'Erro ao atualizar campos da inscrição pública:',
            error.message
        );
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar inscrição.' });
    }
}

export async function apagarInscricoesPublicasAntigas(req, res) {
    try {
        await ensureInscricoesPublicasTable();

        const dias = Number.parseInt(req.query?.dias, 10);
        const retentionDays = Number.isInteger(dias) ? dias : 90;

        if (retentionDays < 1 || retentionDays > 3650) {
            return res.status(400).json({
                message:
                    'Parâmetro dias inválido. Use um valor entre 1 e 3650.',
            });
        }

        const { rowCount } = await db.query(
            `
                DELETE FROM public.inscricoes_publicas
                WHERE created_at < NOW() - make_interval(days => $1::int)
                  AND LOWER(COALESCE(estado, 'pendente')) <> 'pendente'
            `,
            [retentionDays]
        );

        await registarDelete(
            req.userId ?? null,
            'inscricoes_publicas',
            null,
            {
                removidas: rowCount || 0,
                dias: retentionDays,
                criterio: 'estado != pendente e created_at antigo',
            },
            'alert'
        );

        return res.status(200).json({
            message: 'Inscrições antigas removidas com sucesso.',
            removidas: rowCount || 0,
            dias: retentionDays,
        });
    } catch (error) {
        console.error(
            'Erro ao apagar inscrições públicas antigas:',
            error.message
        );
        return res.status(500).json({
            message: 'Erro ao apagar inscrições públicas antigas.',
        });
    }
}
