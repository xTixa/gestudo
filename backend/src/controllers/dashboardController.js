import { db } from '../config/db.js';

const WEEK_DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
];

/**
 * ========================================
 * DASHBOARD CONTROLLER
 * ========================================
 * Responsável por fornecer dados de resumo para o dashboard do sistema.
 * Calcula estatísticas gerais sobre alunos, professores e serviços ativos.
 * ========================================
 */

/**
 * Obtém lista de colunas de uma tabela no schema public
 * Utilitário para verificar dinamicamente a estrutura de tabelas
 *
 * @param {string} tableName - Nome da tabela
 * @returns {Set} Set com nomes das colunas da tabela
 */
async function getColumns(tableName) {
    const { rows } = await db.query(
        `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
        [tableName]
    );

    return new Set(rows.map((row) => row.column_name));
}

/**
 * Verifica se uma tabela existe no schema public da base de dados
 *
 * @param {string} tableName - Nome da tabela a verificar
 * @returns {boolean} True se a tabela existe, false caso contrário
 */
async function tableExists(tableName) {
    const { rows } = await db.query(
        `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
        [tableName]
    );

    return rows.length > 0;
}

/**
 * Obtém resumo estatístico do dashboard com contagens gerais
 * Verifica disponibilidade de tabelas e adapta queries conforme a estrutura de dados
 * Conta alunos e serviços com status 'ativo' (suporta várias variações de nomes de coluna)
 *
 * @param {Object} req - Objecto de requisição
 * @param {Object} res - Objecto de resposta
 * @returns {JSON} Objecto com alunosAtivos, professores total e servicosAtivos
 */
export async function obterResumoDashboard(req, res) {
    try {
        try {
            const { rows } = await db.query(`
                SELECT *
                FROM public.fn_dashboard_resumo_detalhado()
                LIMIT 1
            `);
            const resumo = rows[0] || {};

            return res.status(200).json({
                alunosAtivos: Number(resumo.alunos_ativos || 0),
                professores: Number(resumo.professores_ativos || 0),
                servicosCurriculares: Number(
                    resumo.servicos_curriculares_ativos || 0
                ),
                servicosExtra: Number(
                    resumo.servicos_extracurriculares_ativos || 0
                ),
                inscricoesAtivas: Number(resumo.inscricoes_ativas || 0),
                faltasPorResolver: Number(resumo.faltas_por_resolver || 0),
                matriculasExpiradas: Number(
                    resumo.alunos_matricula_expirada || 0
                ),
                reagendamentosPendentes: Number(
                    resumo.pedidos_reagendamento_pendentes || 0
                ),
                inscricoesPublicasPendentes: Number(
                    resumo.inscricoes_publicas_pendentes || 0
                ),
            });
        } catch (dbFunctionError) {
            console.warn(
                '[dashboardController] fallback resumo dashboard:',
                dbFunctionError.message
            );
        }

        const [
            hasUsers,
            hasAlunos,
            hasProfessores,
            hasServicosCurriculares,
            hasServicosExtra,
        ] = await Promise.all([
            tableExists('users'),
            tableExists('alunos'),
            tableExists('professores'),
            tableExists('servicos_curriculares'),
            tableExists('servicos_extracurriculares'),
        ]);

        const [
            usersCols,
            alunosCols,
            servicosCurricularesCols,
            servicosExtraCols,
        ] = await Promise.all([
            hasUsers ? getColumns('users') : new Set(),
            hasAlunos ? getColumns('alunos') : new Set(),
            hasServicosCurriculares
                ? getColumns('servicos_curriculares')
                : new Set(),
            hasServicosExtra
                ? getColumns('servicos_extracurriculares')
                : new Set(),
        ]);

        const alunosQuery = !hasAlunos
            ? `SELECT 0::int AS total`
            : usersCols.has('status') && alunosCols.has('id_user') && hasUsers
              ? `
        SELECT COUNT(*)::int AS total
        FROM alunos a
        INNER JOIN users u ON u.id_user = a.id_user
        WHERE LOWER(COALESCE(u.status::text, '')) IN ('ativo', 'active', 'true', 't', '1')
      `
              : `SELECT COUNT(*)::int AS total FROM alunos`;

        // Build curricular services count query
        let servicosCurricularesQuery = hasServicosCurriculares
            ? `SELECT COUNT(*)::int AS total FROM servicos_curriculares`
            : `SELECT 0::int AS total`;
        if (hasServicosCurriculares && servicosCurricularesCols.has('ativo')) {
            servicosCurricularesQuery = `
        SELECT COUNT(*)::int AS total
        FROM servicos_curriculares
        WHERE COALESCE(NULLIF(TRIM(LOWER(ativo::text)), ''), 'true') IN ('true', 't', '1', 'ativo', 'active', 'sim')
      `;
        } else if (
            hasServicosCurriculares &&
            servicosCurricularesCols.has('status')
        ) {
            servicosCurricularesQuery = `SELECT COUNT(*)::int AS total FROM servicos_curriculares WHERE LOWER(COALESCE(status, '')) IN ('ativo', 'active')`;
        } else if (
            hasServicosCurriculares &&
            servicosCurricularesCols.has('estado')
        ) {
            servicosCurricularesQuery = `SELECT COUNT(*)::int AS total FROM servicos_curriculares WHERE LOWER(COALESCE(estado, '')) IN ('ativo', 'active')`;
        }

        // Build extra-curricular services count query
        let servicosExtraQuery = hasServicosExtra
            ? `SELECT COUNT(*)::int AS total FROM servicos_extracurriculares`
            : `SELECT 0::int AS total`;
        if (hasServicosExtra && servicosExtraCols.has('ativo')) {
            servicosExtraQuery = `
        SELECT COUNT(*)::int AS total
        FROM servicos_extracurriculares
        WHERE COALESCE(NULLIF(TRIM(LOWER(ativo::text)), ''), 'true') IN ('true', 't', '1', 'ativo', 'active', 'sim')
      `;
        } else if (hasServicosExtra && servicosExtraCols.has('status')) {
            servicosExtraQuery = `SELECT COUNT(*)::int AS total FROM servicos_extracurriculares WHERE LOWER(COALESCE(status, '')) IN ('ativo', 'active')`;
        } else if (hasServicosExtra && servicosExtraCols.has('estado')) {
            servicosExtraQuery = `SELECT COUNT(*)::int AS total FROM servicos_extracurriculares WHERE LOWER(COALESCE(estado, '')) IN ('ativo', 'active')`;
        }

        const [
            alunosResult,
            professoresResult,
            servicosCurricularesResult,
            servicosExtraResult,
        ] = await Promise.all([
            db.query(alunosQuery),
            db.query(
                hasProfessores
                    ? `SELECT COUNT(*)::int AS total FROM professores`
                    : `SELECT 0::int AS total`
            ),
            db.query(servicosCurricularesQuery),
            db.query(servicosExtraQuery),
        ]);

        return res.status(200).json({
            alunosAtivos: alunosResult.rows[0]?.total || 0,
            professores: professoresResult.rows[0]?.total || 0,
            servicosCurriculares:
                servicosCurricularesResult.rows[0]?.total || 0,
            servicosExtra: servicosExtraResult.rows[0]?.total || 0,
        });
    } catch (error) {
        console.error('Erro ao obter resumo do dashboard:', error.message);
        return res
            .status(500)
            .json({ message: 'Erro ao obter resumo do dashboard.' });
    }
}

function toIsoDate(dateValue) {
    return new Date(dateValue).toISOString().slice(0, 10);
}

function parseDbCount(value) {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
}

function buildActiveServiceOverlapCondition(
    alias,
    startParamIndex,
    endParamIndex
) {
    return `COALESCE(${alias}.ativo, true) = true
            AND ${alias}.data_inicio <= $${endParamIndex}::date
            AND COALESCE(${alias}.data_fim, ${alias}.data_inicio) >= $${startParamIndex}::date`;
}

async function resolveInscricoesServicoCurricularColumn() {
    const { rows } = await db.query(
        `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inscricoes'
    `
    );

    const columns = new Set(
        rows.map((row) => String(row.column_name || '').toLowerCase())
    );
    const candidates = [
        'id_servico_curricular',
        'id_servico',
        'id_servicocurricular',
        'servico_id',
        'id_servicos',
    ];

    for (const candidate of candidates) {
        if (columns.has(candidate)) {
            return candidate;
        }
    }

    return null;
}

export async function obterGraficosDashboard(req, res) {
    try {
        const hasServicosCurriculares = await tableExists(
            'servicos_curriculares'
        );
        if (!hasServicosCurriculares) {
            return res.status(200).json({
                semanal: [],
                mensal: [],
            });
        }

        const hasInscricoes = await tableExists('inscricoes');
        const hasServicosExtra = await tableExists(
            'servicos_extracurriculares'
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startWeek = new Date(today);
        startWeek.setDate(today.getDate() - 6);

        const weekStartIso = toIsoDate(startWeek);
        const weekEndIso = toIsoDate(today);

        const inscricoesServicoCurricularColumn = hasInscricoes
            ? await resolveInscricoesServicoCurricularColumn()
            : null;

        const [weeklySessionsResult, weeklyAlunosResult] = await Promise.all([
            db.query(
                `
                    SELECT d::date AS dia, COUNT(s.id_servico)::int AS sessoes
                    FROM generate_series($1::date, $2::date, interval '1 day') AS d
                    LEFT JOIN servicos_curriculares s
                        ON ${buildActiveServiceOverlapCondition('s', 1, 2)}
                    GROUP BY d::date
                    ORDER BY d::date
        `,
                [weekStartIso, weekEndIso]
            ),
            hasInscricoes && inscricoesServicoCurricularColumn
                ? db.query(
                      `
                            SELECT d::date AS dia, COUNT(i.id_inscricao)::int AS alunos
                            FROM generate_series($1::date, $2::date, interval '1 day') AS d
                            LEFT JOIN servicos_curriculares s
                                ON ${buildActiveServiceOverlapCondition('s', 1, 2)}
                            LEFT JOIN inscricoes i
                                ON i.${inscricoesServicoCurricularColumn} = s.id_servico
                             AND LOWER(COALESCE(i.estado, '')) = 'ativa'
                            GROUP BY d::date
                            ORDER BY d::date
            `,
                      [weekStartIso, weekEndIso]
                  )
                : Promise.resolve({ rows: [] }),
        ]);

        const sessionsByDay = new Map(
            weeklySessionsResult.rows.map((row) => [
                toIsoDate(row.dia),
                parseDbCount(row.sessoes),
            ])
        );
        const alunosByDay = new Map(
            weeklyAlunosResult.rows.map((row) => [
                toIsoDate(row.dia),
                parseDbCount(row.alunos),
            ])
        );

        const semanal = [];
        for (let i = 0; i < 7; i += 1) {
            const day = new Date(startWeek);
            day.setDate(startWeek.getDate() + i);
            const iso = toIsoDate(day);

            semanal.push({
                dia: WEEK_DAY_LABELS[day.getDay()],
                alunos: alunosByDay.get(iso) || 0,
                sessoes: sessionsByDay.get(iso) || 0,
            });
        }

        const startMonth = new Date(
            today.getFullYear(),
            today.getMonth() - 5,
            1
        );
        const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const [curricularesResult, extraResult] = await Promise.all([
            db.query(
                `
                    SELECT date_trunc('month', m)::date AS mes, COUNT(s.id_servico)::int AS total
                    FROM generate_series($1::date, ($2::date - interval '1 day')::date, interval '1 month') AS m
                    LEFT JOIN servicos_curriculares s
                        ON ${buildActiveServiceOverlapCondition('s', 1, 2)}
                    GROUP BY date_trunc('month', m)::date
                    ORDER BY date_trunc('month', m)::date
        `,
                [toIsoDate(startMonth), toIsoDate(endMonth)]
            ),
            hasServicosExtra
                ? db.query(
                      `
                            SELECT date_trunc('month', m)::date AS mes, COUNT(s.id_servico)::int AS total
                            FROM generate_series($1::date, ($2::date - interval '1 day')::date, interval '1 month') AS m
                            LEFT JOIN servicos_extracurriculares s
                                ON ${buildActiveServiceOverlapCondition('s', 1, 2)}
                            GROUP BY date_trunc('month', m)::date
                            ORDER BY date_trunc('month', m)::date
            `,
                      [toIsoDate(startMonth), toIsoDate(endMonth)]
                  )
                : Promise.resolve({ rows: [] }),
        ]);

        const curricularesByMonth = new Map(
            curricularesResult.rows.map((row) => [
                toIsoDate(row.mes),
                parseDbCount(row.total),
            ])
        );
        const extraByMonth = new Map(
            extraResult.rows.map((row) => [
                toIsoDate(row.mes),
                parseDbCount(row.total),
            ])
        );

        const mensal = [];
        for (let i = 0; i < 6; i += 1) {
            const monthDate = new Date(
                startMonth.getFullYear(),
                startMonth.getMonth() + i,
                1
            );
            const monthIso = toIsoDate(monthDate);

            mensal.push({
                mes: MONTH_LABELS[monthDate.getMonth()],
                curriculares: curricularesByMonth.get(monthIso) || 0,
                extra: extraByMonth.get(monthIso) || 0,
            });
        }

        return res.status(200).json({ semanal, mensal });
    } catch (error) {
        console.error('Erro ao obter gráficos do dashboard:', error.message);
        return res.status(500).json({
            message: 'Erro ao obter dados dos gráficos do dashboard.',
        });
    }
}
