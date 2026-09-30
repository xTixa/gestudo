import {
    contarNaoLidas,
    criarConversa,
    definirArquivada,
    enviarMensagem,
    listarContactos,
    listarConversas,
    listarMensagens,
    marcarComoLida,
    MensagensError,
    obterUtilizador,
} from '../services/mensagensService.js';

/**
 * ========================================
 * MENSAGENS CONTROLLER
 * ========================================
 * Conversas entre gestores, professores, alunos e encarregados.
 * As regras de quem pode falar com quem estão em mensagensService.js.
 * ========================================
 */

function responderErro(res, error, contexto) {
    if (error instanceof MensagensError) {
        return res.status(error.status).json({ message: error.message });
    }
    console.error(`[mensagens] ${contexto}:`, error.message);
    return res.status(500).json({ message: 'Erro ao processar mensagens.' });
}

async function utilizadorAtual(req) {
    const utilizador = await obterUtilizador(req.userId);
    if (!utilizador) throw new MensagensError(401, 'Utilizador não encontrado.');
    return utilizador;
}

function idConversa(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new MensagensError(400, 'Conversa inválida.');
    return id;
}

// GET /api/mensagens/contactos?q=
export async function obterContactos(req, res) {
    try {
        const contactos = await listarContactos(await utilizadorAtual(req), { q: req.query.q });
        return res.json({ contactos });
    } catch (error) {
        return responderErro(res, error, 'obterContactos');
    }
}

// GET /api/mensagens/conversas?arquivadas=true
export async function obterConversas(req, res) {
    try {
        const conversas = await listarConversas(req.userId, {
            arquivadas: req.query.arquivadas === 'true',
            limit: req.query.limit,
        });
        return res.json({ conversas });
    } catch (error) {
        return responderErro(res, error, 'obterConversas');
    }
}

// GET /api/mensagens/nao-lidas
export async function obterNaoLidas(req, res) {
    try {
        return res.json({ total: await contarNaoLidas(req.userId) });
    } catch (error) {
        return responderErro(res, error, 'obterNaoLidas');
    }
}

// POST /api/mensagens/conversas { participantes: [id_user], assunto?, mensagem }
export async function iniciarConversa(req, res) {
    try {
        const resultado = await criarConversa(await utilizadorAtual(req), {
            participantes: req.body?.participantes,
            assunto: req.body?.assunto,
            mensagem: req.body?.mensagem,
        });
        return res.status(resultado.reutilizada ? 200 : 201).json(resultado);
    } catch (error) {
        return responderErro(res, error, 'iniciarConversa');
    }
}

// GET /api/mensagens/conversas/:id/mensagens?antes=&limit=
export async function obterMensagens(req, res) {
    try {
        const resultado = await listarMensagens(req.userId, idConversa(req), {
            antes: req.query.antes,
            limit: req.query.limit,
        });
        return res.json(resultado);
    } catch (error) {
        return responderErro(res, error, 'obterMensagens');
    }
}

// POST /api/mensagens/conversas/:id/mensagens { corpo }
export async function responder(req, res) {
    try {
        const mensagem = await enviarMensagem(await utilizadorAtual(req), idConversa(req), req.body?.corpo);
        return res.status(201).json({ mensagem });
    } catch (error) {
        return responderErro(res, error, 'responder');
    }
}

// POST /api/mensagens/conversas/:id/lida
export async function marcarLida(req, res) {
    try {
        await marcarComoLida(req.userId, idConversa(req));
        return res.json({ ok: true });
    } catch (error) {
        return responderErro(res, error, 'marcarLida');
    }
}

// PATCH /api/mensagens/conversas/:id { arquivada }
export async function arquivarConversa(req, res) {
    try {
        await definirArquivada(req.userId, idConversa(req), req.body?.arquivada);
        return res.json({ ok: true });
    } catch (error) {
        return responderErro(res, error, 'arquivarConversa');
    }
}
