import { db } from '../config/db.js';
import { registarUpdate } from '../services/logService.js';

/**
 * POST /api/gestor/servicos/[id]/terminar
 * Termina um serviço imediatamente (define data_fim = hoje)
 */
export async function terminarServicoImediatamente(req, res) {
    try {
        const idServico = Number(req.params?.id);
        if (!Number.isInteger(idServico) || idServico <= 0) {
            return res.status(400).json({ message: 'ID de serviço inválido.' });
        }

        const tableName = String(req.params?.tipo || 'servicos_curriculares')
            .toLowerCase()
            .includes('extra')
            ? 'servicos_extracurriculares'
            : 'servicos_curriculares';

        const hoje = new Date().toISOString().slice(0, 10);

        const { rows: oldRows } = await db.query(
            `SELECT * FROM ${tableName} WHERE id_servico = $1 LIMIT 1`,
            [idServico]
        );

        if (!oldRows.length) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        const { rows } = await db.query(
            `UPDATE ${tableName} SET data_fim = $1 WHERE id_servico = $2 RETURNING id_servico, data_fim`,
            [hoje, idServico]
        );

        await registarUpdate(
            req.userId ?? null,
            tableName,
            idServico,
            oldRows[0],
            {
                ...oldRows[0],
                data_fim: hoje,
            },
            'alert'
        ).catch(() => {});

        return res.status(200).json({
            message: `Serviço terminado com sucesso em ${hoje}.`,
            serviço: {
                id_servico: rows[0]?.id_servico,
                data_fim: rows[0]?.data_fim,
            },
        });
    } catch (error) {
        console.error('Erro ao terminar serviço:', error.message);
        return res.status(500).json({ message: 'Erro ao terminar serviço.' });
    }
}
