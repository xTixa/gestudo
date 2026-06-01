import { db } from '../config/db.js';

function normalizeEntityKey(value) {
    const base = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');

    const aliases = {
        servico_curricular: 'servicos_curriculares',
        servico_extra_curricular: 'servicos_extracurriculares',
        inscricao_publica: 'inscricoes_publicas',
    };

    return aliases[base] || base;
}

/**
 * ========================================
 * LOGS CONTROLLER
 * ========================================
 * Responsável pela gestão e visualização de logs de auditoria do sistema.
 * Fornece funcionalidades para listar todas as ações registadas (INSERT, UPDATE, DELETE).
 * ========================================
 */

/**
 * Lista todos os logs de auditoria registados no sistema (últimos 500 registos)
 * Inclui informações sobre quem fez o quê, quando e em que entidade
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Array com até 500 logs ordenados por data descendente (mais recentes em primeiro)
 */
export async function listarLogs(req, res) {
    try {
        const page = Math.max(1, Number(req.query?.page || 1));
        const limit = Math.min(
            200,
            Math.max(1, Number(req.query?.limit || 50))
        );
        const offset = (page - 1) * limit;

        const search = String(req.query?.search || '').trim();
        const action = String(req.query?.action || '').trim();
        const entity = String(req.query?.entity || '').trim();
        const user = String(req.query?.user || '').trim();
        const from = String(req.query?.from || '').trim();
        const to = String(req.query?.to || '').trim();
        const format = String(req.query?.format || '')
            .trim()
            .toLowerCase();

        const normalizedEntitySql = `
            CASE
                WHEN LOWER(REPLACE(REPLACE(TRIM(COALESCE(l.entidade, '')), ' ', '_'), '-', '_')) = 'servico_curricular' THEN 'servicos_curriculares'
                WHEN LOWER(REPLACE(REPLACE(TRIM(COALESCE(l.entidade, '')), ' ', '_'), '-', '_')) = 'servico_extra_curricular' THEN 'servicos_extracurriculares'
                WHEN LOWER(REPLACE(REPLACE(TRIM(COALESCE(l.entidade, '')), ' ', '_'), '-', '_')) = 'inscricao_publica' THEN 'inscricoes_publicas'
                ELSE LOWER(REPLACE(REPLACE(TRIM(COALESCE(l.entidade, '')), ' ', '_'), '-', '_'))
            END
        `;

        const whereClauses = [];
        const values = [];

        if (action) {
            values.push(action.toUpperCase());
            whereClauses.push(`UPPER(l.acao) = $${values.length}`);
        }

        if (entity) {
            values.push(normalizeEntityKey(entity));
            whereClauses.push(`${normalizedEntitySql} = $${values.length}`);
        }

        if (user) {
            values.push(user.toLowerCase());
            whereClauses.push(
                `LOWER(CASE WHEN l.id_user IS NULL THEN 'sistema' ELSE COALESCE(NULLIF(TRIM(u.email), ''), 'email indisponivel') END) = $${values.length}`
            );
        }

        if (search) {
            values.push(`%${search.toLowerCase()}%`);
            whereClauses.push(`(
        LOWER(COALESCE(l.acao, '')) LIKE $${values.length}
                OR ${normalizedEntitySql} LIKE $${values.length}
        OR LOWER(COALESCE(l.detalhes::text, '')) LIKE $${values.length}
        OR LOWER(CASE WHEN l.id_user IS NULL THEN 'sistema' ELSE COALESCE(NULLIF(TRIM(u.email), ''), 'email indisponivel') END) LIKE $${values.length}
      )`);
        }

        if (from) {
            values.push(from);
            whereClauses.push(`l.created_at >= $${values.length}::date`);
        }

        if (to) {
            values.push(to);
            whereClauses.push(
                `l.created_at < ($${values.length}::date + interval '1 day')`
            );
        }

        const whereSql = whereClauses.length
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';

        const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM logs l
    LEFT JOIN users u ON u.id_user = l.id_user
    ${whereSql}
  `;

        const dataQuery = `
      SELECT
        l.id_log,
        l.id_user,
        l.acao,
        l.nivel,
                ${normalizedEntitySql} AS entidade,
        l.entidade_id,
        l.detalhes,
        l.created_at,
        CASE
          WHEN l.id_user IS NULL THEN 'Sistema'
          ELSE COALESCE(NULLIF(TRIM(u.email), ''), 'Email indisponivel')
        END AS utilizador
      FROM logs l
      LEFT JOIN users u ON u.id_user = l.id_user
      ${whereSql}
      ORDER BY l.created_at DESC
        ${
            format === 'csv'
                ? ''
                : `LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}`
        }
    `;

        const [{ total }] = (await db.query(countQuery, values)).rows;
        const dataValues =
            format === 'csv' ? values : [...values, limit, offset];
        const { rows } = await db.query(dataQuery, dataValues);

        if (format === 'csv') {
            const escapeCsv = (value) => {
                const raw = String(value ?? '');
                if (
                    raw.includes(',') ||
                    raw.includes('"') ||
                    raw.includes('\n')
                ) {
                    return `"${raw.replace(/"/g, '""')}"`;
                }
                return raw;
            };

            const header = [
                'id_log',
                'nivel',
                'acao',
                'entidade',
                'entidade_id',
                'utilizador',
                'created_at',
                'detalhes',
            ];

            const lines = [header.join(',')];
            for (const log of rows) {
                lines.push(
                    [
                        log.id_log,
                        log.nivel,
                        log.acao,
                        log.entidade,
                        log.entidade_id,
                        log.utilizador,
                        log.created_at,
                        typeof log.detalhes === 'string'
                            ? log.detalhes
                            : JSON.stringify(log.detalhes),
                    ]
                        .map(escapeCsv)
                        .join(',')
                );
            }

            const filename = `logs-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${filename}"`
            );
            return res.status(200).send(lines.join('\n'));
        }

        return res.status(200).json({
            logs: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        });
    } catch (error) {
        console.error('Erro ao listar logs:', error.message);
        return res.status(500).json({ message: 'Erro ao obter logs.' });
    }
}
