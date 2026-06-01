import { db } from '../config/db.js';
import { getFirebaseMessaging } from './firebaseAdminService.js';

// Tamanho máximo recomendado para um lote de tokens do FCM, para evitar erros de payload muito grande. O FCM suporta até 1000 tokens por requisição, mas usar um número menor pode ajudar a reduzir a chance de falhas e melhorar o desempenho.
const FCM_BATCH_SIZE = 500;

// Função para extrair as credenciais do Firebase a partir das variáveis de ambiente, suportando tanto um JSON completo quanto as partes individuais (project_id, client_email, private_key)
function normalizeDataPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return {};
    }

    const data = {};
    for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (typeof value === 'string') {
            data[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            data[key] = String(value);
        } else {
            data[key] = JSON.stringify(value);
        }
    }

    return data;
}

// Função para dividir uma lista de tokens em lotes menores, com um tamanho máximo definido por FCM_BATCH_SIZE. Isso é necessário porque o FCM tem limites de payload e pode rejeitar requisições com muitos tokens.
function chunkTokens(tokens) {
    const batches = [];

    for (let index = 0; index < tokens.length; index += FCM_BATCH_SIZE) {
        batches.push(tokens.slice(index, index + FCM_BATCH_SIZE));
    }

    return batches;
}

// Função para normalizar o nome da entidade para um formato consistente, aplicando regras específicas para certos casos conhecidos. Isso ajuda a manter os logs mais uniformes e fáceis de analisar.
async function obterTokensAtivos() {
    const query = `
    SELECT id_notificacao_device_token, token
    FROM notificacoes_device_tokens
    WHERE ativo = true
    ORDER BY updated_at DESC
  `;

    const { rows } = await db.query(query);
    return rows;
}

// Obtém os tokens ativos apenas para um conjunto de utilizadores alvo.
async function obterTokensAtivosPorUtilizadores(userIds = []) {
    const ids = Array.from(
        new Set(
            userIds
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );

    if (!ids.length) {
        return [];
    }

    const query = `
    SELECT DISTINCT token
    FROM notificacoes_device_tokens
    WHERE ativo = true
      AND id_user = ANY($1::int[])
    ORDER BY token
  `;

    const { rows } = await db.query(query, [ids]);
    return rows;
}

// Função para desativar uma lista de tokens no banco de dados, marcando-os como inativos. Isso é útil para limpar tokens que foram identificados como inválidos ou que não estão mais em uso, evitando tentativas de envio de notificações para esses tokens no futuro.
async function desativarTokens(tokens = []) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
        return;
    }

    const query = `
    UPDATE notificacoes_device_tokens
    SET ativo = false,
        updated_at = NOW()
    WHERE token = ANY($1::text[])
  `;

    await db.query(query, [tokens]);
}

function resolveNotificationLink(link) {
    const normalizedLink = String(link || '').trim();
    const frontendBase = String(process.env.FRONTEND_URL || '').trim();

    if (!normalizedLink) {
        return frontendBase || '/';
    }

    if (/^https?:\/\//i.test(normalizedLink)) {
        return normalizedLink;
    }

    if (!frontendBase) {
        return normalizedLink.startsWith('/')
            ? normalizedLink
            : `/${normalizedLink}`;
    }

    try {
        return new URL(normalizedLink, frontendBase).toString();
    } catch {
        return normalizedLink.startsWith('/')
            ? normalizedLink
            : `/${normalizedLink}`;
    }
}

async function enviarPushParaTokens({
    tokens,
    tipo,
    titulo,
    descricao,
    nivel,
    payload,
    link,
}) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
        return {
            success: false,
            skipped: true,
            reason: 'firebase_not_configured',
            totalTokens: 0,
            successCount: 0,
            failureCount: 0,
        };
    }

    const tokenValues = Array.isArray(tokens)
        ? tokens.map((row) => row.token).filter(Boolean)
        : [];

    const totalTokens = tokenValues.length;
    if (totalTokens === 0) {
        return {
            success: true,
            skipped: true,
            reason: 'no_tokens',
            totalTokens,
            successCount: 0,
            failureCount: 0,
        };
    }

    const batches = chunkTokens(tokenValues);
    const invalidTokens = [];
    let successCount = 0;
    let failureCount = 0;

    const resolvedLink = resolveNotificationLink(link);
    const messageData = normalizeDataPayload({
        tipo: tipo || 'geral',
        nivel: nivel || 'info',
        link: resolvedLink,
        ...payload,
    });

    for (const batch of batches) {
        const result = await messaging.sendEachForMulticast({
            tokens: batch,
            notification: {
                title: String(titulo || 'Notificação'),
                body: String(descricao || ''),
            },
            data: messageData,
            webpush: {
                fcmOptions: {
                    link: resolvedLink,
                },
            },
        });

        successCount += result.successCount;
        failureCount += result.failureCount;

        result.responses.forEach((response, index) => {
            if (response.success) {
                return;
            }

            const code = String(response.error?.code || '');
            if (
                code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token'
            ) {
                invalidTokens.push(batch[index]);
            }
        });
    }

    if (invalidTokens.length > 0) {
        await desativarTokens(invalidTokens);
    }

    return {
        success: failureCount === 0,
        skipped: false,
        totalTokens,
        successCount,
        failureCount,
        invalidatedTokens: invalidTokens.length,
    };
}

// Função principal para enviar uma notificação push para todos os dispositivos registrados. Ela obtém os tokens ativos, divide-os em lotes, envia a notificação para cada lote e lida com os resultados, incluindo a identificação de tokens inválidos para desativação posterior. Retorna um resumo do resultado do envio, incluindo o número total de tokens, quantos foram enviados com sucesso, quantos falharam e quantos tokens foram invalidados.
export async function enviarPushBroadcast({
    tipo,
    titulo,
    descricao,
    nivel,
    payload,
    link,
}) {
    const tokensRows = await obterTokensAtivos();
    return enviarPushParaTokens({
        tokens: tokensRows,
        tipo,
        titulo,
        descricao,
        nivel,
        payload,
        link,
    });
}

// Envia um push apenas para utilizadores específicos, respeitando os tokens ativos registados.
export async function enviarPushParaUtilizadores({
    userIds = [],
    tipo,
    titulo,
    descricao,
    nivel,
    payload,
    link,
}) {
    const tokensRows = await obterTokensAtivosPorUtilizadores(userIds);
    return enviarPushParaTokens({
        tokens: tokensRows,
        tipo,
        titulo,
        descricao,
        nivel,
        payload,
        link,
    });
}
