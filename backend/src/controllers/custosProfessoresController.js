import { db } from '../config/db.js';
import {
    METODOS_PAGAMENTO,
    isISODate,
    parseMes,
    toMoney,
    todayISO,
} from '../services/financeUtils.js';

/**
 * ========================================
 * CUSTOS COM PROFESSORES
 * ========================================
 * Valor por hora por modalidade (geral ou específico do professor) e fecho
 * mensal das sessões dadas.
 *
 * Uma sessão = um serviço curricular num dia em que o professor marcou
 * presenças (presencas é única por serviço+aluno+dia). A duração vem do
 * horário do serviço.
 * ========================================
 */

const WEEKDAY_KEYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function normalizeWeekday(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/-?feira/, '')
        .trim();
}

function timeToMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function diffMinutes(start, end) {
    const a = timeToMinutes(start);
    const b = timeToMinutes(end);
    return a !== null && b !== null && b > a ? b - a : null;
}

/**
 * Duração (minutos) de uma sessão, a partir do horário do serviço:
 * procura a entrada de dias_semana desse dia da semana e hora; senão usa
 * hora_inicio/hora_fim do serviço; em último caso 60 minutos.
 */
function minutosSessao(row) {
    const [y, m, d] = String(row.data_aula).split('-').map(Number);
    const weekday = WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()];
    const hora = String(row.hora_aula || '').slice(0, 5);

    let entries = [];
    try {
        const parsed = JSON.parse(row.dias_semana || '[]');
        entries = Array.isArray(parsed) ? parsed.filter((e) => e && typeof e === 'object') : [];
    } catch {
        entries = [];
    }

    const sameDay = entries.filter((e) => normalizeWeekday(e.dia) === weekday);
    const entry =
        sameDay.find((e) => String(e.horaInicio || '').slice(0, 5) === hora) ||
        sameDay[0] ||
        entries.find((e) => String(e.horaInicio || '').slice(0, 5) === hora) ||
        null;

    if (entry) {
        const fromEntry = Number(entry.duracao) || diffMinutes(entry.horaInicio, entry.horaFim);
        if (fromEntry > 0) return { minutos: fromEntry, horaInicio: String(entry.horaInicio || hora).slice(0, 5) };
    }

    const fromService = diffMinutes(row.hora_inicio, row.hora_fim);
    return {
        minutos: fromService || 60,
        horaInicio: hora || String(row.hora_inicio || '').slice(0, 5) || null,
    };
}

async function carregarTarifas(executor) {
    const { rows } = await executor.query(
        `SELECT id_professor, id_modalidade, valor_hora FROM tarifas_professores`
    );
    const map = new Map();
    rows.forEach((r) => map.set(`${r.id_professor || 0}:${r.id_modalidade}`, toMoney(r.valor_hora)));
    return map;
}

function resolverTarifa(tarifas, idProfessor, idModalidade) {
    if (!idModalidade) return null;
    const especifica = tarifas.get(`${idProfessor}:${idModalidade}`);
    if (especifica !== undefined) return { valor: especifica, origem: 'professor' };
    const geral = tarifas.get(`0:${idModalidade}`);
    if (geral !== undefined) return { valor: geral, origem: 'geral' };
    return null;
}

/**
 * Calcula as sessões dadas no mês por professor (a partir das presenças) e
 * o valor a pagar com as tarifas atuais.
 */
async function calcularMes(executor, mesReferencia, idProfessor = null) {
    const params = [mesReferencia];
    const filtroProfessor = idProfessor ? `AND s.id_professor = $2` : '';
    if (idProfessor) params.push(idProfessor);

    const [{ rows }, tarifas] = await Promise.all([
        executor.query(
            `
            SELECT
                p.id_servico,
                p.data_aula,
                MIN(p.hora_aula) AS hora_aula,
                COUNT(*)::int AS alunos,
                s.id_professor,
                s.id_modalidade,
                s.hora_inicio,
                s.hora_fim,
                s.dias_semana,
                m.nome AS modalidade,
                d.nome AS disciplina,
                n.nome AS nivel
            FROM presencas p
            INNER JOIN servicos_curriculares s ON s.id_servico = p.id_servico
            LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade
            LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN niveis_ensino n ON n.id_nivel = d.id_nivel
            WHERE p.data_aula >= $1::date
              AND p.data_aula < ($1::date + INTERVAL '1 month')
              AND s.id_professor IS NOT NULL
              ${filtroProfessor}
            GROUP BY p.id_servico, p.data_aula, s.id_professor, s.id_modalidade,
                     s.hora_inicio, s.hora_fim, s.dias_semana, m.nome, d.nome, n.nome
            ORDER BY p.data_aula, MIN(p.hora_aula)
            `,
            params
        ),
        carregarTarifas(executor),
    ]);

    const porProfessor = new Map();

    for (const row of rows) {
        const { minutos, horaInicio } = minutosSessao(row);
        const tarifa = resolverTarifa(tarifas, row.id_professor, row.id_modalidade);
        const valorHora = tarifa ? tarifa.valor : null;

        if (!porProfessor.has(row.id_professor)) {
            porProfessor.set(row.id_professor, { linhas: [], semTarifa: new Set() });
        }
        const entrada = porProfessor.get(row.id_professor);

        if (!tarifa) entrada.semTarifa.add(row.modalidade || 'Sem modalidade');

        entrada.linhas.push({
            idServico: row.id_servico,
            data: row.data_aula,
            horaInicio,
            minutos,
            alunos: row.alunos,
            descricao: [row.disciplina || 'Serviço', row.nivel].filter(Boolean).join(' · '),
            modalidade: row.modalidade || null,
            idModalidade: row.id_modalidade,
            valorHora,
            valor: valorHora === null ? null : toMoney((minutos / 60) * valorHora),
        });
    }

    return porProfessor;
}

function resumirLinhas(linhas) {
    return {
        sessoes: linhas.length,
        minutos: linhas.reduce((s, l) => s + l.minutos, 0),
        valor: toMoney(linhas.reduce((s, l) => s + (l.valor || 0), 0)),
    };
}

function mapFecho(row) {
    if (!row) return null;
    return {
        id: Number(row.id_pagamento_professor),
        sessoes: row.sessoes,
        minutos: row.minutos,
        valor: toMoney(row.valor_total),
        pago: row.pago,
        dataPagamento: row.data_pagamento || null,
        metodo: row.metodo || null,
        referencia: row.referencia || '',
        observacoes: row.observacoes || '',
        estado: row.pago ? 'pago' : 'por_pagar',
    };
}

// ---------- tarifas ----------

/**
 * GET /api/gestor/financeiro/professores/tarifas
 */
export async function listarTarifas(req, res) {
    try {
        const [tarifas, modalidades, professores] = await Promise.all([
            db.query(
                `SELECT t.id_tarifa, t.id_professor, t.id_modalidade, t.valor_hora, pp.nome AS professor
                 FROM tarifas_professores t
                 LEFT JOIN professores pr ON pr.id_professor = t.id_professor
                 LEFT JOIN pessoas pp ON pp.id_pessoa = pr.id_pessoa
                 ORDER BY t.id_professor NULLS FIRST, t.id_modalidade`
            ),
            db.query(`SELECT id_modalidade, nome FROM modalidades WHERE COALESCE(ativa, true) = true ORDER BY nome`),
            db.query(
                `SELECT pr.id_professor, p.nome
                 FROM professores pr
                 INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
                 INNER JOIN users u ON u.id_user = pr.id_user
                 WHERE u.status = true
                 ORDER BY p.nome`
            ),
        ]);

        return res.json({
            tarifas: tarifas.rows.map((t) => ({
                id: Number(t.id_tarifa),
                idProfessor: t.id_professor,
                professor: t.professor || null,
                idModalidade: t.id_modalidade,
                valorHora: toMoney(t.valor_hora),
            })),
            modalidades: modalidades.rows.map((m) => ({ id: m.id_modalidade, nome: m.nome })),
            professores: professores.rows.map((p) => ({ id: p.id_professor, nome: p.nome })),
        });
    } catch (error) {
        console.error('[custosProfessores] listarTarifas:', error.message);
        return res.status(500).json({ message: 'Erro ao carregar os valores por hora.' });
    }
}

/**
 * PATCH /api/gestor/financeiro/professores/tarifas
 * Body: { id_professor: number|null, id_modalidade, valor_hora: number|null }
 * valor_hora null remove a tarifa (volta a usar a geral).
 */
export async function guardarTarifa(req, res) {
    const idProfessor =
        req.body?.id_professor === null || req.body?.id_professor === undefined || req.body?.id_professor === ''
            ? null
            : Number(req.body.id_professor);
    const idModalidade = Number(req.body?.id_modalidade);
    const valorRaw = req.body?.valor_hora;

    if (idProfessor !== null && !Number.isInteger(idProfessor)) {
        return res.status(400).json({ message: 'Professor inválido.' });
    }
    if (!Number.isInteger(idModalidade)) {
        return res.status(400).json({ message: 'Modalidade inválida.' });
    }

    try {
        if (valorRaw === null || valorRaw === '') {
            await db.query(
                `DELETE FROM tarifas_professores
                 WHERE COALESCE(id_professor, 0) = COALESCE($1::int, 0) AND id_modalidade = $2`,
                [idProfessor, idModalidade]
            );
            return res.json({ message: 'Valor removido.' });
        }

        const valor = Number(valorRaw);
        if (!Number.isFinite(valor) || valor < 0 || valor > 1000) {
            return res.status(400).json({ message: 'Valor por hora inválido.' });
        }

        await db.query(
            `INSERT INTO tarifas_professores (id_professor, id_modalidade, valor_hora)
             VALUES ($1, $2, $3)
             ON CONFLICT (COALESCE(id_professor, 0), id_modalidade)
             DO UPDATE SET valor_hora = EXCLUDED.valor_hora`,
            [idProfessor, idModalidade, toMoney(valor)]
        );
        return res.json({ message: 'Valor guardado.' });
    } catch (error) {
        console.error('[custosProfessores] guardarTarifa:', error.message);
        return res.status(500).json({ message: 'Erro ao guardar o valor por hora.' });
    }
}

// ---------- mês ----------

/**
 * GET /api/gestor/financeiro/professores?mes=AAAA-MM
 * Um registo por professor ativo ou com sessões/fecho no mês: se o mês já
 * foi fechado mostra os valores gravados, senão o cálculo atual.
 */
export async function listarCustosProfessores(req, res) {
    const mesReferencia = parseMes(req.query.mes);
    if (!mesReferencia) return res.status(400).json({ message: 'Mês inválido (formato AAAA-MM).' });

    try {
        const [calculado, fechos, professores] = await Promise.all([
            calcularMes(db, mesReferencia),
            db.query(
                `SELECT * FROM pagamentos_professores
                 WHERE mes_referencia = $1 AND anulado = false`,
                [mesReferencia]
            ),
            db.query(
                `SELECT pr.id_professor, p.nome, u.status
                 FROM professores pr
                 INNER JOIN pessoas p ON p.id_pessoa = pr.id_pessoa
                 INNER JOIN users u ON u.id_user = pr.id_user
                 ORDER BY p.nome`
            ),
        ]);

        const fechoPorProfessor = new Map(fechos.rows.map((f) => [f.id_professor, f]));

        const lista = professores.rows
            .filter(
                (p) => p.status || calculado.has(p.id_professor) || fechoPorProfessor.has(p.id_professor)
            )
            .map((p) => {
                const calc = calculado.get(p.id_professor) || { linhas: [], semTarifa: new Set() };
                const fecho = mapFecho(fechoPorProfessor.get(p.id_professor));
                const atual = resumirLinhas(calc.linhas);

                return {
                    idProfessor: p.id_professor,
                    professor: p.nome,
                    estado: fecho ? fecho.estado : calc.linhas.length ? 'em_aberto' : 'sem_sessoes',
                    sessoes: fecho ? fecho.sessoes : atual.sessoes,
                    minutos: fecho ? fecho.minutos : atual.minutos,
                    valor: fecho ? fecho.valor : atual.valor,
                    semTarifa: fecho ? [] : [...calc.semTarifa],
                    fecho,
                };
            });

        const ativos = lista.filter((l) => l.estado !== 'sem_sessoes');

        return res.json({
            mes: mesReferencia.slice(0, 7),
            professores: lista,
            totais: {
                valor: toMoney(ativos.reduce((s, l) => s + l.valor, 0)),
                pago: toMoney(lista.filter((l) => l.estado === 'pago').reduce((s, l) => s + l.valor, 0)),
                porPagar: toMoney(lista.filter((l) => l.estado === 'por_pagar').reduce((s, l) => s + l.valor, 0)),
                emAberto: toMoney(lista.filter((l) => l.estado === 'em_aberto').reduce((s, l) => s + l.valor, 0)),
                minutos: ativos.reduce((s, l) => s + l.minutos, 0),
            },
        });
    } catch (error) {
        console.error('[custosProfessores] listarCustosProfessores:', error.message);
        return res.status(500).json({ message: 'Erro ao calcular os custos com professores.' });
    }
}

/**
 * GET /api/gestor/financeiro/professores/:id?mes=AAAA-MM
 * Detalhe das sessões (gravadas se o mês estiver fechado).
 */
export async function obterDetalheProfessor(req, res) {
    const idProfessor = Number(req.params.id);
    const mesReferencia = parseMes(req.query.mes);
    if (!mesReferencia) return res.status(400).json({ message: 'Mês inválido (formato AAAA-MM).' });

    try {
        const nome = await db.query(
            `SELECT p.nome FROM professores pr JOIN pessoas p ON p.id_pessoa = pr.id_pessoa WHERE pr.id_professor = $1`,
            [idProfessor]
        );
        if (!nome.rows.length) return res.status(404).json({ message: 'Professor não encontrado.' });

        const fechoResult = await db.query(
            `SELECT * FROM pagamentos_professores
             WHERE id_professor = $1 AND mes_referencia = $2 AND anulado = false`,
            [idProfessor, mesReferencia]
        );
        const fecho = mapFecho(fechoResult.rows[0]);

        let linhas;
        let semTarifa = [];
        if (fecho) {
            const { rows } = await db.query(
                `SELECT * FROM pagamento_professor_linhas
                 WHERE id_pagamento_professor = $1
                 ORDER BY data_aula, hora_inicio`,
                [fecho.id]
            );
            linhas = rows.map((l) => ({
                idServico: l.id_servico,
                data: l.data_aula,
                horaInicio: l.hora_inicio,
                minutos: l.minutos,
                descricao: l.descricao,
                modalidade: l.modalidade,
                valorHora: toMoney(l.valor_hora),
                valor: toMoney(l.valor),
            }));
        } else {
            const calc = (await calcularMes(db, mesReferencia, idProfessor)).get(idProfessor);
            linhas = calc?.linhas || [];
            semTarifa = calc ? [...calc.semTarifa] : [];
        }

        return res.json({
            idProfessor,
            professor: nome.rows[0].nome,
            mes: mesReferencia.slice(0, 7),
            fecho,
            linhas,
            semTarifa,
            totais: resumirLinhas(linhas),
        });
    } catch (error) {
        console.error('[custosProfessores] obterDetalheProfessor:', error.message);
        return res.status(500).json({ message: 'Erro ao obter o detalhe do professor.' });
    }
}

/**
 * POST /api/gestor/financeiro/professores/fechar
 * Body: { mes, ids_professores?: number[] }
 * Grava o fecho do mês para cada professor com sessões. Professores com
 * sessões sem valor/hora definido não são fechados (vêm em "ignorados").
 */
export async function fecharMes(req, res) {
    const mesReferencia = parseMes(req.body?.mes);
    if (!mesReferencia) return res.status(400).json({ message: 'Mês inválido (formato AAAA-MM).' });

    const ids = Array.isArray(req.body?.ids_professores)
        ? req.body.ids_professores.map(Number).filter(Number.isInteger)
        : null;

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const calculado = await calcularMes(client, mesReferencia);

        const fechados = [];
        const ignorados = [];

        for (const [idProfessor, calc] of calculado.entries()) {
            if (ids && !ids.includes(idProfessor)) continue;
            if (!calc.linhas.length) continue;

            if (calc.semTarifa.size > 0) {
                ignorados.push({ idProfessor, motivo: `Sem valor/hora para: ${[...calc.semTarifa].join(', ')}` });
                continue;
            }

            const totais = resumirLinhas(calc.linhas);
            const inserted = await client.query(
                `INSERT INTO pagamentos_professores
                    (id_professor, mes_referencia, sessoes, minutos, valor_total, fechado_por)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id_professor, mes_referencia) WHERE anulado = false DO NOTHING
                 RETURNING id_pagamento_professor`,
                [idProfessor, mesReferencia, totais.sessoes, totais.minutos, totais.valor, req.userId ?? null]
            );

            const id = inserted.rows[0]?.id_pagamento_professor;
            if (!id) continue; // já estava fechado

            for (const linha of calc.linhas) {
                await client.query(
                    `INSERT INTO pagamento_professor_linhas
                        (id_pagamento_professor, id_servico, data_aula, hora_inicio, minutos, descricao, modalidade, valor_hora, valor)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [id, linha.idServico, linha.data, linha.horaInicio, linha.minutos, linha.descricao, linha.modalidade, linha.valorHora, linha.valor]
                );
            }
            fechados.push(idProfessor);
        }

        await client.query('COMMIT');

        return res.status(201).json({
            message: fechados.length
                ? `Mês fechado para ${fechados.length} professor${fechados.length === 1 ? '' : 'es'}.`
                : 'Não havia nada novo para fechar.',
            fechados,
            ignorados,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[custosProfessores] fecharMes:', error.message);
        return res.status(500).json({ message: 'Erro ao fechar o mês.' });
    } finally {
        client.release();
    }
}

/**
 * POST /api/gestor/financeiro/professores/pagamentos/:id/pagar
 * Body: { data_pagamento, metodo, referencia?, observacoes? }
 */
export async function marcarPagoProfessor(req, res) {
    const id = Number(req.params.id);
    const dataPagamento = String(req.body?.data_pagamento || '').trim();
    const metodo = String(req.body?.metodo || '').trim().toLowerCase();

    if (!isISODate(dataPagamento)) return res.status(400).json({ message: 'Data de pagamento inválida.' });
    if (dataPagamento > todayISO()) return res.status(400).json({ message: 'A data de pagamento não pode ser no futuro.' });
    if (!METODOS_PAGAMENTO.has(metodo)) return res.status(400).json({ message: 'Método de pagamento inválido.' });

    try {
        const { rows } = await db.query(
            `UPDATE pagamentos_professores
             SET pago = true, data_pagamento = $1, metodo = $2, referencia = $3, observacoes = $4
             WHERE id_pagamento_professor = $5 AND anulado = false AND pago = false
             RETURNING *`,
            [
                dataPagamento,
                metodo,
                String(req.body?.referencia || '').trim() || null,
                String(req.body?.observacoes || '').trim() || null,
                id,
            ]
        );
        if (!rows.length) {
            return res.status(409).json({ message: 'Fecho não encontrado, anulado ou já pago.' });
        }
        return res.json({ message: 'Pagamento ao professor registado.', fecho: mapFecho(rows[0]) });
    } catch (error) {
        console.error('[custosProfessores] marcarPagoProfessor:', error.message);
        return res.status(500).json({ message: 'Erro ao registar o pagamento.' });
    }
}

/**
 * POST /api/gestor/financeiro/professores/pagamentos/:id/anular
 * Body: { motivo }
 * Reabre o mês do professor (pode voltar a ser fechado com os valores atuais).
 */
export async function anularFechoProfessor(req, res) {
    const id = Number(req.params.id);
    const motivo = String(req.body?.motivo || '').trim();
    if (!motivo) return res.status(400).json({ message: 'Indique o motivo da anulação.' });

    try {
        const { rows } = await db.query(
            `UPDATE pagamentos_professores
             SET anulado = true, motivo_anulacao = $1
             WHERE id_pagamento_professor = $2 AND anulado = false
             RETURNING id_pagamento_professor`,
            [motivo, id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Fecho não encontrado ou já anulado.' });
        return res.json({ message: 'Fecho anulado. O mês deste professor voltou a ficar em aberto.' });
    } catch (error) {
        console.error('[custosProfessores] anularFechoProfessor:', error.message);
        return res.status(500).json({ message: 'Erro ao anular o fecho.' });
    }
}

/**
 * Custo com professores de um mês (fechado + em aberto estimado), usado no
 * resumo financeiro.
 */
export async function calcularCustoProfessoresMes(executor, mesReferencia) {
    const [calculado, fechos] = await Promise.all([
        calcularMes(executor, mesReferencia),
        executor.query(
            `SELECT id_professor, valor_total, pago FROM pagamentos_professores
             WHERE mes_referencia = $1 AND anulado = false`,
            [mesReferencia]
        ),
    ]);

    const fechados = new Map(fechos.rows.map((f) => [f.id_professor, f]));
    let fechado = 0;
    let pago = 0;
    let emAberto = 0;

    fechos.rows.forEach((f) => {
        fechado += Number(f.valor_total);
        if (f.pago) pago += Number(f.valor_total);
    });
    for (const [idProfessor, calc] of calculado.entries()) {
        if (!fechados.has(idProfessor)) emAberto += resumirLinhas(calc.linhas).valor;
    }

    return {
        total: toMoney(fechado + emAberto),
        pago: toMoney(pago),
        emAberto: toMoney(emAberto),
    };
}
