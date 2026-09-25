import { db } from '../config/db.js';
import { registarInsert } from '../services/logService.js';
import { notificarGestoresLimpezaDados } from '../services/alertasDispatchService.js';

const CONFIRMACAO_ESPERADA = 'ELIMINAR DADOS';

async function deleteWithFallback(client, query, params = []) {
    try {
        const result = await client.query(query, params);
        return result.rowCount ?? 0;
    } catch {
        return 0;
    }
}

/**
 * POST /api/gestor/dados/limpar
 * Elimina dados em massa. Nunca apaga utilizadores com role='gestor'.
 *
 * Body: {
 *   confirmacao: "ELIMINAR DADOS",
 *   opcoes: {
 *     alunos: boolean,
 *     professores: boolean,
 *     servicos: boolean,
 *     inscricoes_publicas: boolean,
 *     logs: boolean,
 *   }
 * }
 */
export async function limparDadosEmMassa(req, res) {
    const { confirmacao, opcoes } = req.body || {};

    if (typeof confirmacao !== 'string' || confirmacao.trim() !== CONFIRMACAO_ESPERADA) {
        return res.status(400).json({
            message: `Texto de confirmação inválido. Escreva exatamente: ${CONFIRMACAO_ESPERADA}`,
        });
    }

    const {
        alunos = false,
        professores = false,
        servicos = false,
        inscricoes_publicas = false,
        logs = false,
    } = opcoes || {};

    if (!alunos && !professores && !servicos && !inscricoes_publicas && !logs) {
        return res.status(400).json({ message: 'Selecione pelo menos uma categoria para eliminar.' });
    }

    const client = await db.connect();
    const contagens = {};

    try {
        await client.query('BEGIN');

        // ── 1. Presenças ──────────────────────────────────────────────────────────
        // Dependem de id_aluno e id_servico; eliminam-se sempre que alunos ou serviços são apagados.
        if (alunos || servicos) {
            contagens.presencas = await deleteWithFallback(client, 'DELETE FROM presencas');
        }

        // ── 2. Inscrições em serviços ─────────────────────────────────────────────
        if (alunos || servicos) {
            contagens.inscricoes = await deleteWithFallback(client, 'DELETE FROM inscricoes');
        }

        // ── 3. Serviços curriculares e extra-curriculares ─────────────────────────
        if (servicos) {
            const sc = await deleteWithFallback(client, 'DELETE FROM servicos_curriculares');
            const se = await deleteWithFallback(client, 'DELETE FROM servicos_extracurriculares');
            contagens.servicos = sc + se;
        }

        // ── 4. Alunos (users + pessoas + encarregados) ────────────────────────────
        if (alunos) {
            const { rows: alunoRows } = await client.query(`
                SELECT
                    a.id_aluno,
                    a.id_user    AS aluno_id_user,
                    a.id_pessoa  AS aluno_id_pessoa,
                    a.id_encarregado,
                    e.id_user    AS ee_id_user,
                    e.id_pessoa  AS ee_id_pessoa
                FROM alunos a
                INNER JOIN users u ON u.id_user = a.id_user AND u.role = 'aluno'
                LEFT JOIN encarregados e ON e.id_encarregado = a.id_encarregado
            `);

            await deleteWithFallback(
                client,
                `DELETE FROM alunos WHERE id_user IN (SELECT id_user FROM users WHERE role = 'aluno')`
            );

            const alunoUserIds = [...new Set(alunoRows.map((r) => r.aluno_id_user).filter(Boolean))];
            const alunoPessoaIds = [...new Set(alunoRows.map((r) => r.aluno_id_pessoa).filter(Boolean))];
            const eeUserIds = [...new Set(alunoRows.map((r) => r.ee_id_user).filter(Boolean))];
            const eePessoaIds = [...new Set(alunoRows.map((r) => r.ee_id_pessoa).filter(Boolean))];
            const encarregadoIds = [...new Set(alunoRows.map((r) => r.id_encarregado).filter(Boolean))];

            if (encarregadoIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM encarregados WHERE id_encarregado = ANY($1::int[])`,
                    [encarregadoIds]
                );
            }
            if (alunoUserIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM users WHERE id_user = ANY($1::int[]) AND role != 'gestor'`,
                    [alunoUserIds]
                );
            }
            if (eeUserIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM users WHERE id_user = ANY($1::int[]) AND role != 'gestor'`,
                    [eeUserIds]
                );
            }
            if (alunoPessoaIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM pessoas WHERE id_pessoa = ANY($1::int[])`,
                    [alunoPessoaIds]
                );
            }
            if (eePessoaIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM pessoas WHERE id_pessoa = ANY($1::int[])`,
                    [eePessoaIds]
                );
            }

            contagens.alunos = alunoRows.length;
        }

        // ── 5. Professores (users + pessoas) ──────────────────────────────────────
        if (professores) {
            const { rows: profRows } = await client.query(`
                SELECT p.id_professor, p.id_user AS prof_id_user, p.id_pessoa AS prof_id_pessoa
                FROM professores p
                INNER JOIN users u ON u.id_user = p.id_user AND u.role = 'professor'
            `);

            await deleteWithFallback(
                client,
                `DELETE FROM professores WHERE id_user IN (SELECT id_user FROM users WHERE role = 'professor')`
            );

            const profUserIds = [...new Set(profRows.map((r) => r.prof_id_user).filter(Boolean))];
            const profPessoaIds = [...new Set(profRows.map((r) => r.prof_id_pessoa).filter(Boolean))];

            if (profUserIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM users WHERE id_user = ANY($1::int[]) AND role != 'gestor'`,
                    [profUserIds]
                );
            }
            if (profPessoaIds.length) {
                await deleteWithFallback(
                    client,
                    `DELETE FROM pessoas WHERE id_pessoa = ANY($1::int[])`,
                    [profPessoaIds]
                );
            }

            contagens.professores = profRows.length;
        }

        // ── 6. Inscrições públicas ────────────────────────────────────────────────
        if (inscricoes_publicas) {
            contagens.inscricoes_publicas = await deleteWithFallback(client, 'DELETE FROM inscricoes_publicas');
        }

        // ── 7. Logs ───────────────────────────────────────────────────────────────
        if (logs) {
            contagens.logs = await deleteWithFallback(client, 'DELETE FROM logs');
        }

        await client.query('COMMIT');

        await registarInsert(
            req.userId ?? null,
            'limpeza_dados_massa',
            { opcoes, contagens },
            null
        ).catch(() => {});

        notificarGestoresLimpezaDados({
            actorUserId: req.userId ?? null,
            contagens,
        }).catch(() => {});

        return res.status(200).json({
            message: 'Limpeza de dados concluída com sucesso.',
            contagens,
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro na limpeza de dados em massa:', error.message);
        return res.status(500).json({
            message: `Erro ao realizar a limpeza de dados: ${error.message}`,
        });
    } finally {
        client.release();
    }
}
