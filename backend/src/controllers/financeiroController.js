import { db } from '../config/db.js';
import {
    METODOS_PAGAMENTO,
    isISODate,
    parseMes,
    toMoney,
    todayISO,
} from '../services/financeUtils.js';
import { calcularCustoProfessoresMes } from './custosProfessoresController.js';

/**
 * ========================================
 * FINANCEIRO CONTROLLER
 * ========================================
 * Mensalidades (o que cada aluno deve por mês, pago pelo encarregado de
 * educação) e pagamentos registados manualmente.
 *
 * O estado de cada mensalidade (pendente / parcial / paga / vencida /
 * anulada) vem da view vw_mensalidades_estado — nunca é guardado à mão.
 * ========================================
 */

const ESTADOS_MENSALIDADE = new Set([
    'pendente',
    'parcial',
    'paga',
    'vencida',
    'anulada',
]);

// ---------- utilitários ----------

function badRequest(res, message) {
    return res.status(400).json({ message });
}

/**
 * Normaliza as linhas enviadas pelo cliente: descrição obrigatória e
 * valor >= 0 com no máximo 2 casas decimais.
 */
function normalizarLinhas(linhas) {
    if (!Array.isArray(linhas) || linhas.length === 0) {
        return { error: 'A mensalidade tem de ter pelo menos uma linha.' };
    }

    const result = [];
    for (const [index, linha] of linhas.entries()) {
        const descricao = String(linha?.descricao || '').trim();
        const valor = Number(linha?.valor);

        if (!descricao) {
            return { error: `Linha ${index + 1}: a descrição é obrigatória.` };
        }
        if (!Number.isFinite(valor) || valor < 0) {
            return { error: `Linha ${index + 1}: valor inválido.` };
        }

        result.push({
            descricao: descricao.slice(0, 200),
            valor: toMoney(valor),
            id_inscricao: Number.isInteger(Number(linha?.id_inscricao))
                ? Number(linha.id_inscricao)
                : null,
        });
    }

    return { linhas: result };
}

function mapMensalidadeRow(row) {
    return {
        id: Number(row.id_mensalidade),
        idAluno: row.id_aluno,
        aluno: row.aluno_nome,
        idEncarregado: row.id_encarregado,
        encarregado: row.encarregado_nome || null,
        encarregadoEmail: row.encarregado_email || null,
        encarregadoNif: row.encarregado_nif || null,
        mes: String(row.mes_referencia).slice(0, 7),
        dataVencimento: row.data_vencimento,
        valorTotal: toMoney(row.valor_total),
        valorPago: toMoney(row.valor_pago),
        valorEmDivida: toMoney(row.valor_em_divida),
        estado: row.estado,
        ultimoPagamento: row.ultimo_pagamento || null,
    };
}

const MENSALIDADE_SELECT = `
    SELECT
        v.*,
        pa.nome AS aluno_nome,
        pe.nome AS encarregado_nome,
        pe.nif AS encarregado_nif,
        ue.email AS encarregado_email
    FROM vw_mensalidades_estado v
    INNER JOIN alunos a ON a.id_aluno = v.id_aluno
    INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
    LEFT JOIN encarregados e ON e.id_encarregado = v.id_encarregado
    LEFT JOIN pessoas pe ON pe.id_pessoa = e.id_pessoa
    LEFT JOIN users ue ON ue.id_user = e.id_user
`;

async function carregarMensalidade(executor, idMensalidade) {
    const { rows } = await executor.query(
        `${MENSALIDADE_SELECT} WHERE v.id_mensalidade = $1`,
        [idMensalidade]
    );
    if (!rows.length) return null;

    const [linhasResult, pagamentosResult, extraResult] = await Promise.all([
        executor.query(
            `SELECT id_linha, id_inscricao, descricao, valor
             FROM mensalidade_linhas
             WHERE id_mensalidade = $1
             ORDER BY ordem, id_linha`,
            [idMensalidade]
        ),
        executor.query(
            `SELECT p.id_pagamento, p.valor, p.data_pagamento, p.metodo, p.referencia,
                    p.observacoes, p.anulado, p.motivo_anulacao, p.created_at,
                    u.email AS registado_por_email
             FROM pagamentos p
             LEFT JOIN users u ON u.id_user = p.registado_por
             WHERE p.id_mensalidade = $1
             ORDER BY p.data_pagamento DESC, p.id_pagamento DESC`,
            [idMensalidade]
        ),
        executor.query(
            `SELECT observacoes, motivo_anulacao, created_at
             FROM mensalidades WHERE id_mensalidade = $1`,
            [idMensalidade]
        ),
    ]);

    return {
        ...mapMensalidadeRow(rows[0]),
        observacoes: extraResult.rows[0]?.observacoes || '',
        motivoAnulacao: extraResult.rows[0]?.motivo_anulacao || null,
        criadaEm: extraResult.rows[0]?.created_at || null,
        linhas: linhasResult.rows.map((l) => ({
            id: Number(l.id_linha),
            idInscricao: l.id_inscricao,
            descricao: l.descricao,
            valor: toMoney(l.valor),
        })),
        pagamentos: pagamentosResult.rows.map((p) => ({
            id: Number(p.id_pagamento),
            valor: toMoney(p.valor),
            data: p.data_pagamento,
            metodo: p.metodo,
            referencia: p.referencia || '',
            observacoes: p.observacoes || '',
            anulado: p.anulado,
            motivoAnulacao: p.motivo_anulacao || null,
            registadoPor: p.registado_por_email || null,
            criadoEm: p.created_at,
        })),
    };
}

async function contarPagamentosAtivos(executor, idMensalidade) {
    const { rows } = await executor.query(
        `SELECT COUNT(*)::int AS total FROM pagamentos
         WHERE id_mensalidade = $1 AND anulado = false`,
        [idMensalidade]
    );
    return rows[0]?.total || 0;
}

async function inserirLinhas(client, idMensalidade, linhas) {
    for (const [ordem, linha] of linhas.entries()) {
        await client.query(
            `INSERT INTO mensalidade_linhas (id_mensalidade, id_inscricao, descricao, valor, ordem)
             VALUES ($1, $2, $3, $4, $5)`,
            [idMensalidade, linha.id_inscricao, linha.descricao, linha.valor, ordem]
        );
    }
}

// ---------- geração de mensalidades ----------

/**
 * Calcula as mensalidades a gerar para um mês: uma por aluno com inscrições
 * ativas em serviços curriculares ativos nesse mês, com uma linha por
 * inscrição (valor = inscricoes.valor_final).
 */
async function calcularGeracao(executor, mesReferencia) {
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

function validarPedidoGeracao(body) {
    const mesReferencia = parseMes(body?.mes);
    if (!mesReferencia) {
        return { error: 'Mês inválido (formato AAAA-MM).' };
    }

    const dataVencimento = String(body?.data_vencimento || '').trim();
    if (!isISODate(dataVencimento)) {
        return { error: 'Data de vencimento inválida (formato AAAA-MM-DD).' };
    }

    return { mesReferencia, dataVencimento };
}

/**
 * POST /api/gestor/financeiro/mensalidades/gerar/previsualizar
 * Mostra o que seria criado, sem gravar nada.
 */
export async function previsualizarGeracao(req, res) {
    const pedido = validarPedidoGeracao(req.body);
    if (pedido.error) return badRequest(res, pedido.error);

    try {
        const resultado = await calcularGeracao(db, pedido.mesReferencia);
        return res.json({
            mes: pedido.mesReferencia.slice(0, 7),
            dataVencimento: pedido.dataVencimento,
            ...resultado,
        });
    } catch (error) {
        console.error('[financeiro] previsualizarGeracao:', error.message);
        return res.status(500).json({ message: 'Erro ao calcular as mensalidades.' });
    }
}

/**
 * POST /api/gestor/financeiro/mensalidades/gerar
 * Cria as mensalidades do mês. Alunos que já têm mensalidade (não anulada)
 * nesse mês são ignorados, por isso é seguro repetir.
 */
export async function gerarMensalidades(req, res) {
    const pedido = validarPedidoGeracao(req.body);
    if (pedido.error) return badRequest(res, pedido.error);

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const resultado = await calcularGeracao(client, pedido.mesReferencia);

        let criadas = 0;
        for (const item of resultado.aCriar) {
            const inserted = await client.query(
                `INSERT INTO mensalidades
                    (id_aluno, id_encarregado, mes_referencia, data_vencimento, valor_total, criado_por)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id_aluno, mes_referencia) WHERE anulada = false DO NOTHING
                 RETURNING id_mensalidade`,
                [
                    item.idAluno,
                    item.idEncarregado,
                    pedido.mesReferencia,
                    pedido.dataVencimento,
                    item.total,
                    req.userId ?? null,
                ]
            );

            const idMensalidade = inserted.rows[0]?.id_mensalidade;
            if (!idMensalidade) continue;

            await inserirLinhas(client, idMensalidade, item.linhas);
            criadas += 1;
        }

        await client.query('COMMIT');

        return res.status(201).json({
            message:
                criadas > 0
                    ? `${criadas} mensalidade${criadas === 1 ? '' : 's'} gerada${criadas === 1 ? '' : 's'}.`
                    : 'Não havia mensalidades novas para gerar.',
            criadas,
            jaExistentes: resultado.jaExistentes,
            semPreco: resultado.semPreco,
            total: resultado.total,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[financeiro] gerarMensalidades:', error.message);
        return res.status(500).json({ message: 'Erro ao gerar as mensalidades.' });
    } finally {
        client.release();
    }
}

// ---------- mensalidades ----------

/**
 * GET /api/gestor/financeiro/mensalidades?mes=AAAA-MM&estado=&q=
 */
export async function listarMensalidades(req, res) {
    const params = [];
    const where = [];

    if (req.query.mes) {
        const mes = parseMes(req.query.mes);
        if (!mes) return badRequest(res, 'Mês inválido (formato AAAA-MM).');
        params.push(mes);
        where.push(`v.mes_referencia = $${params.length}`);
    }

    if (req.query.estado) {
        const estado = String(req.query.estado).toLowerCase();
        if (estado === 'em_divida') {
            where.push(`v.estado IN ('pendente', 'parcial', 'vencida')`);
        } else if (ESTADOS_MENSALIDADE.has(estado)) {
            params.push(estado);
            where.push(`v.estado = $${params.length}`);
        } else {
            return badRequest(res, 'Estado inválido.');
        }
    }

    if (req.query.q) {
        params.push(`%${String(req.query.q).trim()}%`);
        where.push(`(pa.nome ILIKE $${params.length} OR pe.nome ILIKE $${params.length})`);
    }

    if (req.query.aluno) {
        const idAluno = Number(req.query.aluno);
        if (!Number.isInteger(idAluno)) return badRequest(res, 'Aluno inválido.');
        params.push(idAluno);
        where.push(`v.id_aluno = $${params.length}`);
    }

    try {
        const { rows } = await db.query(
            `${MENSALIDADE_SELECT}
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY v.mes_referencia DESC, pa.nome ASC
             LIMIT 1000`,
            params
        );

        const mensalidades = rows.map(mapMensalidadeRow);
        const ativas = mensalidades.filter((m) => m.estado !== 'anulada');

        return res.json({
            mensalidades,
            totais: {
                faturado: toMoney(ativas.reduce((s, m) => s + m.valorTotal, 0)),
                recebido: toMoney(ativas.reduce((s, m) => s + m.valorPago, 0)),
                emDivida: toMoney(ativas.reduce((s, m) => s + m.valorEmDivida, 0)),
            },
        });
    } catch (error) {
        console.error('[financeiro] listarMensalidades:', error.message);
        return res.status(500).json({ message: 'Erro ao listar mensalidades.' });
    }
}

/**
 * GET /api/gestor/financeiro/mensalidades/:id
 */
export async function obterMensalidade(req, res) {
    try {
        const mensalidade = await carregarMensalidade(db, Number(req.params.id));
        if (!mensalidade) {
            return res.status(404).json({ message: 'Mensalidade não encontrada.' });
        }
        return res.json({ mensalidade });
    } catch (error) {
        console.error('[financeiro] obterMensalidade:', error.message);
        return res.status(500).json({ message: 'Erro ao obter a mensalidade.' });
    }
}

/**
 * POST /api/gestor/financeiro/mensalidades
 * Cria uma mensalidade manual (ex.: aluno inscrito a meio do mês, taxa de
 * inscrição, serviço extra).
 * Body: { id_aluno, mes, data_vencimento, linhas: [{descricao, valor}], observacoes? }
 */
export async function criarMensalidade(req, res) {
    const idAluno = Number(req.body?.id_aluno);
    if (!Number.isInteger(idAluno)) return badRequest(res, 'Aluno inválido.');

    const pedido = validarPedidoGeracao(req.body);
    if (pedido.error) return badRequest(res, pedido.error);

    const normalizadas = normalizarLinhas(req.body?.linhas);
    if (normalizadas.error) return badRequest(res, normalizadas.error);

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const aluno = await client.query(
            `SELECT id_aluno, id_encarregado FROM alunos WHERE id_aluno = $1`,
            [idAluno]
        );
        if (!aluno.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Aluno não encontrado.' });
        }

        const total = toMoney(normalizadas.linhas.reduce((s, l) => s + l.valor, 0));
        const inserted = await client.query(
            `INSERT INTO mensalidades
                (id_aluno, id_encarregado, mes_referencia, data_vencimento, valor_total, observacoes, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id_mensalidade`,
            [
                idAluno,
                aluno.rows[0].id_encarregado,
                pedido.mesReferencia,
                pedido.dataVencimento,
                total,
                String(req.body?.observacoes || '').trim() || null,
                req.userId ?? null,
            ]
        );

        const idMensalidade = inserted.rows[0].id_mensalidade;
        await inserirLinhas(client, idMensalidade, normalizadas.linhas);
        await client.query('COMMIT');

        const mensalidade = await carregarMensalidade(db, idMensalidade);
        return res.status(201).json({ message: 'Mensalidade criada.', mensalidade });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error?.code === '23505') {
            return res.status(409).json({
                message:
                    'Este aluno já tem uma mensalidade nesse mês. Edite-a para acrescentar linhas.',
            });
        }
        console.error('[financeiro] criarMensalidade:', error.message);
        return res.status(500).json({ message: 'Erro ao criar a mensalidade.' });
    } finally {
        client.release();
    }
}

/**
 * PATCH /api/gestor/financeiro/mensalidades/:id
 * Body: { data_vencimento?, observacoes?, linhas? }
 * As linhas (e portanto o total) só podem mudar enquanto não houver
 * pagamentos ativos.
 */
export async function atualizarMensalidade(req, res) {
    const idMensalidade = Number(req.params.id);
    const { data_vencimento: dataVencimento, observacoes, linhas } = req.body || {};

    if (dataVencimento !== undefined && !isISODate(dataVencimento)) {
        return badRequest(res, 'Data de vencimento inválida (formato AAAA-MM-DD).');
    }

    let normalizadas = null;
    if (linhas !== undefined) {
        normalizadas = normalizarLinhas(linhas);
        if (normalizadas.error) return badRequest(res, normalizadas.error);
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const atual = await client.query(
            `SELECT anulada FROM mensalidades WHERE id_mensalidade = $1 FOR UPDATE`,
            [idMensalidade]
        );
        if (!atual.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Mensalidade não encontrada.' });
        }
        if (atual.rows[0].anulada) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Não é possível editar uma mensalidade anulada.' });
        }

        if (normalizadas) {
            if ((await contarPagamentosAtivos(client, idMensalidade)) > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    message:
                        'Esta mensalidade já tem pagamentos. Anule-os primeiro para alterar os valores.',
                });
            }

            await client.query(`DELETE FROM mensalidade_linhas WHERE id_mensalidade = $1`, [
                idMensalidade,
            ]);
            await inserirLinhas(client, idMensalidade, normalizadas.linhas);
            await client.query(`UPDATE mensalidades SET valor_total = $1 WHERE id_mensalidade = $2`, [
                toMoney(normalizadas.linhas.reduce((s, l) => s + l.valor, 0)),
                idMensalidade,
            ]);
        }

        if (dataVencimento !== undefined) {
            await client.query(`UPDATE mensalidades SET data_vencimento = $1 WHERE id_mensalidade = $2`, [
                dataVencimento,
                idMensalidade,
            ]);
        }

        if (observacoes !== undefined) {
            await client.query(`UPDATE mensalidades SET observacoes = $1 WHERE id_mensalidade = $2`, [
                String(observacoes || '').trim() || null,
                idMensalidade,
            ]);
        }

        await client.query('COMMIT');
        const mensalidade = await carregarMensalidade(db, idMensalidade);
        return res.json({ message: 'Mensalidade atualizada.', mensalidade });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[financeiro] atualizarMensalidade:', error.message);
        return res.status(500).json({ message: 'Erro ao atualizar a mensalidade.' });
    } finally {
        client.release();
    }
}

/**
 * POST /api/gestor/financeiro/mensalidades/:id/anular
 * Body: { motivo }
 */
export async function anularMensalidade(req, res) {
    const idMensalidade = Number(req.params.id);
    const motivo = String(req.body?.motivo || '').trim();
    if (!motivo) return badRequest(res, 'Indique o motivo da anulação.');

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const atual = await client.query(
            `SELECT anulada FROM mensalidades WHERE id_mensalidade = $1 FOR UPDATE`,
            [idMensalidade]
        );
        if (!atual.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Mensalidade não encontrada.' });
        }
        if (atual.rows[0].anulada) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'A mensalidade já está anulada.' });
        }
        if ((await contarPagamentosAtivos(client, idMensalidade)) > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'Esta mensalidade tem pagamentos. Anule-os primeiro.',
            });
        }

        await client.query(
            `UPDATE mensalidades SET anulada = true, motivo_anulacao = $1 WHERE id_mensalidade = $2`,
            [motivo, idMensalidade]
        );
        await client.query('COMMIT');

        const mensalidade = await carregarMensalidade(db, idMensalidade);
        return res.json({ message: 'Mensalidade anulada.', mensalidade });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[financeiro] anularMensalidade:', error.message);
        return res.status(500).json({ message: 'Erro ao anular a mensalidade.' });
    } finally {
        client.release();
    }
}

// ---------- pagamentos ----------

/**
 * POST /api/gestor/financeiro/mensalidades/:id/pagamentos
 * Body: { valor, data_pagamento, metodo, referencia?, observacoes? }
 * Não permite pagar mais do que o valor em dívida.
 */
export async function registarPagamento(req, res) {
    const idMensalidade = Number(req.params.id);
    const valor = toMoney(req.body?.valor);
    const dataPagamento = String(req.body?.data_pagamento || '').trim();
    const metodo = String(req.body?.metodo || '').trim().toLowerCase();

    if (!(valor > 0)) return badRequest(res, 'O valor tem de ser maior que zero.');
    if (!isISODate(dataPagamento)) return badRequest(res, 'Data de pagamento inválida.');
    if (dataPagamento > todayISO()) {
        return badRequest(res, 'A data de pagamento não pode ser no futuro.');
    }
    if (!METODOS_PAGAMENTO.has(metodo)) return badRequest(res, 'Método de pagamento inválido.');

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Bloqueia a mensalidade para evitar dois pagamentos em simultâneo
        // ultrapassarem o valor em dívida.
        const lock = await client.query(
            `SELECT anulada FROM mensalidades WHERE id_mensalidade = $1 FOR UPDATE`,
            [idMensalidade]
        );
        if (!lock.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Mensalidade não encontrada.' });
        }
        if (lock.rows[0].anulada) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Não é possível pagar uma mensalidade anulada.' });
        }

        const estado = await client.query(
            `SELECT valor_em_divida FROM vw_mensalidades_estado WHERE id_mensalidade = $1`,
            [idMensalidade]
        );
        const emDivida = toMoney(estado.rows[0]?.valor_em_divida);
        if (emDivida <= 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Esta mensalidade já está paga.' });
        }
        if (valor > emDivida) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `O valor excede o que está em dívida (${emDivida.toFixed(2)} €).`,
            });
        }

        await client.query(
            `INSERT INTO pagamentos
                (id_mensalidade, valor, data_pagamento, metodo, referencia, observacoes, registado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                idMensalidade,
                valor,
                dataPagamento,
                metodo,
                String(req.body?.referencia || '').trim() || null,
                String(req.body?.observacoes || '').trim() || null,
                req.userId ?? null,
            ]
        );

        await client.query('COMMIT');
        const mensalidade = await carregarMensalidade(db, idMensalidade);
        return res.status(201).json({ message: 'Pagamento registado.', mensalidade });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[financeiro] registarPagamento:', error.message);
        return res.status(500).json({ message: 'Erro ao registar o pagamento.' });
    } finally {
        client.release();
    }
}

/**
 * POST /api/gestor/financeiro/pagamentos/:id/anular
 * Body: { motivo }
 * Os pagamentos nunca são apagados, apenas anulados (fica o histórico).
 */
export async function anularPagamento(req, res) {
    const idPagamento = Number(req.params.id);
    const motivo = String(req.body?.motivo || '').trim();
    if (!motivo) return badRequest(res, 'Indique o motivo da anulação.');

    try {
        const { rows } = await db.query(
            `UPDATE pagamentos
             SET anulado = true, motivo_anulacao = $1
             WHERE id_pagamento = $2 AND anulado = false
             RETURNING id_mensalidade`,
            [motivo, idPagamento]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Pagamento não encontrado ou já anulado.' });
        }

        const mensalidade = await carregarMensalidade(db, rows[0].id_mensalidade);
        return res.json({ message: 'Pagamento anulado.', mensalidade });
    } catch (error) {
        console.error('[financeiro] anularPagamento:', error.message);
        return res.status(500).json({ message: 'Erro ao anular o pagamento.' });
    }
}

/**
 * GET /api/gestor/financeiro/pagamentos?de=AAAA-MM-DD&ate=AAAA-MM-DD&metodo=&q=
 */
export async function listarPagamentos(req, res) {
    const params = [];
    const where = [];

    for (const [key, op] of [['de', '>='], ['ate', '<=']]) {
        if (req.query[key]) {
            if (!isISODate(req.query[key])) return badRequest(res, `Data inválida: ${key}.`);
            params.push(req.query[key]);
            where.push(`p.data_pagamento ${op} $${params.length}`);
        }
    }

    if (req.query.metodo) {
        const metodo = String(req.query.metodo).toLowerCase();
        if (!METODOS_PAGAMENTO.has(metodo)) return badRequest(res, 'Método inválido.');
        params.push(metodo);
        where.push(`p.metodo = $${params.length}`);
    }

    if (req.query.q) {
        params.push(`%${String(req.query.q).trim()}%`);
        where.push(
            `(pa.nome ILIKE $${params.length} OR pe.nome ILIKE $${params.length} OR p.referencia ILIKE $${params.length})`
        );
    }

    try {
        const { rows } = await db.query(
            `SELECT
                p.id_pagamento, p.id_mensalidade, p.valor, p.data_pagamento, p.metodo,
                p.referencia, p.anulado, p.motivo_anulacao,
                m.mes_referencia, m.id_aluno,
                pa.nome AS aluno_nome, pe.nome AS encarregado_nome,
                u.email AS registado_por_email
             FROM pagamentos p
             INNER JOIN mensalidades m ON m.id_mensalidade = p.id_mensalidade
             INNER JOIN alunos a ON a.id_aluno = m.id_aluno
             INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
             LEFT JOIN encarregados e ON e.id_encarregado = m.id_encarregado
             LEFT JOIN pessoas pe ON pe.id_pessoa = e.id_pessoa
             LEFT JOIN users u ON u.id_user = p.registado_por
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY p.data_pagamento DESC, p.id_pagamento DESC
             LIMIT 1000`,
            params
        );

        const pagamentos = rows.map((p) => ({
            id: Number(p.id_pagamento),
            idMensalidade: Number(p.id_mensalidade),
            idAluno: p.id_aluno,
            aluno: p.aluno_nome,
            encarregado: p.encarregado_nome || null,
            mes: String(p.mes_referencia).slice(0, 7),
            valor: toMoney(p.valor),
            data: p.data_pagamento,
            metodo: p.metodo,
            referencia: p.referencia || '',
            anulado: p.anulado,
            motivoAnulacao: p.motivo_anulacao || null,
            registadoPor: p.registado_por_email || null,
        }));

        return res.json({
            pagamentos,
            total: toMoney(
                pagamentos.filter((p) => !p.anulado).reduce((s, p) => s + p.valor, 0)
            ),
        });
    } catch (error) {
        console.error('[financeiro] listarPagamentos:', error.message);
        return res.status(500).json({ message: 'Erro ao listar pagamentos.' });
    }
}

// ---------- visão geral e conta corrente ----------

/**
 * GET /api/gestor/financeiro/resumo?mes=AAAA-MM
 */
export async function obterResumoFinanceiro(req, res) {
    const mesReferencia = req.query.mes ? parseMes(req.query.mes) : `${todayISO().slice(0, 7)}-01`;
    if (!mesReferencia) return badRequest(res, 'Mês inválido (formato AAAA-MM).');

    try {
        const [mesResult, dividaResult, serieResult, atrasoResult, custoProfessores] = await Promise.all([
            db.query(
                `SELECT
                    COALESCE(SUM(valor_total) FILTER (WHERE NOT anulada), 0) AS faturado,
                    COUNT(*) FILTER (WHERE NOT anulada)::int AS mensalidades,
                    COUNT(*) FILTER (WHERE estado = 'paga')::int AS pagas,
                    (SELECT COALESCE(SUM(p.valor), 0)
                     FROM pagamentos p
                     WHERE p.anulado = false
                       AND p.data_pagamento >= $1::date
                       AND p.data_pagamento < ($1::date + INTERVAL '1 month')) AS recebido
                 FROM vw_mensalidades_estado
                 WHERE mes_referencia = $1::date`,
                [mesReferencia]
            ),
            db.query(
                `SELECT
                    COALESCE(SUM(valor_em_divida) FILTER (WHERE estado IN ('pendente', 'parcial', 'vencida')), 0) AS em_divida,
                    COALESCE(SUM(valor_em_divida) FILTER (WHERE estado = 'vencida'), 0) AS vencido,
                    COUNT(*) FILTER (WHERE estado = 'vencida')::int AS vencidas
                 FROM vw_mensalidades_estado`
            ),
            db.query(
                `WITH meses AS (
                    SELECT generate_series($1::date - INTERVAL '5 months', $1::date, INTERVAL '1 month')::date AS mes
                 )
                 SELECT
                    to_char(ms.mes, 'YYYY-MM') AS mes,
                    COALESCE((SELECT SUM(valor_total) FROM mensalidades m
                              WHERE m.mes_referencia = ms.mes AND NOT m.anulada), 0) AS faturado,
                    COALESCE((SELECT SUM(valor) FROM pagamentos p
                              WHERE NOT p.anulado
                                AND p.data_pagamento >= ms.mes
                                AND p.data_pagamento < ms.mes + INTERVAL '1 month'), 0) AS recebido
                 FROM meses ms
                 ORDER BY ms.mes`,
                [mesReferencia]
            ),
            db.query(
                `${MENSALIDADE_SELECT}
                 WHERE v.estado = 'vencida'
                 ORDER BY v.data_vencimento ASC, v.valor_em_divida DESC
                 LIMIT 8`
            ),
            calcularCustoProfessoresMes(db, mesReferencia),
        ]);

        const mes = mesResult.rows[0] || {};
        const divida = dividaResult.rows[0] || {};

        return res.json({
            mes: mesReferencia.slice(0, 7),
            faturadoMes: toMoney(mes.faturado),
            recebidoMes: toMoney(mes.recebido),
            mensalidadesMes: mes.mensalidades || 0,
            pagasMes: mes.pagas || 0,
            emDivida: toMoney(divida.em_divida),
            vencido: toMoney(divida.vencido),
            vencidas: divida.vencidas || 0,
            serie: serieResult.rows.map((r) => ({
                mes: r.mes,
                faturado: toMoney(r.faturado),
                recebido: toMoney(r.recebido),
            })),
            emAtraso: atrasoResult.rows.map(mapMensalidadeRow),
            custoProfessores,
            resultadoMes: toMoney(toMoney(mes.recebido) - custoProfessores.total),
        });
    } catch (error) {
        console.error('[financeiro] obterResumoFinanceiro:', error.message);
        return res.status(500).json({ message: 'Erro ao obter o resumo financeiro.' });
    }
}

/**
 * GET /api/gestor/financeiro/alunos/:id/conta-corrente
 */
export async function obterContaCorrenteAluno(req, res) {
    const idAluno = Number(req.params.id);

    try {
        const { rows } = await db.query(
            `${MENSALIDADE_SELECT} WHERE v.id_aluno = $1 ORDER BY v.mes_referencia DESC`,
            [idAluno]
        );
        const mensalidades = rows.map(mapMensalidadeRow);
        const ativas = mensalidades.filter((m) => m.estado !== 'anulada');

        return res.json({
            mensalidades,
            totais: {
                faturado: toMoney(ativas.reduce((s, m) => s + m.valorTotal, 0)),
                pago: toMoney(ativas.reduce((s, m) => s + m.valorPago, 0)),
                emDivida: toMoney(ativas.reduce((s, m) => s + m.valorEmDivida, 0)),
                vencido: toMoney(
                    ativas
                        .filter((m) => m.estado === 'vencida')
                        .reduce((s, m) => s + m.valorEmDivida, 0)
                ),
            },
        });
    } catch (error) {
        console.error('[financeiro] obterContaCorrenteAluno:', error.message);
        return res.status(500).json({ message: 'Erro ao obter a conta corrente.' });
    }
}
