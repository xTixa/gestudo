import { db } from '../config/db.js';

const REPORTS = {
    'agenda-gestor': {
        view: 'vw_agenda_gestor',
        orderBy: 'data_inicio DESC, hora_inicio ASC, id_servico DESC',
    },
    'catalogo-servicos': {
        view: 'vw_catalogo_servicos',
        orderBy: 'tipo_servico ASC, nome ASC',
    },
    'ocupacao-salas': {
        view: 'vw_ocupacao_salas',
        orderBy: 'total_servicos_ativos DESC, sala ASC',
    },
    matriculas: {
        view: 'vw_matriculas_estado',
        orderBy: 'estado_matricula DESC, aluno ASC',
        filters: {
            estado: 'estado_matricula',
        },
    },
    presencas: {
        view: 'vw_presencas_detalhe',
        orderBy: 'data_aula DESC, id_presenca DESC',
    },
    'faltas-por-aluno': {
        view: 'vw_faltas_por_aluno',
        orderBy: 'faltas DESC, aluno ASC',
    },
    'receita-inscricoes': {
        view: 'vw_receita_inscricoes',
        orderBy: 'mes DESC',
    },
    'reagendamentos-pedidos': {
        view: 'vw_pedidos_reagendamento_detalhe',
        orderBy: 'created_at DESC',
        filters: {
            estado: 'estado',
        },
    },
    'servicos-extracurriculares': {
        view: 'vw_servicos_extracurriculares_resumo',
        orderBy: 'data_inicio DESC, hora_inicio ASC, id_servico DESC',
    },
    utilizadores: {
        view: 'vw_utilizadores_detalhe',
        orderBy: 'nome ASC',
        filters: {
            role: 'role',
        },
    },
    'alunos-por-disciplina': {
        view: 'vw_alunos_por_disciplina',
        orderBy: 'disciplina ASC, aluno ASC',
    },
    'interesse-disciplinas': {
        view: 'vw_interesse_disciplinas',
        orderBy: 'disciplina ASC, created_at DESC',
        filters: {
            estado: 'estado',
        },
    },
};

function clampLimit(value) {
    const limit = Number(value || 100);
    if (!Number.isFinite(limit) || limit <= 0) {
        return 100;
    }
    return Math.min(Math.trunc(limit), 500);
}

function buildFilters(report, query) {
    const clauses = [];
    const values = [];

    for (const [queryKey, column] of Object.entries(report.filters || {})) {
        const raw = query?.[queryKey];
        if (raw === undefined || raw === null || raw === '') {
            continue;
        }
        values.push(String(raw).trim());
        clauses.push(`${column} = $${values.length}`);
    }

    return {
        where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
        values,
    };
}

export async function listarRelatorioGestor(req, res) {
    try {
        const reportKey = String(req.params?.relatorio || '').trim();
        const report = REPORTS[reportKey];

        if (!report) {
            return res.status(404).json({
                message: 'Relatorio nao encontrado.',
                relatoriosDisponiveis: Object.keys(REPORTS),
            });
        }

        const limit = clampLimit(req.query?.limit);
        const page = Math.max(1, Number(req.query?.page || 1));
        const offset = (page - 1) * limit;
        const filters = buildFilters(report, req.query);

        const countQuery = `
            SELECT COUNT(*)::int AS total
            FROM public.${report.view}
            ${filters.where}
        `;
        const dataQuery = `
            SELECT *
            FROM public.${report.view}
            ${filters.where}
            ORDER BY ${report.orderBy}
            LIMIT $${filters.values.length + 1}
            OFFSET $${filters.values.length + 2}
        `;

        const [countResult, dataResult] = await Promise.all([
            db.query(countQuery, filters.values),
            db.query(dataQuery, [...filters.values, limit, offset]),
        ]);

        return res.status(200).json({
            relatorio: reportKey,
            page,
            limit,
            total: Number(countResult.rows[0]?.total || 0),
            items: dataResult.rows,
        });
    } catch (error) {
        console.error('Erro ao listar relatorio:', error.message);
        return res.status(500).json({
            message: 'Erro ao listar relatorio.',
        });
    }
}

export async function obterResumoDashboardDetalhado(req, res) {
    try {
        const { rows } = await db.query(`
            SELECT *
            FROM public.fn_dashboard_resumo_detalhado()
            LIMIT 1
        `);

        return res.status(200).json({ resumo: rows[0] || null });
    } catch (error) {
        console.error(
            'Erro ao obter resumo detalhado do dashboard:',
            error.message
        );
        return res.status(500).json({
            message: 'Erro ao obter resumo detalhado do dashboard.',
        });
    }
}

export async function listarSalasDisponiveis(req, res) {
    try {
        const data = String(req.query?.data || '').trim();
        const horaInicio = String(req.query?.horaInicio || '').trim();
        const horaFim = String(req.query?.horaFim || '').trim();
        const diasSemana = req.query?.diasSemana
            ? String(req.query.diasSemana).trim()
            : null;
        const excluirIdServico = req.query?.excluirIdServico
            ? Number(req.query.excluirIdServico)
            : null;

        if (!data || !horaInicio || !horaFim) {
            return res.status(400).json({
                message: 'Data, horaInicio e horaFim sao obrigatorios.',
            });
        }

        const { rows } = await db.query(
            `
                SELECT *
                FROM public.fn_salas_disponiveis(
                    $1::date,
                    $2::time,
                    $3::time,
                    $4::text,
                    $5::bigint
                )
            `,
            [data, horaInicio, horaFim, diasSemana, excluirIdServico]
        );

        return res.status(200).json({ salas: rows });
    } catch (error) {
        console.error('Erro ao listar salas disponiveis:', error.message);
        return res.status(500).json({
            message: 'Erro ao listar salas disponiveis.',
        });
    }
}
