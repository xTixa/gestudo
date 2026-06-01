-- MediaCenter reporting and integrity layer
-- Adds operational functions, dashboard/reporting views, and small integrity triggers.

-- ============================================================
-- updated_at for remaining operational tables
-- ============================================================

DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'users',
        'pessoas',
        'alunos',
        'professores',
        'encarregados',
        'inscricoes',
        'disciplinas',
        'modalidades',
        'salas',
        'areas_extracurriculares',
        'tipo_servico',
        'niveis_ensino',
        'nivel_extracurricular',
        'notificacoes_device_tokens',
        'alertas_definicoes',
        'alertas_eventos'
    ]
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = v_table
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()', v_table);
            EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I', v_table, v_table);
            EXECUTE format(
                'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at()',
                v_table,
                v_table
            );
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- Integrity trigger helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_normalize_user_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.email := lower(trim(NEW.email));
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_prevent_inscricao_over_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_capacidade integer;
    v_inscritos integer;
    v_id_servico integer;
    v_is_extra boolean;
BEGIN
    IF lower(coalesce(NEW.estado, 'ativa')) <> 'ativa' THEN
        RETURN NEW;
    END IF;

    v_is_extra := NEW.id_servico_extracurricular IS NOT NULL;
    v_id_servico := coalesce(NEW.id_servico_curricular, NEW.id_servico_extracurricular);

    IF v_id_servico IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_is_extra THEN
        SELECT capacidade_max
        INTO v_capacidade
        FROM public.servicos_extracurriculares
        WHERE id_servico = v_id_servico;

        SELECT COUNT(*)::int
        INTO v_inscritos
        FROM public.inscricoes
        WHERE id_servico_extracurricular = v_id_servico
          AND lower(coalesce(estado, 'ativa')) = 'ativa'
          AND (TG_OP = 'INSERT' OR id_inscricao <> NEW.id_inscricao);
    ELSE
        SELECT capacidade_max
        INTO v_capacidade
        FROM public.servicos_curriculares
        WHERE id_servico = v_id_servico;

        SELECT COUNT(*)::int
        INTO v_inscritos
        FROM public.inscricoes
        WHERE id_servico_curricular = v_id_servico
          AND lower(coalesce(estado, 'ativa')) = 'ativa'
          AND (TG_OP = 'INSERT' OR id_inscricao <> NEW.id_inscricao);
    END IF;

    IF v_capacidade IS NOT NULL AND v_inscritos >= v_capacidade THEN
        RAISE EXCEPTION 'Capacidade do servico % excedida: capacidade %, inscritos ativos %',
            v_id_servico,
            v_capacidade,
            v_inscritos
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        DROP TRIGGER IF EXISTS trg_users_normalize_email ON public.users;
        CREATE TRIGGER trg_users_normalize_email
        BEFORE INSERT OR UPDATE OF email ON public.users
        FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_user_email();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes') THEN
        DROP TRIGGER IF EXISTS trg_inscricoes_prevent_over_capacity ON public.inscricoes;
        CREATE TRIGGER trg_inscricoes_prevent_over_capacity
        BEFORE INSERT OR UPDATE OF estado, id_servico_curricular, id_servico_extracurricular ON public.inscricoes
        FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_inscricao_over_capacity();
    END IF;
END;
$$;

-- ============================================================
-- Operational functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_obter_aluno_por_user(p_id_user bigint)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
    SELECT a.id_aluno::bigint
    FROM public.alunos a
    WHERE a.id_user = p_id_user
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_obter_professor_por_user(p_id_user bigint)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
    SELECT p.id_professor::bigint
    FROM public.professores p
    WHERE p.id_user = p_id_user
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_contar_inscritos_servico(
    p_tipo_servico text,
    p_id_servico bigint
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
    SELECT CASE lower(coalesce(p_tipo_servico, 'curricular'))
        WHEN 'extra' THEN (
            SELECT COUNT(*)::int
            FROM public.inscricoes i
            WHERE i.id_servico_extracurricular = p_id_servico
              AND lower(coalesce(i.estado, 'ativa')) = 'ativa'
        )
        WHEN 'extracurricular' THEN (
            SELECT COUNT(*)::int
            FROM public.inscricoes i
            WHERE i.id_servico_extracurricular = p_id_servico
              AND lower(coalesce(i.estado, 'ativa')) = 'ativa'
        )
        ELSE (
            SELECT COUNT(*)::int
            FROM public.inscricoes i
            WHERE i.id_servico_curricular = p_id_servico
              AND lower(coalesce(i.estado, 'ativa')) = 'ativa'
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.fn_servico_tem_vaga(
    p_tipo_servico text,
    p_id_servico bigint
)
RETURNS TABLE (
    tipo_servico text,
    id_servico bigint,
    capacidade_max integer,
    inscritos_ativos integer,
    vagas integer,
    tem_vaga boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF lower(coalesce(p_tipo_servico, 'curricular')) IN ('extra', 'extracurricular') THEN
        RETURN QUERY
        SELECT
            'extracurricular'::text,
            s.id_servico::bigint,
            s.capacidade_max,
            public.fn_contar_inscritos_servico('extracurricular', s.id_servico)::int,
            CASE
                WHEN s.capacidade_max IS NULL THEN NULL
                ELSE s.capacidade_max - public.fn_contar_inscritos_servico('extracurricular', s.id_servico)
            END,
            s.capacidade_max IS NULL OR public.fn_contar_inscritos_servico('extracurricular', s.id_servico) < s.capacidade_max
        FROM public.servicos_extracurriculares s
        WHERE s.id_servico = p_id_servico;
    ELSE
        RETURN QUERY
        SELECT
            'curricular'::text,
            s.id_servico::bigint,
            s.capacidade_max,
            public.fn_contar_inscritos_servico('curricular', s.id_servico)::int,
            CASE
                WHEN s.capacidade_max IS NULL THEN NULL
                ELSE s.capacidade_max - public.fn_contar_inscritos_servico('curricular', s.id_servico)
            END,
            s.capacidade_max IS NULL OR public.fn_contar_inscritos_servico('curricular', s.id_servico) < s.capacidade_max
        FROM public.servicos_curriculares s
        WHERE s.id_servico = p_id_servico;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_salas_disponiveis(
    p_data date,
    p_hora_inicio time,
    p_hora_fim time,
    p_dias_semana text DEFAULT NULL,
    p_excluir_id_servico bigint DEFAULT NULL
)
RETURNS TABLE (
    id_sala bigint,
    nome text,
    capacidade integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        s.id_sala::bigint,
        s.nome::text,
        s.capacidade
    FROM public.salas s
    WHERE coalesce(s.ativa, true) = true
      AND NOT EXISTS (
          SELECT 1
          FROM public.fn_verificar_conflito_horario(
              s.id_sala,
              NULL,
              p_data,
              p_hora_inicio,
              p_hora_fim,
              p_dias_semana,
              p_data,
              p_excluir_id_servico
          ) c
          WHERE c.tipo_conflito = 'sala'
      )
    ORDER BY s.nome;
$$;

CREATE OR REPLACE FUNCTION public.fn_marcar_alerta_lido(
    p_id_alerta_evento bigint,
    p_id_user bigint
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer;
BEGIN
    UPDATE public.alertas_eventos
    SET lido = true,
        lido_em = now()
    WHERE id_alerta_evento = p_id_alerta_evento
      AND id_user = p_id_user;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_suspender_matriculas_expiradas(
    p_ano_letivo text DEFAULT public.fn_current_academic_year(CURRENT_DATE)
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated integer;
BEGIN
    UPDATE public.users u
    SET status = false
    FROM public.alunos a
    WHERE a.id_user = u.id_user
      AND coalesce(a.ano_letivo_renovacao, '') <> p_ano_letivo
      AND u.status = true;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dashboard_resumo_detalhado()
RETURNS TABLE (
    alunos_ativos integer,
    alunos_matricula_expirada integer,
    professores_ativos integer,
    servicos_curriculares_ativos integer,
    servicos_extracurriculares_ativos integer,
    inscricoes_ativas integer,
    faltas_por_resolver integer,
    pedidos_reagendamento_pendentes integer,
    inscricoes_publicas_pendentes integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        (SELECT COUNT(*)::int FROM public.alunos a INNER JOIN public.users u ON u.id_user = a.id_user WHERE u.status = true),
        (SELECT COUNT(*)::int FROM public.alunos a WHERE coalesce(a.ano_letivo_renovacao, '') <> public.fn_current_academic_year(CURRENT_DATE)),
        (SELECT COUNT(*)::int FROM public.professores p INNER JOIN public.users u ON u.id_user = p.id_user WHERE u.status = true),
        (SELECT COUNT(*)::int FROM public.servicos_curriculares s WHERE coalesce(s.ativo, true) = true),
        (SELECT COUNT(*)::int FROM public.servicos_extracurriculares s WHERE coalesce(s.ativo, true) = true),
        (SELECT COUNT(*)::int FROM public.inscricoes i WHERE lower(coalesce(i.estado, 'ativa')) = 'ativa'),
        (SELECT COUNT(*)::int FROM public.presencas p WHERE lower(coalesce(p.estado, '')) = 'falta'),
        (SELECT COUNT(*)::int FROM public.pedidos_reagendamento_professor prp WHERE lower(coalesce(prp.estado, 'pendente')) = 'pendente'),
        (SELECT COUNT(*)::int FROM public.inscricoes_publicas ip WHERE lower(coalesce(ip.estado, 'pendente')) = 'pendente');
$$;

-- ============================================================
-- Reporting views
-- ============================================================

CREATE OR REPLACE VIEW public.vw_utilizadores_detalhe AS
SELECT
    u.id_user,
    u.email,
    u.role,
    u.status,
    u.primeira_login,
    u.imagem_perfil_url,
    coalesce(pa.nome, pp.nome, pe.nome, u.email) AS nome,
    a.id_aluno,
    pr.id_professor,
    e.id_encarregado,
    u.created_at,
    u.updated_at
FROM public.users u
LEFT JOIN public.alunos a ON a.id_user = u.id_user
LEFT JOIN public.pessoas pa ON pa.id_pessoa = a.id_pessoa
LEFT JOIN public.professores pr ON pr.id_user = u.id_user
LEFT JOIN public.pessoas pp ON pp.id_pessoa = pr.id_pessoa
LEFT JOIN public.encarregados e ON e.id_user = u.id_user
LEFT JOIN public.pessoas pe ON pe.id_pessoa = e.id_pessoa;

CREATE OR REPLACE VIEW public.vw_presencas_detalhe AS
SELECT
    p.id_presenca,
    p.id_servico,
    p.id_aluno,
    aluno_p.nome AS aluno,
    sc.id_professor,
    prof_p.nome AS professor,
    d.nome AS disciplina,
    sala.nome AS sala,
    p.data_aula,
    p.hora_aula,
    p.estado,
    p.observacao,
    p.data_reposicao,
    p.marcado_por,
    marcador.email AS marcado_por_email,
    p.created_at,
    p.updated_at
FROM public.presencas p
INNER JOIN public.alunos a ON a.id_aluno = p.id_aluno
INNER JOIN public.pessoas aluno_p ON aluno_p.id_pessoa = a.id_pessoa
INNER JOIN public.servicos_curriculares sc ON sc.id_servico = p.id_servico
LEFT JOIN public.professores prof ON prof.id_professor = sc.id_professor
LEFT JOIN public.pessoas prof_p ON prof_p.id_pessoa = prof.id_pessoa
LEFT JOIN public.disciplinas d ON d.id_disciplina = sc.id_disciplina
LEFT JOIN public.salas sala ON sala.id_sala = sc.id_sala
LEFT JOIN public.users marcador ON marcador.id_user = p.marcado_por;

CREATE OR REPLACE VIEW public.vw_pedidos_reagendamento_detalhe AS
SELECT
    prp.id_pedido_reagendamento,
    prp.id_professor,
    prof_p.nome AS professor,
    prof_u.email AS professor_email,
    prp.id_servico,
    prp.titulo_servico,
    prp.aluno_nome,
    prp.ano_label,
    prp.data_original,
    prp.hora_original,
    prp.sala_original,
    prp.data_sugerida,
    prp.hora_sugerida,
    prp.sala_sugerida,
    prp.motivo,
    prp.estado,
    prp.aprovado_por,
    aprov.email AS aprovado_por_email,
    prp.rejeitado_por,
    rej.email AS rejeitado_por_email,
    prp.decidido_em,
    prp.motivo_decisao,
    prp.created_at,
    prp.updated_at
FROM public.pedidos_reagendamento_professor prp
LEFT JOIN public.professores prof ON prof.id_professor = prp.id_professor
LEFT JOIN public.pessoas prof_p ON prof_p.id_pessoa = prof.id_pessoa
LEFT JOIN public.users prof_u ON prof_u.id_user = prof.id_user
LEFT JOIN public.users aprov ON aprov.id_user = prp.aprovado_por
LEFT JOIN public.users rej ON rej.id_user = prp.rejeitado_por;

CREATE OR REPLACE VIEW public.vw_alertas_eventos_detalhe AS
SELECT
    ae.id_alerta_evento,
    ae.id_alerta_definicao,
    ad.codigo,
    ad.grupo,
    coalesce(ae.titulo, ad.titulo) AS titulo,
    ae.descricao,
    ae.nivel,
    ae.canal,
    ae.id_user,
    u.email,
    ae.payload,
    ae.lido,
    ae.lido_em,
    ae.criado_em
FROM public.alertas_eventos ae
LEFT JOIN public.alertas_definicoes ad ON ad.id_alerta_definicao = ae.id_alerta_definicao
LEFT JOIN public.users u ON u.id_user = ae.id_user;

CREATE OR REPLACE VIEW public.vw_servicos_extracurriculares_resumo AS
SELECT
    s.id_servico,
    s.id_professor,
    prof_p.nome AS professor,
    s.id_area,
    area.nome AS area,
    s.id_modalidade,
    m.nome AS modalidade,
    s.id_sala,
    sala.nome AS sala,
    s.id_tipo_servico_extra,
    tse.nome AS tipo_servico_extra,
    s.tipo,
    s.ano_letivo,
    s.data_inicio,
    s.data_fim,
    s.hora_inicio,
    s.hora_fim,
    s.dias_semana,
    s.capacidade_max,
    coalesce(s.ativo, true) AS ativo,
    public.fn_contar_inscritos_servico('extracurricular', s.id_servico) AS inscritos_ativos
FROM public.servicos_extracurriculares s
LEFT JOIN public.professores prof ON prof.id_professor = s.id_professor
LEFT JOIN public.pessoas prof_p ON prof_p.id_pessoa = prof.id_pessoa
LEFT JOIN public.areas_extracurriculares area ON area.id_area = s.id_area
LEFT JOIN public.modalidades m ON m.id_modalidade = s.id_modalidade
LEFT JOIN public.salas sala ON sala.id_sala = s.id_sala
LEFT JOIN public.tipo_servico_extracurricular tse ON tse.id_tipo_servico_extra = s.id_tipo_servico_extra;

CREATE OR REPLACE VIEW public.vw_catalogo_servicos AS
SELECT
    'curricular'::text AS tipo_servico,
    s.id_servico,
    d.nome AS nome,
    m.nome AS modalidade,
    sala.nome AS sala,
    prof_p.nome AS professor,
    s.data_inicio,
    s.data_fim,
    s.hora_inicio,
    s.hora_fim,
    s.capacidade_max,
    public.fn_contar_inscritos_servico('curricular', s.id_servico) AS inscritos_ativos,
    coalesce(s.ativo, true) AS ativo
FROM public.servicos_curriculares s
LEFT JOIN public.disciplinas d ON d.id_disciplina = s.id_disciplina
LEFT JOIN public.modalidades m ON m.id_modalidade = s.id_modalidade
LEFT JOIN public.salas sala ON sala.id_sala = s.id_sala
LEFT JOIN public.professores prof ON prof.id_professor = s.id_professor
LEFT JOIN public.pessoas prof_p ON prof_p.id_pessoa = prof.id_pessoa
UNION ALL
SELECT
    'extracurricular'::text AS tipo_servico,
    s.id_servico,
    coalesce(tse.nome, area.nome) AS nome,
    m.nome AS modalidade,
    sala.nome AS sala,
    prof_p.nome AS professor,
    s.data_inicio,
    s.data_fim,
    s.hora_inicio,
    s.hora_fim,
    s.capacidade_max,
    public.fn_contar_inscritos_servico('extracurricular', s.id_servico) AS inscritos_ativos,
    coalesce(s.ativo, true) AS ativo
FROM public.servicos_extracurriculares s
LEFT JOIN public.tipo_servico_extracurricular tse ON tse.id_tipo_servico_extra = s.id_tipo_servico_extra
LEFT JOIN public.areas_extracurriculares area ON area.id_area = s.id_area
LEFT JOIN public.modalidades m ON m.id_modalidade = s.id_modalidade
LEFT JOIN public.salas sala ON sala.id_sala = s.id_sala
LEFT JOIN public.professores prof ON prof.id_professor = s.id_professor
LEFT JOIN public.pessoas prof_p ON prof_p.id_pessoa = prof.id_pessoa;

CREATE OR REPLACE VIEW public.vw_ocupacao_salas AS
SELECT
    s.id_sala,
    s.nome AS sala,
    s.capacidade,
    COUNT(sc.id_servico)::int AS servicos_curriculares_ativos,
    COUNT(se.id_servico)::int AS servicos_extracurriculares_ativos,
    (COUNT(sc.id_servico) + COUNT(se.id_servico))::int AS total_servicos_ativos
FROM public.salas s
LEFT JOIN public.servicos_curriculares sc
    ON sc.id_sala = s.id_sala
   AND coalesce(sc.ativo, true) = true
LEFT JOIN public.servicos_extracurriculares se
    ON se.id_sala = s.id_sala
   AND coalesce(se.ativo, true) = true
GROUP BY s.id_sala, s.nome, s.capacidade;

CREATE OR REPLACE VIEW public.vw_matriculas_estado AS
SELECT
    a.id_aluno,
    a.id_user,
    p.nome AS aluno,
    u.email,
    a.ano,
    a.turma,
    a.escola,
    a.ano_letivo_renovacao,
    public.fn_current_academic_year(CURRENT_DATE) AS ano_letivo_atual,
    CASE
        WHEN coalesce(a.ano_letivo_renovacao, '') = public.fn_current_academic_year(CURRENT_DATE)
            THEN 'ativa'
        ELSE 'expirada'
    END AS estado_matricula,
    a.data_renovacao_ultima,
    u.status AS conta_ativa
FROM public.alunos a
INNER JOIN public.pessoas p ON p.id_pessoa = a.id_pessoa
INNER JOIN public.users u ON u.id_user = a.id_user;

CREATE OR REPLACE VIEW public.vw_receita_inscricoes AS
SELECT
    date_trunc('month', i.data_inscricao)::date AS mes,
    COUNT(*)::int AS total_inscricoes,
    COUNT(*) FILTER (WHERE lower(coalesce(i.estado, '')) = 'ativa')::int AS inscricoes_ativas,
    SUM(i.valor_final) FILTER (WHERE lower(coalesce(i.estado, '')) = 'ativa') AS valor_ativo,
    SUM(i.valor_final) AS valor_total
FROM public.inscricoes i
GROUP BY date_trunc('month', i.data_inscricao)::date;

CREATE OR REPLACE VIEW public.vw_notificacoes_tokens_ativos AS
SELECT
    t.id_notificacao_device_token,
    t.id_user,
    u.email,
    t.plataforma,
    t.ativo,
    t.ultimo_registo_em,
    t.created_at,
    t.updated_at
FROM public.notificacoes_device_tokens t
INNER JOIN public.users u ON u.id_user = t.id_user
WHERE t.ativo = true;

-- ============================================================
-- Additional indexes for the new operational views/functions
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_inscricoes_servico_curricular_estado
ON public.inscricoes (id_servico_curricular, estado);

CREATE INDEX IF NOT EXISTS idx_inscricoes_servico_extracurricular_estado
ON public.inscricoes (id_servico_extracurricular, estado);

CREATE INDEX IF NOT EXISTS idx_alertas_eventos_user_canal_lido
ON public.alertas_eventos (id_user, canal, lido, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_servicos_extracurriculares_sala_datas
ON public.servicos_extracurriculares (id_sala, data_inicio, data_fim, hora_inicio, hora_fim);

CREATE INDEX IF NOT EXISTS idx_users_email_lower
ON public.users (lower(email));
