import { executarTarefa, listarTarefas } from '../scheduler/index.js';

const MOTIVOS = {
    modulo_indisponivel: 'Esta tarefa não está incluída no pacote atual.',
    ja_executada: 'A tarefa já está a correr.',
};

/**
 * GET /api/gestor/tarefas-agendadas
 * Lista as tarefas automáticas com as últimas execuções.
 */
export async function listarTarefasAgendadas(req, res) {
    try {
        const tarefas = await listarTarefas();
        return res.json({ tarefas });
    } catch (error) {
        console.error('Erro ao listar tarefas agendadas:', error);
        return res.status(500).json({ message: 'Erro ao listar tarefas automáticas.' });
    }
}

/**
 * POST /api/gestor/tarefas-agendadas/:nome/executar
 * Corre a tarefa agora, fora do horário (fica registada como manual).
 */
export async function executarTarefaAgendada(req, res) {
    try {
        const resultado = await executarTarefa(req.params.nome, {
            manual: true,
            userId: req.userId ?? null,
        });

        if (!resultado.executada) {
            return res.status(409).json({
                message: MOTIVOS[resultado.motivo] || 'A tarefa não foi executada.',
                motivo: resultado.motivo,
            });
        }

        return res.json({ message: 'Tarefa executada.', resultado: resultado.resultado });
    } catch (error) {
        console.error('Erro ao executar tarefa agendada:', error);
        return res.status(error.status || 500).json({
            message: error.status === 404 ? error.message : `A tarefa falhou: ${error.message}`,
        });
    }
}
