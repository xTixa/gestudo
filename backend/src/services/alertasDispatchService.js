import { db } from '../config/db.js';
import { enviarEmailAlerta } from './emailService.js';
import { enviarMensagemAlerta } from './messageService.js';
import { enviarPushParaUtilizadores } from './pushNotificationService.js';

// função auxiliar para resolver canal forçado ou preferências do utilizador
function resolveChannelSelection(canal) {
    const normalized = String(canal || '')
        .trim()
        .toLowerCase();

    if (normalized === 'app') {
        return { app: true, email: false, sms: false };
    }

    if (normalized === 'email') {
        return { app: false, email: true, sms: false };
    }

    if (normalized === 'sms' || normalized === 'mensagem') {
        return { app: false, email: false, sms: true };
    }

    if (normalized === 'both') {
        return { app: true, email: true, sms: false };
    }

    if (normalized === 'all' || normalized === 'todos') {
        return { app: true, email: true, sms: true };
    }

    return { app: true, email: true, sms: true };
}

// Obtém definição de alerta por código, garantindo que está ativo
async function obterDefinicaoAlertaPorCodigo(codigo) {
    const defQuery = `
			SELECT id_alerta_definicao, titulo as def_titulo, canal_app_default, canal_email_default, canal_sms_default
			FROM alertas_definicoes
			WHERE codigo = $1 AND ativo = true
		`;

    const defResult = await db.query(defQuery, [codigo]);
    return defResult.rows[0] || null;
}

// Resolve preferências do utilizador para um alerta específico, considerando defaults
async function obterPreferenciasResolvidas(
    idUser,
    idAlertaDefinicao,
    alertaDef
) {
    const prefQuery = `
			SELECT canal_app, canal_email, canal_sms, ativo
			FROM alertas_preferencias_utilizador
			WHERE id_user = $1 AND id_alerta_definicao = $2
		`;

    const prefResult = await db.query(prefQuery, [idUser, idAlertaDefinicao]);

    let canal_app = alertaDef.canal_app_default;
    let canal_email = alertaDef.canal_email_default;
    let canal_sms = alertaDef.canal_sms_default;
    let ativo = true;

    if (prefResult.rows.length > 0) {
        const pref = prefResult.rows[0];
        canal_app = pref.canal_app;
        canal_email = pref.canal_email;
        canal_sms = pref.canal_sms;
        ativo = pref.ativo;
    }

    return {
        canal_app: Boolean(canal_app),
        canal_email: Boolean(canal_email),
        canal_sms: Boolean(canal_sms),
        ativo: Boolean(ativo),
    };
}

async function obterDestinatarioAlerta(idUser) {
    const query = `
        SELECT
            u.id_user,
            u.email,
            COALESCE(
                NULLIF(TRIM(pa.nome), ''),
                NULLIF(TRIM(pp.nome), ''),
                NULLIF(TRIM(pe.nome), ''),
                NULLIF(TRIM(u.email), ''),
                'Utilizador'
            ) AS nome,
            COALESCE(
                NULLIF(TRIM(pa.telemovel), ''),
                NULLIF(TRIM(pa.telefone), ''),
                NULLIF(TRIM(pp.telemovel), ''),
                NULLIF(TRIM(pp.telefone), ''),
                NULLIF(TRIM(pe.telemovel), ''),
                NULLIF(TRIM(pe.telefone), '')
            ) AS telefone
        FROM users u
        LEFT JOIN alunos a ON a.id_user = u.id_user
        LEFT JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
        LEFT JOIN professores pr ON pr.id_user = u.id_user
        LEFT JOIN pessoas pp ON pp.id_pessoa = pr.id_pessoa
        LEFT JOIN encarregados e ON e.id_user = u.id_user
        LEFT JOIN pessoas pe ON pe.id_pessoa = e.id_pessoa
        WHERE u.id_user = $1
        LIMIT 1
    `;

    const { rows } = await db.query(query, [idUser]);
    return rows[0] || null;
}

async function inserirEventoAlerta({
    id_alerta_definicao,
    userId,
    canal,
    titulo,
    descricao,
    nivel,
    payload,
}) {
    const insertQuery = `
        INSERT INTO alertas_eventos (
            id_alerta_definicao,
            id_user,
            canal,
            titulo,
            descricao,
            nivel,
            payload,
            lido
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false)
        RETURNING id_alerta_evento
    `;

    return db.query(insertQuery, [
        id_alerta_definicao,
        userId,
        canal,
        titulo,
        descricao || '',
        nivel,
        payload ? JSON.stringify(payload) : null,
    ]);
}

// Verifica se um canal específico está habilitado para um utilizador e alerta
export async function isAlertChannelEnabledForUser({
    codigo,
    idUser,
    channel,
}) {
    if (!codigo) {
        return false;
    }

    if (!idUser) {
        return true;
    }

    const alertaDef = await obterDefinicaoAlertaPorCodigo(codigo);
    if (!alertaDef?.id_alerta_definicao) {
        return false;
    }

    const resolved = await obterPreferenciasResolvidas(
        idUser,
        alertaDef.id_alerta_definicao,
        alertaDef
    );

    if (!resolved.ativo) {
        return false;
    }

    if (channel === 'email') {
        return resolved.canal_email;
    }

    if (channel === 'sms' || channel === 'mensagem') {
        return resolved.canal_sms;
    }

    return resolved.canal_app;
}

/**
 * ========================================
 * ALERTAS DISPATCH SERVICE
 * ========================================
 * Responsável por disparar alertas para utilizadores com base em eventos do sistema
 */

/**
 * Dispara um alerta para utilizadores específicos ou todos
 * Insere em alertas_eventos respeitando preferências do utilizador
 *
 * @param {Object} params - Parâmetros do alerta
 * @param {string} params.codigo - Código da definição de alerta (ex: 'faturas-vencidas')
 * @param {Array<number>} params.for_user_ids - IDs dos utilizadores (null = todos autenticados)
 * @param {string} params.titulo - Título customizado para este evento (override da definição)
 * @param {string} params.descricao - Descrição customizada para este evento
 * @param {string} params.nivel - Nível ('info' | 'warning' | 'danger' | 'success'), default: 'info'
 * @param {Object} params.payload - Dados adicionais em JSON (ex: {factura_id: 123})
 * @param {string} params.canal - Canal forçado (null = respeita preferências), 'app' | 'email' | 'both'
 * @returns {Promise<Object>} {success: boolean, eventos_criados: number, erro?: string}
 */
export async function dispatchAlert({
    codigo,
    for_user_ids = null,
    titulo,
    descricao,
    nivel = 'info',
    payload = null,
    canal = null,
    pushLink = null,
}) {
    try {
        if (!codigo) {
            throw new Error("Parâmetro 'codigo' é obrigatório");
        }

        // 1. Get alert definition
        const alerta_def = await obterDefinicaoAlertaPorCodigo(codigo);

        if (!alerta_def) {
            throw new Error(
                `Alerta com código '${codigo}' não encontrado na definição`
            );
        }

        const id_alerta_definicao = alerta_def.id_alerta_definicao;
        const selectedChannels = resolveChannelSelection(canal);

        // 2. Determine target users
        let userIds = for_user_ids;

        if (!userIds || userIds.length === 0) {
            // Get all active authenticated users
            const usersQuery = `SELECT id_user FROM users WHERE status = true`;
            const usersResult = await db.query(usersQuery);
            userIds = usersResult.rows.map((row) => row.id_user);
        }

        if (!Array.isArray(userIds)) {
            userIds = [userIds];
        }

        // 3. For each user, respect their preferences and insert event
        let totalInserted = 0;
        const pushTargets = [];
        const emailResults = [];
        const messageResults = [];
        const resolvedTitle = titulo || alerta_def.def_titulo;
        const resolvedDescription = descricao || '';

        for (const userId of userIds) {
            const preferencias = await obterPreferenciasResolvidas(
                userId,
                id_alerta_definicao,
                alerta_def
            );

            // Skip if user has disabled this alert
            if (!preferencias.ativo) {
                continue;
            }

            if (preferencias.canal_app && selectedChannels.app) {
                try {
                    await inserirEventoAlerta({
                        id_alerta_definicao,
                        userId,
                        canal: 'app',
                        titulo: resolvedTitle,
                        descricao: resolvedDescription,
                        nivel,
                        payload,
                    });
                    totalInserted++;
                    pushTargets.push(userId);
                } catch (err) {
                    console.error(
                        `Erro ao inserir evento app para user ${userId}:`,
                        err.message
                    );
                }
            }

            if (preferencias.canal_email && selectedChannels.email) {
                try {
                    await inserirEventoAlerta({
                        id_alerta_definicao,
                        userId,
                        canal: 'email',
                        titulo: resolvedTitle,
                        descricao: resolvedDescription,
                        nivel,
                        payload,
                    });
                    totalInserted++;

                    const destinatario = await obterDestinatarioAlerta(userId);
                    const emailResult = await enviarEmailAlerta({
                        email: destinatario?.email,
                        nome: destinatario?.nome,
                        titulo: resolvedTitle,
                        descricao: resolvedDescription,
                        nivel,
                        link: pushLink,
                    });
                    emailResults.push({ userId, ...emailResult });
                } catch (err) {
                    console.error(
                        `Erro ao processar evento email para user ${userId}:`,
                        err.message
                    );
                    emailResults.push({
                        userId,
                        ok: false,
                        error: err.message,
                    });
                }
            }

            if (preferencias.canal_sms && selectedChannels.sms) {
                try {
                    await inserirEventoAlerta({
                        id_alerta_definicao,
                        userId,
                        canal: 'sms',
                        titulo: resolvedTitle,
                        descricao: resolvedDescription,
                        nivel,
                        payload,
                    });
                    totalInserted++;

                    const destinatario = await obterDestinatarioAlerta(userId);
                    const messageResult = await enviarMensagemAlerta({
                        telefone: destinatario?.telefone,
                        nome: destinatario?.nome,
                        titulo: resolvedTitle,
                        descricao: resolvedDescription,
                        payload,
                    });
                    messageResults.push({ userId, ...messageResult });
                } catch (err) {
                    console.error(
                        `Erro ao processar evento mensagem para user ${userId}:`,
                        err.message
                    );
                    messageResults.push({
                        userId,
                        ok: false,
                        error: err.message,
                    });
                }
            }
        }

        let pushResult = null;
        const uniquePushTargets = [...new Set(pushTargets)];
        if (selectedChannels.app && uniquePushTargets.length > 0) {
            try {
                pushResult = await enviarPushParaUtilizadores({
                    userIds: uniquePushTargets,
                    tipo: codigo,
                    titulo: resolvedTitle,
                    descricao: resolvedDescription,
                    nivel,
                    payload,
                    link: pushLink,
                });
            } catch (pushError) {
                console.error(
                    '[alertasDispatchService] push notification error:',
                    pushError.message
                );
            }
        }

        return {
            success: true,
            eventos_criados: totalInserted,
            push_result: pushResult,
            email_result: {
                total: emailResults.length,
                sent: emailResults.filter((item) => item.ok).length,
                skipped: emailResults.filter((item) => item.skipped).length,
                failed: emailResults.filter(
                    (item) => !item.ok && !item.skipped
                ).length,
            },
            message_result: {
                total: messageResults.length,
                sent: messageResults.filter((item) => item.ok).length,
                skipped: messageResults.filter((item) => item.skipped).length,
                failed: messageResults.filter(
                    (item) => !item.ok && !item.skipped
                ).length,
            },
        };
    } catch (error) {
        console.error('[alertasDispatchService] dispatchAlert error:', error);
        return {
            success: false,
            eventos_criados: 0,
            erro: error.message,
        };
    }
}

/**
 * Dispara alerta de fatura vencida para todos os utilizadores
 * Usado quando uma fatura fica vencida
 *
 * @param {Object} factura - Dados da fatura {id_fatura, montante, data_vencimento, ...}
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function dispatchAlertaFaturaVencida(factura) {
    const { id_fatura, montante, data_vencimento } = factura;

    return dispatchAlert({
        codigo: 'faturas-vencidas',
        titulo: `Fatura #${id_fatura} vencida`,
        descricao: `Fatura de €${montante.toFixed(2)} vencida em ${data_vencimento}. Por favor procure resolver.`,
        nivel: 'warning',
        payload: factura,
    });
}

/**
 * Dispara alerta de pagamento recebido
 * Usado quando um pagamento é processado
 *
 * @param {Object} pagamento - Dados do pagamento {id_pagamento, montante, ...}
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function dispatchAlertaPagamentoRecebido(pagamento) {
    const { id_pagamento, montante } = pagamento;

    return dispatchAlert({
        codigo: 'pagamentos-recebidos',
        titulo: 'Pagamento recebido',
        descricao: `Pagamento de €${montante.toFixed(2)} foi processado com sucesso.`,
        nivel: 'success',
        payload: pagamento,
    });
}

/**
 * Dispara alerta de ausência registada para um ou mais alunos.
 *
 * @param {Object} params - Dados da ausência e utilizadores alvo
 * @param {Array<number>} params.for_user_ids - IDs dos utilizadores a notificar
 * @param {Object} params.ausencia - Dados da ausência {id_aluno, id_servico, data, ...}
 * @param {string} params.pushLink - Link aberto ao tocar na notificação push
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function dispatchAlertaAusencia({
    for_user_ids = [],
    ausencia,
    pushLink = '/aluno/notificacoes',
}) {
    const data = ausencia || {};

    return dispatchAlert({
        codigo: 'ausencias-alunos',
        for_user_ids,
        titulo: 'Nova ausência registada',
        descricao: `Foi registada uma falta em ${data.data || 'data por definir'}.`,
        nivel: 'info',
        payload: data,
        pushLink,
    });
}

/**
 * Dispara alerta customizado (para qualquer cenário não coberto)
 *
 * @param {string} codigo - Código do alerta (deve existir em alertas_definicoes)
 * @param {string} titulo - Título customizado
 * @param {string} descricao - Descrição customizada
 * @param {Array<number>} user_ids - IDs dos utilizadores para notificar (null = todos)
 * @param {Object} payload - Dados adicionais
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function dispatchAlertaCustomizado(
    codigo,
    titulo,
    descricao,
    user_ids = null,
    payload = null
) {
    return dispatchAlert({
        codigo,
        for_user_ids: user_ids,
        titulo,
        descricao,
        payload,
    });
}

// Obtém os ids de todos os gestores ativos, opcionalmente excluindo quem despoletou a ação
async function obterGestoresExcluindo(actorUserId) {
    const { rows } = await db.query(
        `SELECT id_user FROM users WHERE role = 'gestor' AND status = true`
    );
    return rows
        .map((row) => row.id_user)
        .filter((id) => id !== actorUserId);
}

// Obtém os ids de todos os gestores ativos, incluindo sempre quem despoletou a ação
// (usado em eventos críticos, como eliminações, onde o próprio autor também deve ser notificado)
async function obterTodosOsGestores() {
    const { rows } = await db.query(
        `SELECT id_user FROM users WHERE role = 'gestor' AND status = true`
    );
    return rows.map((row) => row.id_user);
}

async function ensureAlunoEliminadoAlertDefinition() {
    const codigo = 'aluno-eliminado';
    const existing = await db.query(
        `SELECT id_alerta_definicao FROM alertas_definicoes WHERE codigo = $1 LIMIT 1`,
        [codigo]
    );
    if (existing.rows[0]?.id_alerta_definicao) {
        return existing.rows[0].id_alerta_definicao;
    }

    const inserted = await db.query(
        `INSERT INTO alertas_definicoes (grupo, codigo, titulo, descricao, icone, canal_app_default, canal_email_default, ativo, ordenacao)
         VALUES ($1, $2, $3, $4, $5, true, true, true, $6) RETURNING id_alerta_definicao`,
        [
            'sistema',
            codigo,
            'Aluno eliminado',
            'Quando um aluno é eliminado definitivamente do sistema.',
            'UserMinus',
            95,
        ]
    );
    return inserted.rows[0]?.id_alerta_definicao || null;
}

/**
 * Notifica todos os gestores (incluindo quem executou a ação) quando um aluno
 * é eliminado definitivamente do sistema.
 *
 * @param {Object} params
 * @param {number} params.actorUserId - Gestor que eliminou o aluno
 * @param {string} params.nome - Nome do aluno eliminado
 * @param {string} [params.email] - Email do aluno eliminado
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function notificarGestoresAlunoEliminado({
    actorUserId,
    nome,
    email,
}) {
    try {
        await ensureAlunoEliminadoAlertDefinition();
        const gestorIds = await obterTodosOsGestores();
        if (!gestorIds.length) {
            return { success: true, eventos_criados: 0 };
        }

        return await dispatchAlert({
            codigo: 'aluno-eliminado',
            for_user_ids: gestorIds,
            titulo: 'Aluno eliminado definitivamente',
            descricao: email
                ? `O aluno "${nome}" (${email}) foi eliminado definitivamente do sistema.`
                : `O aluno "${nome}" foi eliminado definitivamente do sistema.`,
            nivel: 'warning',
            payload: { actorUserId, nome, email },
        });
    } catch (err) {
        console.error(
            '[alertasDispatchService] notificarGestoresAlunoEliminado error:',
            err.message
        );
        return { success: false, eventos_criados: 0, erro: err.message };
    }
}

/**
 * Notifica os restantes gestores quando uma nova conta (professor/aluno) é criada.
 *
 * @param {Object} params
 * @param {number} params.actorUserId - Gestor que criou a conta (excluído da notificação)
 * @param {string} params.nome - Nome da pessoa cuja conta foi criada
 * @param {string} params.email - Email da conta criada
 * @param {'professor'|'aluno'} params.tipo - Tipo de conta criada
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function notificarGestoresCriacaoConta({
    actorUserId,
    nome,
    email,
    tipo,
}) {
    try {
        const gestorIds = await obterGestoresExcluindo(actorUserId);
        if (!gestorIds.length) {
            return { success: true, eventos_criados: 0 };
        }

        const tipoLabel = tipo === 'professor' ? 'Professor' : 'Aluno';

        return await dispatchAlert({
            codigo: 'criacao-conta',
            for_user_ids: gestorIds,
            titulo: `Nova conta de ${tipoLabel.toLowerCase()} criada`,
            descricao: `${tipoLabel} "${nome}" (${email}) foi criado no sistema.`,
            nivel: 'info',
            payload: { nome, email, tipo },
        });
    } catch (err) {
        console.error(
            '[alertasDispatchService] notificarGestoresCriacaoConta error:',
            err.message
        );
        return { success: false, eventos_criados: 0, erro: err.message };
    }
}

/**
 * Notifica todos os gestores (incluindo quem executou a ação) quando é
 * executada uma limpeza de dados em massa.
 *
 * @param {Object} params
 * @param {number} params.actorUserId - Gestor que executou a limpeza
 * @param {Object} params.contagens - Resumo de quantos registos foram eliminados por categoria
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function notificarGestoresLimpezaDados({
    actorUserId,
    contagens,
}) {
    try {
        // Inclui sempre quem executou a limpeza: é um evento crítico e,
        // em instalações com um único gestor, ninguém seria notificado.
        const gestorIds = await obterTodosOsGestores();
        if (!gestorIds.length) {
            return { success: true, eventos_criados: 0 };
        }

        const resumo = Object.entries(contagens || {})
            .filter(([, total]) => Number(total) > 0)
            .map(([categoria, total]) => `${categoria}: ${total}`)
            .join(', ');

        return await dispatchAlert({
            codigo: 'limpeza-dados-massa',
            for_user_ids: gestorIds,
            titulo: 'Limpeza de dados em massa executada',
            descricao: resumo
                ? `Foram eliminados registos de: ${resumo}.`
                : 'Foi executada uma limpeza de dados em massa.',
            nivel: 'warning',
            payload: contagens,
        });
    } catch (err) {
        console.error(
            '[alertasDispatchService] notificarGestoresLimpezaDados error:',
            err.message
        );
        return { success: false, eventos_criados: 0, erro: err.message };
    }
}

async function ensureFalhaParcialAlertDefinition() {
    const codigo = 'falha-parcial-lote';
    const existing = await db.query(
        `SELECT id_alerta_definicao FROM alertas_definicoes WHERE codigo = $1 LIMIT 1`,
        [codigo]
    );
    if (existing.rows[0]?.id_alerta_definicao) {
        return existing.rows[0].id_alerta_definicao;
    }

    const inserted = await db.query(
        `INSERT INTO alertas_definicoes (grupo, codigo, titulo, descricao, icone, canal_app_default, canal_email_default, ativo, ordenacao)
         VALUES ($1, $2, $3, $4, $5, true, true, true, $6) RETURNING id_alerta_definicao`,
        [
            'sistema',
            codigo,
            'Falha parcial em operação em lote',
            'Quando uma operação em lote (ex: criação de disciplina em múltiplos níveis) fica parcialmente concluída.',
            'AlertTriangle',
            96,
        ]
    );
    return inserted.rows[0]?.id_alerta_definicao || null;
}

/**
 * Notifica todos os gestores quando uma operação em lote (ex: criação de
 * uma disciplina em múltiplos níveis de ensino, um POST por nível) falha a
 * meio, deixando parte dos dados já persistidos sem que o gestor tenha
 * visibilidade disso na UI.
 *
 * @param {Object} params
 * @param {number} params.actorUserId - Gestor que executou a operação
 * @param {string} params.entidade - Entidade afetada (ex: 'disciplinas')
 * @param {Object} params.detalhes - Resumo da falha (nome, níveis guardados, nível que falhou)
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function notificarGestoresFalhaParcial({
    actorUserId,
    entidade,
    detalhes,
}) {
    try {
        await ensureFalhaParcialAlertDefinition();
        const gestorIds = await obterTodosOsGestores();
        if (!gestorIds.length) {
            return { success: true, eventos_criados: 0 };
        }

        const { nome, niveisGuardados, nivelFalhou } = detalhes || {};
        const descricao =
            nome && Array.isArray(niveisGuardados) && nivelFalhou
                ? `Ao guardar "${nome}", os níveis [${niveisGuardados.join(', ')}] foram guardados com sucesso, mas falhou ao guardar "${nivelFalhou}".`
                : `Uma operação em lote sobre "${entidade}" ficou parcialmente concluída.`;

        return await dispatchAlert({
            codigo: 'falha-parcial-lote',
            for_user_ids: gestorIds,
            titulo: 'Operação em lote parcialmente concluída',
            descricao,
            nivel: 'warning',
            payload: { actorUserId, entidade, detalhes },
        });
    } catch (err) {
        console.error(
            '[alertasDispatchService] notificarGestoresFalhaParcial error:',
            err.message
        );
        return { success: false, eventos_criados: 0, erro: err.message };
    }
}

/**
 * Notifica todos os gestores quando é detetada atividade suspeita de login
 * (várias tentativas falhadas consecutivas para a mesma conta/IP).
 *
 * @param {Object} params
 * @param {string} params.email - Email alvo das tentativas
 * @param {string} params.ip - IP de origem das tentativas
 * @returns {Promise<Object>} resultado do dispatch
 */
export async function notificarGestoresAtividadeSuspeita({ email, ip }) {
    try {
        const gestorIds = await obterGestoresExcluindo(null);
        if (!gestorIds.length) {
            return { success: true, eventos_criados: 0 };
        }

        return await dispatchAlert({
            codigo: 'atividade-suspeita',
            for_user_ids: gestorIds,
            titulo: 'Atividade de login suspeita detetada',
            descricao: `Foram registadas várias tentativas de login falhadas para "${email}" a partir do IP ${ip}. A conta foi temporariamente bloqueada.`,
            nivel: 'danger',
            payload: { email, ip },
        });
    } catch (err) {
        console.error(
            '[alertasDispatchService] notificarGestoresAtividadeSuspeita error:',
            err.message
        );
        return { success: false, eventos_criados: 0, erro: err.message };
    }
}
