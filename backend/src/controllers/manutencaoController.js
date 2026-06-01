import { db } from '../config/db.js';
import { dispatchAlertaManutencao } from '../services/alertasDispatchService.js';
import { enviarPushBroadcast } from '../services/pushNotificationService.js';

/**
 * ========================================
 * MANUTENCAO CONTROLLER
 * ========================================
 * Responsável pela gestão de avisos de manutenção e notificações do sistema.
 * Fornece operações CRUD para avisos de manutenão e envio de notificações broadcast.
 * ========================================
 */

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
 * Normaliza valor booleano aceitando múltiplas representações
 * Suporta: true, 'true', '1', 'sim', 's' (PT) e false, 'false', '0', 'não', 'nao', 'n' (PT)
 *
 * @param {*} value - Valor a normalizar
 * @param {boolean} fallback - Valor default se indeterminado
 * @returns {boolean} Valor normalizado
 */
function normalizeBoolean(value, fallback = true) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value == null) {
        return fallback;
    }

    const text = String(value).trim().toLowerCase();
    if (['true', '1', 'sim', 's', 'ativo', 'active', 't'].includes(text)) {
        return true;
    }

    if (
        ['false', '0', 'nao', 'não', 'n', 'inativo', 'inactive', 'f'].includes(
            text
        )
    ) {
        return false;
    }

    return fallback;
}

/**
 * Insere novo registo de log na tabela logs
 * Utilizado para auditar qualquer tipo de ação no sistema
 *
 * @param {Object} params - Parâmetros
 * @param {number|null} params.idUser - ID do utilizador que fez a ação
 * @param {string} params.acao - Tipo de ação (INSERT, UPDATE, DELETE)
 * @param {string} params.entidade - Tipo de entidade afetada (ex: 'manutencao_aviso')
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
 * Cria novo aviso de manutenção e regista nos logs
 * Executa INSERT+UPDATE para vincular o registo a si mesmo via entidade_id
 *
 * @param {Object} params - Parâmetros
 * @param {number|null} params.idUser - ID do utilizador
 * @param {string} params.titulo - Título do aviso
 * @param {string|null} params.descricao - Descrição opcional
 * @param {boolean|string} params.ativa - Se o aviso está ativo
 * @returns {Object|null} Registo criado ou null
 */
async function criarAvisoLog({ idUser, titulo, descricao, ativa }) {
    const createQuery = `
    INSERT INTO logs (id_user, acao, entidade, entidade_id, detalhes)
    VALUES ($1, 'INSERT', 'manutencao_aviso', NULL, $2)
    RETURNING id_log, created_at, detalhes
  `;

    const detalhes = JSON.stringify({
        titulo,
        descricao: descricao || '',
        ativa: normalizeBoolean(ativa, true),
    });

    const createResult = await db.query(createQuery, [
        idUser ?? null,
        detalhes,
    ]);
    const created = createResult.rows[0] || null;

    if (!created) {
        return null;
    }

    const syncQuery = `
    UPDATE logs
    SET entidade_id = $1
    WHERE id_log = $1
    RETURNING id_log, created_at, detalhes
  `;

    const syncResult = await db.query(syncQuery, [created.id_log]);
    return syncResult.rows[0] || created;
}

/**
 * Converte registo de log para formato DTO de aviso de manutenção
 * Extrai dados do JSON em detalhes e normaliza campos
 *
 * @param {Object} row - Registo de log
 * @returns {Object} DTO com {id, titulo, descricao, ativa, criadaEm}
 */
function toMaintenanceDto(row) {
    const detalhes = safeJsonParse(row.detalhes, {});

    return {
        id: Number(row.entidade_id || row.id_log),
        titulo: String(detalhes.titulo || ''),
        descricao: String(detalhes.descricao || ''),
        ativa: normalizeBoolean(detalhes.ativa, true),
        criadaEm: row.created_at
            ? new Date(row.created_at).toISOString().split('T')[0]
            : null,
    };
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
 * Cria novo aviso de manutenção e envia notificação broadcast
 *
 * @param {Object} req - Objecto de requisição com body {titulo, descricao, ativa}
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} DTO do aviso criado ou erro 400/500
 */
export async function criarAvisoManutencao(req, res) {
    try {
        const { titulo, descricao, ativa } = req.body;

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ message: 'Título é obrigatório' });
        }

        const created = await criarAvisoLog({
            idUser: req.userId ?? null,
            titulo: String(titulo).trim(),
            descricao,
            ativa,
        });

        await inserirLog({
            idUser: req.userId ?? null,
            acao: 'INSERT',
            entidade: 'notificacao_broadcast',
            payload: {
                tipo: 'manutencao',
                titulo: `Aviso de Manutenção: ${String(titulo).trim()}`,
                descricao: descricao || '',
                nivel: 'warning',
            },
        });

        if (!created) {
            return res
                .status(500)
                .json({ message: 'Erro ao criar aviso de manutenção' });
        }

        const novoAviso = toMaintenanceDto({
            id_log: created.id_log,
            entidade_id: created.id_log,
            detalhes: created.detalhes,
            created_at: created.created_at,
        });

        // Dispatch alert to all users about maintenance
        try {
            await dispatchAlertaManutencao({
                titulo: `Aviso de Manutenção: ${String(titulo).trim()}`,
                descricao: descricao || 'Manutenção planejada do sistema',
            });
        } catch (alertError) {
            console.warn(
                'Aviso: erro ao disparar alerta de manutenção:',
                alertError.message
            );
            // Não bloqueia a criação do aviso se o alerta falhar
        }

        return res.status(201).json(novoAviso);
    } catch (error) {
        console.error('Erro ao criar aviso:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao criar aviso de manutenção' });
    }
}

/**
 * Lista todos os avisos de manutenção ativos
 * Filtra registos com acao != 'DELETE' para obter apenas avisos não removidos
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Array de avisos em ordem decrescente de ID
 */
export async function listarAvisosManutencao(req, res) {
    try {
        const query = `
      SELECT DISTINCT ON (COALESCE(entidade_id, id_log))
        id_log,
        entidade_id,
        acao,
        detalhes,
        created_at
      FROM logs
      WHERE entidade = 'manutencao_aviso'
      ORDER BY COALESCE(entidade_id, id_log), created_at DESC, id_log DESC
    `;

        const { rows } = await db.query(query);

        const avisos = rows
            .filter((row) => String(row.acao || '').toUpperCase() !== 'DELETE')
            .map(toMaintenanceDto)
            .sort((a, b) => Number(b.id) - Number(a.id));

        return res.json(avisos);
    } catch (error) {
        console.error('Erro ao listar avisos:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao listar avisos de manutenção' });
    }
}

/**
 * Atualiza aviso de manutenção existente
 * Insere novo registo UPDATE nos logs para manter histórico
 *
 * @param {Object} req - Objecto de requisição com body {titulo, descricao, ativa}
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} DTO do aviso atualizado ou erro 400/404/500
 */
export async function atualizarAvisoManutencao(req, res) {
    try {
        const id = Number(req.params.id);
        const { titulo, descricao, ativa } = req.body;

        if (!Number.isInteger(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const currentQuery = `
      SELECT id_log, entidade_id, acao, detalhes, created_at
      FROM logs
      WHERE entidade = 'manutencao_aviso'
        AND COALESCE(entidade_id, id_log) = $1
      ORDER BY created_at DESC, id_log DESC
      LIMIT 1
    `;

        const currentResult = await db.query(currentQuery, [id]);
        const current = currentResult.rows[0];

        if (!current || String(current.acao || '').toUpperCase() === 'DELETE') {
            return res.status(404).json({ message: 'Aviso não encontrado' });
        }

        const detalhesAtuais = safeJsonParse(current.detalhes, {});
        const nextPayload = {
            titulo:
                titulo !== undefined
                    ? String(titulo).trim()
                    : String(detalhesAtuais.titulo || ''),
            descricao:
                descricao !== undefined
                    ? String(descricao)
                    : String(detalhesAtuais.descricao || ''),
            ativa:
                ativa !== undefined
                    ? normalizeBoolean(ativa, true)
                    : normalizeBoolean(detalhesAtuais.ativa, true),
        };

        const updated = await inserirLog({
            idUser: req.userId ?? null,
            acao: 'UPDATE',
            entidade: 'manutencao_aviso',
            entidadeId: id,
            payload: nextPayload,
        });

        const dto = toMaintenanceDto({
            id_log: updated.id_log,
            entidade_id: id,
            detalhes: updated.detalhes,
            created_at: updated.created_at,
        });

        return res.json(dto);
    } catch (error) {
        console.error('Erro ao atualizar aviso:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao atualizar aviso de manutenção' });
    }
}

/**
 * Remove (marca como deletado) um aviso de manutenção
 * Não elimina fisicamente da BD, apenas regista DELETE nos logs
 *
 * @param {Object} req - Objecto de requisição com params.id
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} DTO do aviso removido ou erro 400/404/500
 */
export async function removerAvisoManutencao(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const currentQuery = `
      SELECT id_log, entidade_id, acao, detalhes, created_at
      FROM logs
      WHERE entidade = 'manutencao_aviso'
        AND COALESCE(entidade_id, id_log) = $1
      ORDER BY created_at DESC, id_log DESC
      LIMIT 1
    `;

        const currentResult = await db.query(currentQuery, [id]);
        const current = currentResult.rows[0];

        if (!current || String(current.acao || '').toUpperCase() === 'DELETE') {
            return res.status(404).json({ message: 'Aviso não encontrado' });
        }

        await inserirLog({
            idUser: req.userId ?? null,
            acao: 'DELETE',
            entidade: 'manutencao_aviso',
            entidadeId: id,
            payload: safeJsonParse(current.detalhes, {}),
        });

        return res.json(toMaintenanceDto(current));
    } catch (error) {
        console.error('Erro ao remover aviso:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao remover aviso de manutenção' });
    }
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
                '[manutencaoController] Falha no envio push Firebase:',
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
