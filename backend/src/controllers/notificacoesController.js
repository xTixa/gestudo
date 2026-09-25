import { db } from '../config/db.js';
import { enviarPushBroadcast } from '../services/pushNotificationService.js';

function getPlatform(value) {
    const normalized = String(value || 'web')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return 'web';
    }

    return normalized.slice(0, 30);
}

export async function registarDeviceToken(req, res) {
    try {
        const idUser = req.userId;
        const token = String(req.body?.token || '').trim();
        const plataforma = getPlatform(req.body?.plataforma);

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        if (!token || token.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Token FCM inválido',
            });
        }

        const query = `
      INSERT INTO notificacoes_device_tokens (
        id_user,
        token,
        plataforma,
        ativo,
        ultimo_registo_em
      )
      VALUES ($1, $2, $3, true, NOW())
      ON CONFLICT (token)
      DO UPDATE SET
        id_user = EXCLUDED.id_user,
        plataforma = EXCLUDED.plataforma,
        ativo = true,
        ultimo_registo_em = NOW(),
        updated_at = NOW()
      RETURNING id_notificacao_device_token, id_user, plataforma, ativo, ultimo_registo_em
    `;

        const { rows } = await db.query(query, [idUser, token, plataforma]);

        return res.status(200).json({
            success: true,
            message: 'Token registado com sucesso',
            data: rows[0] || null,
        });
    } catch (error) {
        console.error(
            '[notificacoesController] registarDeviceToken error:',
            error.message
        );
        return res.status(500).json({
            success: false,
            message: 'Erro ao registar token de notificações',
        });
    }
}

export async function removerDeviceToken(req, res) {
    try {
        const idUser = req.userId;
        const token = String(req.body?.token || '').trim();

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        if (!token || token.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Token FCM inválido',
            });
        }

        const query = `
      UPDATE notificacoes_device_tokens
      SET ativo = false,
          updated_at = NOW()
      WHERE id_user = $1
        AND token = $2
      RETURNING id_notificacao_device_token
    `;

        const { rowCount } = await db.query(query, [idUser, token]);

        return res.status(200).json({
            success: true,
            removed: rowCount,
        });
    } catch (error) {
        console.error(
            '[notificacoesController] removerDeviceToken error:',
            error.message
        );
        return res.status(500).json({
            success: false,
            message: 'Erro ao remover token de notificações',
        });
    }
}

/**
 * Faz parse de JSON com fallback seguro
 * Retorna objecto default se JSON inválido
 *
 * @param {*} value - String JSON a fazer parse
 * @param {*} fallback - Valor default se parse falhar
 * @returns {*} Objecto parseado ou fallback
 */
function safeJsonParse(value, fallback = {}) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

/**
 * Insere novo registo de log na tabela logs
 * Utilizado para auditar qualquer tipo de ação no sistema
 *
 * @param {Object} params - Parâmetros
 * @param {number|null} params.idUser - ID do utilizador que fez a ação
 * @param {string} params.acao - Tipo de ação (INSERT, UPDATE, DELETE)
 * @param {string} params.entidade - Tipo de entidade afetada (ex: 'notificacao_broadcast')
 * @param {number|null} params.entidadeId - ID da entidade afetada
 * @param {Object} params.payload - Dados da operação em JSON
 * @returns {Object|null} Registo inserido ou null se falha
 */
async function inserirLog({
    idUser = null,
    acao,
    entidade,
    entidadeId = null,
    payload,
}) {
    const query = `
    INSERT INTO logs (id_user, acao, entidade, entidade_id, detalhes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_log, created_at, detalhes
  `;

    const { rows } = await db.query(query, [
        idUser,
        String(acao || 'INSERT').toUpperCase(),
        entidade,
        entidadeId,
        JSON.stringify(payload || {}),
    ]);

    return rows[0] || null;
}

/**
 * Converte registo de log para formato DTO de notificação
 * Extrai dados do JSON em detalhes e formata para exibição
 *
 * @param {Object} row - Registo de log
 * @returns {Object} DTO com {id, tipo, titulo, descricao, nivel, createdAt}
 */
function toNotificationDto(row) {
    const detalhes = safeJsonParse(row.detalhes, {});

    return {
        id: row.id_log,
        tipo: String(detalhes.tipo || 'geral'),
        titulo: String(detalhes.titulo || ''),
        descricao: String(detalhes.descricao || ''),
        nivel: String(detalhes.nivel || 'info'),
        createdAt: row.created_at,
    };
}

/**
 * Envia notificação broadcast para todos os utilizadores
 * Regista em logs com entidade 'notificacao_broadcast'
 *
 * @param {Object} req - Objecto com body {tipo, titulo, descricao, nivel}
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Notificação enviada ou erro 400/500
 */
export async function enviarNotificacao(req, res) {
    try {
        const { tipo, titulo, descricao, nivel } = req.body;

        if (!titulo || !String(titulo).trim()) {
            return res
                .status(400)
                .json({ message: 'Título da notificação é obrigatório' });
        }

        const created = await inserirLog({
            idUser: req.userId ?? null,
            acao: 'INSERT',
            entidade: 'notificacao_broadcast',
            payload: {
                tipo: tipo || 'geral',
                titulo: String(titulo).trim(),
                descricao: descricao || '',
                nivel: nivel || 'info',
            },
        });

        let pushResult = null;
        try {
            pushResult = await enviarPushBroadcast({
                tipo: tipo || 'geral',
                titulo: String(titulo).trim(),
                descricao: descricao || '',
                nivel: nivel || 'info',
                payload: {
                    origem: 'broadcast',
                },
            });
        } catch (pushError) {
            console.warn(
                '[notificacoesController] Falha no envio push Firebase:',
                pushError.message
            );
        }

        return res.status(201).json({
            success: true,
            message: 'Notificação enviada para todos os utilizadores',
            notification: toNotificationDto(created),
            push: pushResult,
        });
    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
        return res.status(500).json({ message: 'Erro ao enviar notificação' });
    }
}

/**
 * Lista últimas 100 notificações broadcast enviadas
 * Ordenadas por data de criação descendente (mais recentes em primeiro)
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Array de notificações
 */
export async function listarNotificacoes(req, res) {
    try {
        const query = `
      SELECT id_log, detalhes, created_at
      FROM logs
      WHERE entidade = 'notificacao_broadcast'
      ORDER BY created_at DESC, id_log DESC
      LIMIT 100
    `;

        const { rows } = await db.query(query);
        return res.json(rows.map(toNotificationDto));
    } catch (error) {
        console.error('Erro ao listar notificações:', error);
        return res.status(500).json({ message: 'Erro ao listar notificações' });
    }
}
