import { db } from '../config/db.js';
import {
    renovarMatricula,
    isMatriculaAtiva,
    ativarContaAluno,
} from '../models/renovacaoMatricula.js';
import { dispatchAlert } from '../services/alertasDispatchService.js';
import { registarUpdate } from '../services/logService.js';

async function ensureRenovacaoMatriculaAlertDefinition() {
    const codigo = 'renovacao-matricula';

    const existing = await db.query(
        `
            SELECT id_alerta_definicao
            FROM alertas_definicoes
            WHERE codigo = $1
            LIMIT 1
        `,
        [codigo]
    );

    if (existing.rows[0]?.id_alerta_definicao) {
        return existing.rows[0].id_alerta_definicao;
    }

    const inserted = await db.query(
        `
            INSERT INTO alertas_definicoes (
                grupo,
                codigo,
                titulo,
                descricao,
                icone,
                canal_app_default,
                canal_email_default,
                ativo,
                ordenacao
            )
            VALUES ($1, $2, $3, $4, $5, true, true, true, $6)
            RETURNING id_alerta_definicao
        `,
        [
            'academico',
            codigo,
            'Renovação da matrícula',
            'Notificação sobre renovação de matrícula do aluno.',
            'RefreshCcw',
            40,
        ]
    );

    return inserted.rows[0]?.id_alerta_definicao || null;
}

/**
 * Calcula o ano letivo a partir de uma data
 * Ano letivo começa em Setembro
 * @param {*} dateValue - Data (string ou Date)
 * @returns {string|null} Ano letivo ou null se inválido
 */
export function getAnoLetivo(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

/**
 * POST /api/gestor/renovacoes/:idAluno/renovar
 * Renova a matrícula de um aluno específico (apenas gestor)
 */
export async function renovarMatriculaAlunoPorGestor(req, res) {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: 'Não autenticado.' });
        }

        const { rows: userRows } = await db.query(
            `SELECT role FROM users WHERE id_user = $1`,
            [req.userId]
        );

        const role = String(userRows[0]?.role || '').toLowerCase();
        if (role !== 'gestor' && role !== 'admin') {
            return res.status(403).json({ message: 'Acesso negado.' });
        }

        const idAluno = Number(req.params.idAluno);
        if (!Number.isInteger(idAluno) || idAluno <= 0) {
            return res.status(400).json({ message: 'ID de aluno inválido.' });
        }

        const { rows: alunoRows } = await db.query(
            `SELECT id_aluno, id_user FROM alunos WHERE id_aluno = $1 LIMIT 1`,
            [idAluno]
        );

        if (!alunoRows.length) {
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const anoLetivoAtual = getAnoLetivo(new Date());
        const jaRenovado = await isMatriculaAtiva(idAluno, anoLetivoAtual);

        if (jaRenovado) {
            return res.status(400).json({
                message:
                    'A matrícula já está renovada para o ano letivo atual.',
            });
        }

        const resultadoRenovacao = await renovarMatricula(
            idAluno,
            anoLetivoAtual
        );

        if (!resultadoRenovacao) {
            return res.status(500).json({
                message: 'Erro ao renovar matrícula.',
            });
        }

        await ativarContaAluno(idAluno);

        await ensureRenovacaoMatriculaAlertDefinition();

        await dispatchAlert({
            codigo: 'renovacao-matricula',
            for_user_ids: [alunoRows[0].id_user],
            titulo: 'Matrícula renovada com sucesso',
            descricao: `A matrícula foi renovada para ${anoLetivoAtual}.`,
            nivel: 'success',
            payload: {
                id_aluno: idAluno,
                ano_letivo: anoLetivoAtual,
            },
            pushLink: '/aluno/perfil',
        });

        await registarUpdate(
            req.userId,
            'alunos',
            idAluno,
            { matriculaAnterior: 'expirada' },
            { matriculaAtual: anoLetivoAtual },
            'alert'
        ).catch(() => {});

        return res.status(200).json({
            message: `Matrícula renovada com sucesso para ${anoLetivoAtual}!`,
            renovacao: {
                dataUltmaRenovacao: resultadoRenovacao.data_renovacao_ultima,
                anoLetivoRenovacao: anoLetivoAtual,
            },
        });
    } catch (error) {
        console.error('Erro ao renovar matrícula (gestor):', error.message);
        return res.status(500).json({
            message: 'Erro ao renovar matrícula.',
        });
    }
}

/**
 * GET /api/gestor/renovacoes/alunos-expirados
 * Lista alunos com matrícula expirada (apenas gestor)
 */
export async function listarAlunosMatriculaExpirada(req, res) {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: 'Não autenticado.' });
        }

        // Verificar role (apenas gestor)
        const { rows: userRows } = await db.query(
            `SELECT role FROM users WHERE id_user = $1`,
            [req.userId]
        );

        const role = String(userRows[0]?.role || '').toLowerCase();
        if (role !== 'gestor' && role !== 'admin') {
            return res.status(403).json({
                message: 'Acesso negado.',
            });
        }

        const anoLetivoAtual = getAnoLetivo(new Date());

        const { rows } = await db.query(
            `
            SELECT 
                a.id_aluno,
                a.id_user,
                a.ano_letivo_renovacao,
                p.nome,
                u.email,
                u.status
            FROM alunos a
            INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            INNER JOIN users u ON u.id_user = a.id_user
            WHERE a.ano_letivo_renovacao != $1
                OR a.ano_letivo_renovacao IS NULL
            ORDER BY p.nome ASC
        `,
            [anoLetivoAtual]
        );

        return res.status(200).json({
            anoLetivoAtual,
            total: rows.length,
            alunos: rows,
        });
    } catch (error) {
        console.error(
            'Erro ao listar alunos com matrícula expirada:',
            error.message
        );
        return res.status(500).json({
            message: 'Erro ao listar alunos.',
        });
    }
}

/**
 * POST /api/gestor/renovacoes/suspender-expirados
 * Suspende contas de alunos com matrícula expirada (apenas gestor)
 */
export async function suspenderAlunosExpirados(req, res) {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: 'Não autenticado.' });
        }

        // Verificar role (apenas gestor)
        const { rows: userRows } = await db.query(
            `SELECT role FROM users WHERE id_user = $1`,
            [req.userId]
        );

        const role = String(userRows[0]?.role || '').toLowerCase();
        if (role !== 'gestor' && role !== 'admin') {
            return res.status(403).json({
                message: 'Acesso negado.',
            });
        }

        const anoLetivoAtual = getAnoLetivo(new Date());

        // Suspender alunos com matrícula expirada
        const { rowCount } = await db.query(
            `
            UPDATE users
            SET status = false
            WHERE id_user IN (
                SELECT a.id_user
                FROM alunos a
                WHERE (a.ano_letivo_renovacao != $1 OR a.ano_letivo_renovacao IS NULL)
                    AND a.id_user != $2
            )
            AND status = true
        `,
            [anoLetivoAtual, req.userId]
        );

        return res.status(200).json({
            message: `${rowCount} conta(s) suspensa(s).`,
            contatsSuspensas: rowCount,
        });
    } catch (error) {
        console.error('Erro ao suspender alunos:', error.message);
        return res.status(500).json({
            message: 'Erro ao suspender alunos.',
        });
    }
}
