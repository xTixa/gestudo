import { db } from '../config/db.js';
import { registarInsert } from '../services/logService.js';

const CONFIRMACAO_ENCERRAR = 'ENCERRAR ANO';

export async function obterAnoLetivo(req, res) {
    try {
        const { rows: yearRows } = await db.query(
            `SELECT public.fn_current_academic_year(CURRENT_DATE) AS ano_letivo`
        );
        const anoLetivo = String(yearRows[0]?.ano_letivo || '---/---');

        const { rows: statsRows } = await db.query(`
            SELECT
                (SELECT COUNT(*)::int FROM users WHERE role = 'aluno' AND status = true) AS alunos_ativos,
                (SELECT COUNT(*)::int FROM users WHERE role = 'professor' AND status = true) AS professores_ativos,
                (SELECT COUNT(*)::int FROM inscricoes WHERE LOWER(COALESCE(estado, 'ativa')) = 'ativa') AS inscricoes_ativas,
                (SELECT COUNT(*)::int FROM servicos_curriculares WHERE COALESCE(ativo, true) = true) AS servicos_curriculares_ativos,
                (SELECT COUNT(*)::int FROM servicos_extracurriculares WHERE COALESCE(ativo, true) = true) AS servicos_extra_ativos,
                (SELECT COUNT(*)::int FROM alunos a WHERE COALESCE(a.ano_letivo_renovacao, '') <> public.fn_current_academic_year(CURRENT_DATE)) AS matriculas_por_renovar
        `);

        const stats = statsRows[0] || {};
        return res.status(200).json({
            anoLetivo,
            stats: {
                alunosAtivos: Number(stats.alunos_ativos || 0),
                professoresAtivos: Number(stats.professores_ativos || 0),
                inscricoesAtivas: Number(stats.inscricoes_ativas || 0),
                servicosCurricularesAtivos: Number(stats.servicos_curriculares_ativos || 0),
                servicosExtraAtivos: Number(stats.servicos_extra_ativos || 0),
                matriculasPorRenovar: Number(stats.matriculas_por_renovar || 0),
            },
        });
    } catch (error) {
        console.error('[anoLetivoController] obterAnoLetivo:', error.message);
        return res.status(500).json({ message: 'Erro ao obter informação do ano lectivo.' });
    }
}

export async function encerrarAnoLetivo(req, res) {
    const { confirmacao, opcoes = {} } = req.body || {};

    if (typeof confirmacao !== 'string' || confirmacao.trim() !== CONFIRMACAO_ENCERRAR) {
        return res.status(400).json({
            message: `Texto de confirmação inválido. Escreva exatamente: ${CONFIRMACAO_ENCERRAR}`,
        });
    }

    const encerrarInscricoes = opcoes.inscricoes !== false;
    const desativarServicos = opcoes.servicos === true;

    const client = await db.connect();
    const contagens = {};

    try {
        await client.query('BEGIN');

        if (encerrarInscricoes) {
            const result = await client.query(
                `UPDATE inscricoes SET estado = 'encerrada' WHERE LOWER(COALESCE(estado, 'ativa')) = 'ativa'`
            );
            contagens.inscricoes_encerradas = result.rowCount ?? 0;
        }

        if (desativarServicos) {
            const sc = await client.query(
                `UPDATE servicos_curriculares SET ativo = false WHERE COALESCE(ativo, true) = true`
            );
            const se = await client.query(
                `UPDATE servicos_extracurriculares SET ativo = false WHERE COALESCE(ativo, true) = true`
            );
            contagens.servicos_desativados = (sc.rowCount ?? 0) + (se.rowCount ?? 0);
        }

        await client.query('COMMIT');

        await registarInsert(
            req.userId ?? null,
            'encerrar_ano_letivo',
            { opcoes: { inscricoes: encerrarInscricoes, servicos: desativarServicos }, contagens },
            null
        ).catch(() => {});

        return res.status(200).json({
            message: 'Ano lectivo encerrado com sucesso.',
            contagens,
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[anoLetivoController] encerrarAnoLetivo:', error.message);
        return res.status(500).json({ message: `Erro ao encerrar ano lectivo: ${error.message}` });
    } finally {
        client.release();
    }
}
