import { db } from '../config/db.js';

/**
 * Middleware para verificar se a matrícula do aluno está ativa
 * Se o aluno não tiver renovado a matrícula, a conta é suspensa
 * (apenas para alunos; outras roles são ignoradas)
 */
export async function verificarMatriculaAtiva(req, res, next) {
    try {
        if (!req.userId) {
            return next();
        }

        // Obter role do utilizador
        const { rows: userRows } = await db.query(
            `SELECT role FROM users WHERE id_user = $1`,
            [req.userId]
        );

        const role = String(userRows[0]?.role || '').toLowerCase();

        // Apenas verificar para alunos
        if (role !== 'aluno') {
            return next();
        }

        // Obter ano letivo atual
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const anoLetivoAtual =
            month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;

        // Verificar se a matrícula do aluno está renovada
        const { rows: alunoRows } = await db.query(
            `
            SELECT a.id_aluno, a.ano_letivo_renovacao
            FROM alunos a
            WHERE a.id_user = $1
            LIMIT 1
        `,
            [req.userId]
        );

        if (alunoRows.length === 0) {
            return next();
        }

        const aluno = alunoRows[0];
        const matriculaAtiva = aluno.ano_letivo_renovacao === anoLetivoAtual;

        // Se a matrícula não está ativa, apenas informar
        // NÃO suspender automaticamente
        if (!matriculaAtiva) {
            req.matriculaExpirada = true;
            req.motivoSuspensao =
                'A sua matrícula expirou. Renove-a para continuar a usar a plataforma.';
        }

        next();
    } catch (error) {
        console.error('Erro ao verificar matrícula ativa:', error.message);
        // Continuar mesmo com erro
        next();
    }
}

/**
 * Middleware para retornar erro 403 se a conta foi suspensa por matrícula expirada
 */
export async function bloquearSemMatriculaAtiva(req, res, next) {
    if (req.matriculaExpirada) {
        return res.status(403).json({
            message: req.motivoSuspensao,
            code: 'MATRICULA_EXPIRADA',
        });
    }

    next();
}
