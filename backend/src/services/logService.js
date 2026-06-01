/**
 * Serviço de Logging
 * Regista ações dos utilizadores na tabela de logs
 */

import { db } from '../config/db.js';

// Normaliza o nome da entidade para um formato consistente, aplicando regras específicas para certos casos conhecidos. Isso ajuda a manter os logs mais uniformes e fáceis de analisar.
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

function normalizeLogLevel(value) {
    const base = String(value || 'info')
        .toLowerCase()
        .trim();

    const aliases = {
        critical: 'critical',
        critico: 'critical',
        error: 'error',
        erro: 'error',
        alert: 'alert',
        alerta: 'alert',
        warning: 'alert',
        warn: 'alert',
        info: 'info',
        informativo: 'info',
        informational: 'info',
    };

    return aliases[base] || 'info';
}

function inferLogLevel(acao, entidade, detalhes) {
    const action = String(acao || '').toUpperCase();
    const entity = normalizeEntityKey(entidade);
    const detailsText = String(detalhes ?? '').toLowerCase();

    if (entity === 'notificacao_broadcast') {
        return 'info';
    }

    if (action === 'DELETE') {
        if (
            ['professores', 'alunos', 'inscricoes_publicas'].includes(entity) ||
            entity.startsWith('servicos_')
        ) {
            return 'critical';
        }

        if (['disciplinas', 'modalidades', 'salas'].includes(entity)) {
            return 'alert';
        }

        return 'alert';
    }

    if (action === 'UPDATE') {
        if (
            entity === 'professores' ||
            entity === 'inscricoes_publicas' ||
            entity.startsWith('servicos_') ||
            entity === 'alunos'
        ) {
            if (
                /status|estado|ativo|inativ|suspend|bloque|termin|aprov|rejeit|renov/i.test(
                    detailsText
                )
            ) {
                return 'alert';
            }
        }
    }

    if (action === 'INSERT') {
        if (entity === 'inscricoes_publicas') {
            return 'alert';
        }
    }

    return 'info';
}

// Função recursiva para redigir campos sensíveis em um objeto, substituindo valores de chaves que contenham palavras como "password", "token" ou "hash" por "[oculto]". Isso é útil para garantir que informações confidenciais não sejam expostas nos logs.
function redactSensitive(data) {
    if (data == null) return data;

    if (Array.isArray(data)) {
        return data.map((item) => redactSensitive(item));
    }

    if (typeof data !== 'object') {
        return data;
    }

    const output = {};
    for (const [key, value] of Object.entries(data)) {
        const normalized = String(key).toLowerCase();
        if (
            normalized.includes('password') ||
            normalized.includes('token') ||
            normalized.includes('hash')
        ) {
            output[key] = '[oculto]';
        } else {
            output[key] = redactSensitive(value);
        }
    }

    return output;
}

// Função para converter um valor em uma string JSON segura para logging, aplicando a redacção de campos sensíveis e limitando o tamanho da string resultante. Se a conversão falhar, retorna um objeto vazio como string.
function safeJson(value) {
    try {
        return JSON.stringify(redactSensitive(value));
    } catch {
        return '{}';
    }
}

// Função para limitar o tamanho dos detalhes do log a um máximo de 1000 caracteres, garantindo que mesmo entradas muito grandes sejam truncadas para evitar problemas de armazenamento ou visualização. Também aplica a redacção de campos sensíveis antes de limitar o tamanho.
function limitDetails(value) {
    const safeText = String(value ?? '').replace(
        /(\"password\"\s*:\s*\")[^\"]*(\")/gi,
        '$1[oculto]$2'
    );
    return safeText.slice(0, 1000);
}

/**
 * Regista o log de ação na bd
 * @param {number|null} idUser - ID do utilizador que fez a ação
 * @param {string} acao - Tipo de ação (INSERT, UPDATE, DELETE)
 * @param {string} entidade - Nome da tabela/entidade
 * @param {number|null} entidadeId - ID da entidade afetada
 * @param {string} detalhes - Detalhes da ação (JSON ou descrição)
 * @param {string} nivel - Nível do log (critical, error, alert, info)
 */
export async function registarLog(
    idUser,
    acao,
    entidade,
    entidadeId,
    detalhes,
    nivel = null
) {
    try {
        const normalizedEntity = normalizeEntityKey(entidade);
        const normalizedLevel = normalizeLogLevel(
            nivel ?? inferLogLevel(acao, normalizedEntity, detalhes)
        );

        const query = `
      INSERT INTO public.logs (id_user, acao, entidade, entidade_id, detalhes, nivel)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_log, created_at
    `;

        const { rows } = await db.query(query, [
            idUser ?? null,
            String(acao).toUpperCase(),
            normalizedEntity,
            entidadeId ?? null,
            limitDetails(detalhes),
            normalizedLevel,
        ]);

        return rows[0] || null;
    } catch (error) {
        console.error('Erro ao registar log:', error.message);
        // Não lança erro para não interromper a operação principal
        return null;
    }
}

/**
 * Regista um INSERT
 * @param {number|null} idUser - ID do utilizador
 * @param {string} entidade - Nome da tabela
 * @param {object} novoRegisto - Dados inseridos
 * @param {number|null} entidadeId - ID da entidade (opcional)
 */
export async function registarInsert(
    idUser,
    entidade,
    novoRegisto,
    entidadeId = null,
    nivel = null
) {
    const detalhes = safeJson(novoRegisto);
    return registarLog(idUser, 'INSERT', entidade, entidadeId, detalhes, nivel);
}

/**
 * Regista um UPDATE
 * @param {number|null} idUser - ID do utilizador
 * @param {string} entidade - Nome da tabela
 * @param {number} entidadeId - ID da entidade atualizada
 * @param {object} dadosAntigos - Dados antes da alteração
 * @param {object} dadosNovos - Dados após a alteração
 */
export async function registarUpdate(
    idUser,
    entidade,
    entidadeId,
    dadosAntigos,
    dadosNovos,
    nivel = null
) {
    const detalhes = safeJson({
        antes: dadosAntigos,
        depois: dadosNovos,
    });
    return registarLog(idUser, 'UPDATE', entidade, entidadeId, detalhes, nivel);
}

/**
 * Regista um DELETE
 * @param {number|null} idUser - ID do utilizador
 * @param {string} entidade - Nome da tabela
 * @param {number} entidadeId - ID da entidade removida
 * @param {object} dadosRemovidos - Dados que foram removidos
 */
export async function registarDelete(
    idUser,
    entidade,
    entidadeId,
    dadosRemovidos,
    nivel = null
) {
    const detalhes = safeJson(dadosRemovidos);
    return registarLog(idUser, 'DELETE', entidade, entidadeId, detalhes, nivel);
}
