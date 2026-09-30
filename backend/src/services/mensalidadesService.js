import { db } from '../config/db.js';
import { toMoney } from './financeUtils.js';

// Lógica de mensalidades partilhada pelo controller financeiro e pelas
// tarefas agendadas (geração automática no início de cada mês).

export async function inserirLinhas(client, idMensalidade, linhas) {
    for (const [ordem, linha] of linhas.entries()) {
        await client.query(
            `INSERT INTO mensalidade_linhas (id_mensalidade, id_inscricao, descricao, valor, ordem)
             VALUES ($1, $2, $3, $4, $5)`,
            [idMensalidade, linha.id_inscricao, linha.descricao, linha.valor, ordem]
        );
    }
}

/**
 * Calcula as mensalidades a gerar para um mês: uma por aluno com inscrições
 * ativas em serviços curriculares ativos nesse mês, com uma linha por
 * inscrição (valor = inscricoes.valor_final).
 */
export async function calcularGeracao(executor, mesReferencia) {
    const { rows } = await executor.query(
        `
        WITH periodo AS (
            SELECT $1::date AS inicio,
                   ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date AS fim
        )
        SELECT
            a.id_aluno,
            a.id_encarregado,
            pa.nome AS aluno_nome,
            pe.nome AS encarregado_nome,
            i.id_inscricao,
            i.valor_final,
            d.nome AS disciplina,
            n.nome AS nivel,
            m.nome AS modalidade,
            EXISTS (
                SELECT 1 FROM mensalidades mx
                WHERE mx.id_aluno = a.id_aluno
                  AND mx.mes_referencia = $1::date
                  AND mx.anulada = false
            ) AS ja_existe
        FROM inscricoes i
        CROSS JOIN periodo p
        INNER JOIN servicos_curriculares s ON s.id_servico = i.id_servico_curricular
        INNER JOIN alunos a ON a.id_aluno = i.id_aluno
        INNER JOIN users u ON u.id_user = a.id_user
        INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
        LEFT JOIN encarregados e ON e.id_encarregado = a.id_encarregado
        LEFT JOIN pessoas pe ON pe.id_pessoa = e.id_pessoa
        LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
        LEFT JOIN niveis_ensino n ON n.id_nivel = d.id_nivel
        LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
        WHERE LOWER(COALESCE(i.estado, '')) = 'ativa'
          AND COALESCE(s.ativo, true) = true
          AND u.status = true
          AND COALESCE(i.data_inscricao, p.inicio) <= p.fim
          AND (s.data_inicio IS NULL OR s.data_inicio <= p.fim)
          AND (s.data_fim IS NULL OR s.data_fim >= p.inicio)
        ORDER BY pa.nome, d.nome, i.id_inscricao
        `,
        [mesReferencia]
    );

    const porAluno = new Map();
    const semPreco = [];
    const jaExistentes = new Set();

    for (const row of rows) {
        if (row.ja_existe) {
            jaExistentes.add(row.id_aluno);
            continue;
        }

        const descricao = [
            row.disciplina || 'Serviço curricular',
            row.nivel,
            row.modalidade,
        ]
            .filter(Boolean)
            .join(' · ');

        if (row.valor_final === null || row.valor_final === undefined) {
            semPreco.push({
                idAluno: row.id_aluno,
                aluno: row.aluno_nome,
                idInscricao: row.id_inscricao,
                servico: descricao,
            });
            continue;
        }

        if (!porAluno.has(row.id_aluno)) {
            porAluno.set(row.id_aluno, {
                idAluno: row.id_aluno,
                idEncarregado: row.id_encarregado,
                aluno: row.aluno_nome,
                encarregado: row.encarregado_nome || null,
                linhas: [],
                total: 0,
            });
        }

        const entrada = porAluno.get(row.id_aluno);
        const valor = toMoney(row.valor_final);
        entrada.linhas.push({ id_inscricao: row.id_inscricao, descricao, valor });
        entrada.total = toMoney(entrada.total + valor);
    }

    const aCriar = [...porAluno.values()];

    return {
        aCriar,
        semPreco,
        jaExistentes: jaExistentes.size,
        total: toMoney(aCriar.reduce((sum, item) => sum + item.total, 0)),
    };
}

/**
 * Cria numa transação as mensalidades de um mês. Alunos que já têm
 * mensalidade (não anulada) nesse mês são ignorados, por isso é seguro
 * repetir.
 */
export async function gerarMensalidadesDoMes({ mesReferencia, dataVencimento, criadoPor = null }) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const resultado = await calcularGeracao(client, mesReferencia);

        let criadas = 0;
        for (const item of resultado.aCriar) {
            const inserted = await client.query(
                `INSERT INTO mensalidades
                    (id_aluno, id_encarregado, mes_referencia, data_vencimento, valor_total, criado_por)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id_aluno, mes_referencia) WHERE anulada = false DO NOTHING
                 RETURNING id_mensalidade`,
                [item.idAluno, item.idEncarregado, mesReferencia, dataVencimento, item.total, criadoPor]
            );

            const idMensalidade = inserted.rows[0]?.id_mensalidade;
            if (!idMensalidade) continue;

            await inserirLinhas(client, idMensalidade, item.linhas);
            criadas += 1;
        }

        await client.query('COMMIT');

        return {
            criadas,
            jaExistentes: resultado.jaExistentes,
            semPreco: resultado.semPreco,
            total: resultado.total,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
