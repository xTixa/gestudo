import { notificarGestoresFalhaParcial } from '../services/alertasDispatchService.js';

/**
 * Recebe pedidos do frontend para notificar os gestores sobre eventos que o
 * backend não consegue detetar sozinho — como uma operação em lote (vários
 * pedidos HTTP independentes representando uma única ação lógica) que falha
 * a meio, deixando parte dos dados persistidos.
 */
export async function notificarFalhaParcialLote(req, res) {
    const entidade = String(req.body?.entidade || '').trim();
    const detalhes = req.body?.detalhes;

    if (!entidade || typeof detalhes !== 'object' || detalhes === null) {
        return res.status(400).json({
            message: 'Campos obrigatórios em falta (entidade, detalhes).',
        });
    }

    // Fire-and-forget do lado do frontend: a notificação é best-effort e não
    // deve bloquear nem falhar a UX do utilizador que já lidou com o erro
    // principal da operação em lote.
    await notificarGestoresFalhaParcial({
        actorUserId: req.userId ?? null,
        entidade,
        detalhes,
    });

    return res.status(200).json({ success: true });
}
