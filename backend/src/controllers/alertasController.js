import { db } from '../config/db.js';

const EXCLUDED_ALERT_CODES = new Set(['salas-disponiveis', 'manutencao-salas']);

async function ensureRenovacaoMatriculaAlertDefinition() {
    const codigo = 'renovacao-matricula';

    const existing = await db.query(
        `
            SELECT id_alerta_definicao
            FROM alertas_definicoes
            WHERE codigo = $1
            LIMIT 1
        `,
        [codigo]
    );

    if (existing.rows[0]?.id_alerta_definicao) {
        return existing.rows[0].id_alerta_definicao;
    }

    const inserted = await db.query(
        `
            INSERT INTO alertas_definicoes (
                grupo,
                codigo,
                titulo,
                descricao,
                icone,
                canal_app_default,
                canal_email_default,
                canal_sms_default,
                ativo,
                ordenacao
            )
            VALUES ($1, $2, $3, $4, $5, true, true, false, true, $6)
            RETURNING id_alerta_definicao
        `,
        [
            'academico',
            codigo,
            'Renovação da matrícula',
            'Notificação sobre renovação de matrícula do aluno.',
            'RefreshCcw',
            40,
        ]
    );

    return inserted.rows[0]?.id_alerta_definicao || null;
}

/**
 * ========================================
 * ALERTAS CONTROLLER
 * ========================================
 * Responsável pela gestão de alertas (definições, preferências do utilizador e eventos)
 * ========================================
 */

/**
 * GET /api/alertas
 * Lista todas as definições de alertas disponíveis, agrupadas por categoria
 * Público - sem autenticação obrigatória
 *
 * Response: {
 *   success: boolean,
 *   data: {
 *     financeiro: [{id, codigo, titulo, descricao, icone, canal_app_default, canal_email_default}],
 *     academico: [...],
 *     operacional: [...],
 *     sistema: [...]
 *   }
 * }
 */
export async function obterDefinicoes(req, res) {
    try {
        await ensureRenovacaoMatriculaAlertDefinition();

        const query = `
      SELECT 
        id_alerta_definicao,
        grupo,
        codigo,
        titulo,
        descricao,
        icone,
        canal_app_default,
        canal_email_default,
        canal_sms_default,
        ativo,
        ordenacao
      FROM alertas_definicoes
      WHERE ativo = true
      ORDER BY grupo, ordenacao, titulo
    `;

        const { rows } = await db.query(query);

        // Group by categoria (grupo)
        const grouped = {};
        rows.forEach((row) => {
            if (EXCLUDED_ALERT_CODES.has(row.codigo)) {
                return;
            }

            if (!grouped[row.grupo]) {
                grouped[row.grupo] = [];
            }
            grouped[row.grupo].push({
                id: row.id_alerta_definicao,
                codigo: row.codigo,
                titulo: row.titulo,
                descricao: row.descricao,
                icone: row.icone,
                canal_app_default: row.canal_app_default,
                canal_email_default: row.canal_email_default,
                canal_sms_default: row.canal_sms_default,
            });
        });

        res.json({
            success: true,
            data: grouped,
        });
    } catch (error) {
        console.error(
            '[alertasController] obterDefinicoes error:',
            error.message
        );
        res.status(500).json({
            success: false,
            message: 'Erro ao obter definições de alertas',
        });
    }
}

/**
 * GET /api/alertas/minhas-preferencias
 * Obtém preferências pessoais do utilizador autenticado
 * Combine com alertas_definicoes para dados completos
 *
 * Headers: {X-User-Id: number}
 * Response: {
 *   success: boolean,
 *   data: [
 *     {
 *       id_alerta_preferencia: number,
 *       id_alerta_definicao: number,
 *       codigo: string,
 *       titulo: string,
 *       grupo: string,
 *       canal_app: boolean,
 *       canal_email: boolean,
 *       ativo: boolean
 *     }
 *   ]
 * }
 */
export async function obterMinhasPreferencias(req, res) {
    try {
        const idUser = req.userId;

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        const query = `
      SELECT 
        ap.id_alerta_preferencia,
        ap.id_alerta_definicao,
        ad.codigo,
        ad.titulo,
        ad.grupo,
        ad.icone,
        ap.canal_app,
        ap.canal_email,
        ap.canal_sms,
        ap.ativo
      FROM alertas_preferencias_utilizador ap
      JOIN alertas_definicoes ad ON ad.id_alerta_definicao = ap.id_alerta_definicao
      WHERE ap.id_user = $1
      ORDER BY ad.grupo, ad.ordenacao
    `;

        const { rows } = await db.query(query, [idUser]);

        res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error(
            '[alertasController] obterMinhasPreferencias error:',
            error.message
        );
        res.status(500).json({
            success: false,
            message: 'Erro ao obter preferências de alertas',
        });
    }
}

/**
 * POST /api/alertas/preferencias
 * Atualiza ou cria preferência de alerta para o utilizador autenticado
 * Utiliza função PL/pgSQL fn_upsert_alerta_preferencia
 *
 * Headers: {X-User-Id: number}
 * Body: {
 *   codigo: string (machine-readable alert code, ex: 'faturas-vencidas'),
 *   canal_app?: boolean,
 *   canal_email?: boolean,
 *   ativo?: boolean
 * }
 * Response: {
 *   success: boolean,
 *   data: {id_alerta_preferencia, id_user, id_alerta_definicao, ...}
 * }
 */
export async function atualizarPreferencias(req, res) {
    try {
        const idUser = req.userId;
        const { codigo, canal_app, canal_email, canal_sms, ativo } = req.body;

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        if (!codigo) {
            return res.status(400).json({
                success: false,
                message: "Campo 'codigo' é obrigatório",
            });
        }

        // Call PL/pgSQL upsert function
        const query = `
      SELECT * FROM fn_upsert_alerta_preferencia(
        $1,  -- p_id_user
        $2,  -- p_codigo
        $3,  -- p_canal_app
        $4,  -- p_canal_email
        $5,  -- p_canal_sms
        $6   -- p_ativo
      )
    `;

        const { rows } = await db.query(query, [
            idUser,
            codigo,
            canal_app !== undefined ? canal_app : null,
            canal_email !== undefined ? canal_email : null,
            canal_sms !== undefined ? canal_sms : null,
            ativo !== undefined ? ativo : null,
        ]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alerta não encontrado',
            });
        }

        const result = rows[0];

        res.json({
            success: true,
            data: {
                id_alerta_preferencia: result.id_alerta_preferencia,
                id_user: result.id_user,
                id_alerta_definicao: result.id_alerta_definicao,
                canal_app: result.canal_app,
                canal_email: result.canal_email,
                canal_sms: result.canal_sms,
                ativo: result.ativo,
                atualizado_em: result.atualizado_em,
            },
        });
    } catch (error) {
        console.error(
            '[alertasController] atualizarPreferencias error:',
            error.message
        );
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar preferências de alertas',
        });
    }
}

/**
 * POST /api/alertas/marcar-lido
 * Marca um evento de alerta como lido
 *
 * Headers: {X-User-Id: number}
 * Body: {
 *   id_alerta_evento: number
 * }
 * Response: {
 *   success: boolean,
 *   message: string
 * }
 */
export async function marcarLido(req, res) {
    try {
        const idUser = req.userId;
        const { id_alerta_evento } = req.body;

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        if (!id_alerta_evento) {
            return res.status(400).json({
                success: false,
                message: "Campo 'id_alerta_evento' é obrigatório",
            });
        }

        const { rows } = await db.query(
            `SELECT public.fn_marcar_alerta_lido($1, $2) AS marcado`,
            [id_alerta_evento, idUser]
        );

        if (rows[0]?.marcado !== true) {
            return res.status(404).json({
                success: false,
                message: 'Evento de alerta não encontrado ou sem permissão',
            });
        }

        res.json({
            success: true,
            message: 'Evento marcado como lido',
        });
    } catch (error) {
        console.error('[alertasController] marcarLido error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar alerta como lido',
        });
    }
}

/**
 * GET /api/alertas/eventos
 * Lista eventos de alertas do utilizador autenticado
 * Com paginação e filtros opcionais
 *
 * Headers: {X-User-Id: number}
 * Query params: {
 *   limite?: number (default 50),
 *   offset?: number (default 0),
 *   lido?: boolean (filtro por status lido/não lido),
 *   grupo?: string (filtro por grupo de alerta)
 * }
 * Response: {
 *   success: boolean,
 *   data: [...events],
 *   total: number,
 *   limite: number,
 *   offset: number
 * }
 */
export async function listarEventos(req, res) {
    try {
        const idUser = req.userId;
        const { limite = 15, offset = 0, lido, grupo, canal } = req.query;
        const pageLimit = Math.min(15, Math.max(1, parseInt(limite, 10) || 15));

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        // Build WHERE clause with optional filters
        let whereClause = 'ae.id_user = $1';
        const params = [idUser];
        let paramIndex = 2;

        const canalNormalizado = String(canal || 'app')
            .trim()
            .toLowerCase();

        if (canalNormalizado === 'app' || canalNormalizado === 'email') {
            whereClause += ` AND ae.canal = $${paramIndex}`;
            params.push(canalNormalizado);
            paramIndex++;
        }

        if (lido !== undefined && lido !== '') {
            const lidoValue = lido === 'true' || lido === '1' || lido === true;
            whereClause += ` AND ae.lido = $${paramIndex}`;
            params.push(lidoValue);
            paramIndex++;
        }

        if (grupo) {
            whereClause += ` AND ae.grupo = $${paramIndex}`;
            params.push(grupo);
            paramIndex++;
        }

        // Count total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM vw_alertas_eventos_detalhe ae
            WHERE ${whereClause}
        `;

        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total, 10);

        // Fetch events
        const dataQuery = `
      SELECT 
        ae.id_alerta_evento,
        ae.id_alerta_definicao,
                ae.canal,
        ae.codigo,
        ae.titulo,
        ae.grupo,
        ad.icone,
        ae.nivel,
        ae.payload,
        ae.lido,
        ae.lido_em,
        ae.criado_em
      FROM vw_alertas_eventos_detalhe ae
      LEFT JOIN alertas_definicoes ad ON ad.id_alerta_definicao = ae.id_alerta_definicao
      WHERE ${whereClause}
      ORDER BY ae.criado_em DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        params.push(pageLimit, parseInt(offset, 10));

        const { rows } = await db.query(dataQuery, params);

        res.json({
            success: true,
            data: rows,
            total,
            limite: pageLimit,
            offset: parseInt(offset, 10),
        });
    } catch (error) {
        console.error(
            '[alertasController] listarEventos error:',
            error.message
        );
        res.status(500).json({
            success: false,
            message: 'Erro ao listar eventos de alertas',
        });
    }
}
