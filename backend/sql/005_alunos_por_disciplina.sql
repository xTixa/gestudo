-- Views de relatorio: alunos matriculados por disciplina (servicos reais) e
-- interesse/candidatos por disciplina (a partir das inscricoes publicas, antes
-- de serem colocados numa turma). Kept idempotent because startup migrations
-- run on every boot.

CREATE OR REPLACE VIEW public.vw_alunos_por_disciplina AS
SELECT
    d.nome AS disciplina,
    sc.id_servico,
    m.nome AS modalidade,
    profp.nome AS professor,
    al.id_aluno,
    ap.nome AS aluno,
    al.ano,
    al.turma,
    i.data_inscricao
FROM public.inscricoes i
INNER JOIN public.servicos_curriculares sc ON sc.id_servico = i.id_servico_curricular
INNER JOIN public.disciplinas d ON d.id_disciplina = sc.id_disciplina
INNER JOIN public.alunos al ON al.id_aluno = i.id_aluno
INNER JOIN public.pessoas ap ON ap.id_pessoa = al.id_pessoa
LEFT JOIN public.modalidades m ON m.id_modalidade = sc.id_modalidade
LEFT JOIN public.professores prof ON prof.id_professor = sc.id_professor
LEFT JOIN public.pessoas profp ON profp.id_pessoa = prof.id_pessoa
WHERE lower(coalesce(i.estado, 'ativa')) = 'ativa';

CREATE OR REPLACE VIEW public.vw_interesse_disciplinas AS
SELECT
    ip.id_inscricao_publica,
    ip.nome_completo,
    ip.estado,
    COALESCE(NULLIF(plano_item->>'disciplina', ''), ip.disciplina) AS disciplina,
    COALESCE(
        mod.nome,
        COALESCE(NULLIF(plano_item->>'modalidade', ''), ip.modalidade)
    ) AS modalidade,
    COALESCE(NULLIF(plano_item->>'pacote', ''), ip.pacote) AS pacote,
    ip.created_at
FROM public.inscricoes_publicas ip
LEFT JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(ip.dados->'plano') = 'array'
             AND jsonb_array_length(ip.dados->'plano') > 0
        THEN ip.dados->'plano'
        ELSE jsonb_build_array(
            jsonb_build_object(
                'disciplina', ip.disciplina,
                'modalidade', ip.modalidade,
                'pacote', ip.pacote
            )
        )
    END
) AS plano_item ON true
LEFT JOIN public.modalidades mod
    ON mod.id_modalidade::text = COALESCE(NULLIF(plano_item->>'modalidade', ''), ip.modalidade)
    OR LOWER(mod.nome) = LOWER(COALESCE(NULLIF(plano_item->>'modalidade', ''), ip.modalidade))
WHERE lower(ip.estado) IN ('pendente', 'aprovada');
