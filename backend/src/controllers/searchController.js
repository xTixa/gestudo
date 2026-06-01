import { db } from '../config/db.js';

async function tableExists(tableName) {
    const { rows } = await db.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = $1
         LIMIT 1`,
        [tableName]
    );
    return rows.length > 0;
}

async function getColumns(tableName) {
    const { rows } = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1`,
        [tableName]
    );
    return new Set(
        rows.map((row) => String(row.column_name || '').toLowerCase())
    );
}

function buildServiceSearchQuery(tableName, columns, tipoLabel) {
    const selectParts = ['s.id_servico AS id', `'${tipoLabel}' AS tipo`];
    const joinParts = [];
    // Condições de pesquisa — ligadas por OR entre campos textuais
    const searchConditions = [];
    const orderParts = ['s.id_servico DESC'];

    if (columns.has('created_at')) {
        orderParts.unshift('s.created_at DESC');
    }

    if (columns.has('id_disciplina')) {
        joinParts.push(
            'LEFT JOIN disciplinas d ON d.id_disciplina = s.id_disciplina'
        );
        selectParts.push("COALESCE(d.nome, 'Sem disciplina') AS nome");
        searchConditions.push("LOWER(COALESCE(d.nome, '')) LIKE LOWER($1)");
    } else {
        selectParts.push(
            `COALESCE(NULLIF(s.tipo, ''), '${tipoLabel}') AS nome`
        );
        searchConditions.push("LOWER(COALESCE(s.tipo, '')) LIKE LOWER($1)");
    }

    if (columns.has('id_modalidade')) {
        joinParts.push(
            'LEFT JOIN modalidades m ON m.id_modalidade = s.id_modalidade'
        );
        selectParts.push("COALESCE(m.nome, 'Sem modalidade') AS modalidade");
        searchConditions.push("LOWER(COALESCE(m.nome, '')) LIKE LOWER($1)");
    } else {
        selectParts.push("'Sem modalidade' AS modalidade");
    }

    if (columns.has('id_professor')) {
        joinParts.push(
            'LEFT JOIN professores pr ON pr.id_professor = s.id_professor'
        );
        joinParts.push('LEFT JOIN pessoas p ON p.id_pessoa = pr.id_pessoa');
        selectParts.push("COALESCE(p.nome, '') AS responsavel");
        searchConditions.push("LOWER(COALESCE(p.nome, '')) LIKE LOWER($1)");
    } else {
        selectParts.push("'' AS responsavel");
    }

    // Filtro de activo (AND, não faz parte da pesquisa textual)
    const activeFilter = columns.has('ativo')
        ? 'COALESCE(s.ativo, true) = true'
        : null;

    // Se não há nenhum campo de texto pesquisável, nunca devolver resultados
    if (searchConditions.length === 0) {
        return null;
    }

    const searchWhere = `(${searchConditions.join(' OR ')})`;
    const whereClause = activeFilter
        ? `WHERE ${activeFilter} AND ${searchWhere}`
        : `WHERE ${searchWhere}`;

    return `
        SELECT ${selectParts.join(', ')}
        FROM ${tableName} s
        ${joinParts.join('\n        ')}
        ${whereClause}
        ORDER BY ${orderParts.join(', ')}
        LIMIT 10
    `;
}

export async function buscarGlobal(req, res) {
    try {
        const userRole = String(req.userRole || '').toLowerCase();

        if (!req.userId || !userRole) {
            return res.status(401).json({
                success: false,
                message: 'Autenticação necessária para usar a busca.',
            });
        }

        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({
                success: true,
                data: {
                    alunos: [],
                    professores: [],
                    servicosCurriculares: [],
                    servicosExtraCurriculares: [],
                },
            });
        }

        const searchTerm = `%${q.trim()}%`;
        const canSeePeople = userRole === 'gestor';
        const canSeeServices =
            userRole === 'gestor' ||
            userRole === 'professor' ||
            userRole === 'aluno';

        const alunosQuery = `
            SELECT a.id_aluno AS id, p.nome, 'aluno' AS tipo
            FROM alunos a
            LEFT JOIN pessoas p ON p.id_pessoa = a.id_pessoa
            WHERE LOWER(COALESCE(p.nome, '')) LIKE LOWER($1)
            LIMIT 10
        `;

        const professoresQuery = `
            SELECT p.id_professor AS id, pe.nome, 'professor' AS tipo
            FROM professores p
            LEFT JOIN pessoas pe ON pe.id_pessoa = p.id_pessoa
            WHERE LOWER(COALESCE(pe.nome, '')) LIKE LOWER($1)
            LIMIT 10
        `;

        const [hasCurriculares, hasExtra, curricularesCols, extraCols] =
            await Promise.all([
                tableExists('servicos_curriculares'),
                tableExists('servicos_extracurriculares'),
                tableExists('servicos_curriculares')
                    ? getColumns('servicos_curriculares')
                    : Promise.resolve(new Set()),
                tableExists('servicos_extracurriculares')
                    ? getColumns('servicos_extracurriculares')
                    : Promise.resolve(new Set()),
            ]);

        const curricularesQuery = hasCurriculares
            ? buildServiceSearchQuery(
                  'servicos_curriculares',
                  curricularesCols,
                  'servico_curricular'
              )
            : null;

        const extraQuery = hasExtra
            ? buildServiceSearchQuery(
                  'servicos_extracurriculares',
                  extraCols,
                  'servico_extra'
              )
            : null;

        const [
            alunosRes,
            professoresRes,
            servicosCurricularesRes,
            servicosExtraRes,
        ] = await Promise.all([
            canSeePeople
                ? db.query(alunosQuery, [searchTerm])
                : Promise.resolve({ rows: [] }),
            canSeePeople
                ? db.query(professoresQuery, [searchTerm])
                : Promise.resolve({ rows: [] }),
            canSeeServices && curricularesQuery
                ? db.query(curricularesQuery, [searchTerm])
                : Promise.resolve({ rows: [] }),
            canSeeServices && extraQuery
                ? db.query(extraQuery, [searchTerm])
                : Promise.resolve({ rows: [] }),
        ]);

        return res.json({
            success: true,
            data: {
                alunos: alunosRes.rows,
                professores: professoresRes.rows,
                servicosCurriculares: servicosCurricularesRes.rows,
                servicosExtraCurriculares: servicosExtraRes.rows,
            },
        });
    } catch (err) {
        console.error('[buscaController] Erro ao procurar:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erro ao procurar',
        });
    }
}
