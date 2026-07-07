-- MediaCenter database operations
-- Idempotent migration: safe to run on every application startup.

-- ============================================================
-- Utility functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_current_academic_year(p_reference_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN EXTRACT(MONTH FROM p_reference_date)::int >= 9
            THEN EXTRACT(YEAR FROM p_reference_date)::int::text || '/' || (EXTRACT(YEAR FROM p_reference_date)::int + 1)::text
        ELSE (EXTRACT(YEAR FROM p_reference_date)::int - 1)::text || '/' || EXTRACT(YEAR FROM p_reference_date)::int::text
    END;
$$;

CREATE OR REPLACE FUNCTION public.fn_normalize_weekday_token(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE regexp_replace(
        lower(trim(coalesce(p_value, ''))),
        '(\s+|-feira)',
        '',
        'g'
    )
        WHEN '0' THEN 'domingo'
        WHEN '7' THEN 'domingo'
        WHEN 'dom' THEN 'domingo'
        WHEN 'domingo' THEN 'domingo'
        WHEN '1' THEN 'segunda'
        WHEN 'seg' THEN 'segunda'
        WHEN 'segunda' THEN 'segunda'
        WHEN '2' THEN 'terca'
        WHEN 'ter' THEN 'terca'
        WHEN 'terca' THEN 'terca'
        WHEN '3' THEN 'quarta'
        WHEN 'qua' THEN 'quarta'
        WHEN 'quarta' THEN 'quarta'
        WHEN '4' THEN 'quinta'
        WHEN 'qui' THEN 'quinta'
        WHEN 'quinta' THEN 'quinta'
        WHEN '5' THEN 'sexta'
        WHEN 'sex' THEN 'sexta'
        WHEN 'sexta' THEN 'sexta'
        WHEN '6' THEN 'sabado'
        WHEN 'sab' THEN 'sabado'
        WHEN 'sabado' THEN 'sabado'
        ELSE NULL
    END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dias_semana_to_array(p_dias_semana text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_raw text := trim(coalesce(p_dias_semana, ''));
    v_item text;
    v_output text[] := ARRAY[]::text[];
BEGIN
    IF v_raw = '' THEN
        RETURN v_output;
    END IF;

    IF left(v_raw, 1) = '[' THEN
        FOR v_item IN
            SELECT jsonb_array_elements_text(v_raw::jsonb)
        LOOP
            IF public.fn_normalize_weekday_token(v_item) IS NOT NULL THEN
                v_output := array_append(v_output, public.fn_normalize_weekday_token(v_item));
            END IF;
        END LOOP;
    ELSE
        FOR v_item IN
            SELECT regexp_split_to_table(v_raw, '\s*,\s*')
        LOOP
            IF public.fn_normalize_weekday_token(v_item) IS NOT NULL THEN
                v_output := array_append(v_output, public.fn_normalize_weekday_token(v_item));
            END IF;
        END LOOP;
    END IF;

    RETURN ARRAY(SELECT DISTINCT unnest(v_output));
EXCEPTION
    WHEN others THEN
        RETURN ARRAY[]::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor bigint;
    v_action text := TG_OP;
    v_entity text := TG_ARGV[0];
    v_id_column text := TG_ARGV[1];
    v_entity_id bigint;
    v_old jsonb;
    v_new jsonb;
    v_details text;
    v_level text := COALESCE(TG_ARGV[2], 'info');
    v_has_logs boolean;
    v_has_level boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'logs'
    ) INTO v_has_logs;

    IF NOT v_has_logs THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

    IF v_new ? v_id_column THEN
        v_entity_id := NULLIF(v_new ->> v_id_column, '')::bigint;
    ELSIF v_old ? v_id_column THEN
        v_entity_id := NULLIF(v_old ->> v_id_column, '')::bigint;
    END IF;

    v_actor := NULLIF(current_setting('app.current_user_id', true), '')::bigint;
    IF v_actor IS NULL AND v_new ? 'marcado_por' THEN
        v_actor := NULLIF(v_new ->> 'marcado_por', '')::bigint;
    END IF;
    IF v_actor IS NULL AND v_new ? 'aprovado_por' THEN
        v_actor := NULLIF(v_new ->> 'aprovado_por', '')::bigint;
    END IF;
    IF v_actor IS NULL AND v_new ? 'rejeitado_por' THEN
        v_actor := NULLIF(v_new ->> 'rejeitado_por', '')::bigint;
    END IF;

    v_details := jsonb_build_object(
        'origem', 'trigger',
        'tabela', TG_TABLE_NAME,
        'antes', v_old,
        'depois', v_new
    )::text;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'nivel'
    ) INTO v_has_level;

    IF v_has_level THEN
        INSERT INTO public.logs (id_user, acao, entidade, entidade_id, detalhes, nivel)
        VALUES (v_actor, v_action, v_entity, v_entity_id, left(v_details, 1000), v_level);
    ELSE
        INSERT INTO public.logs (id_user, acao, entidade, entidade_id, detalhes)
        VALUES (v_actor, v_action, v_entity, v_entity_id, left(v_details, 1000));
    END IF;

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN others THEN
        -- Audit must never block the business operation.
        RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- Runtime tables that previously were created inside controllers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inscricoes_publicas (
    id_inscricao_publica BIGSERIAL PRIMARY KEY,
    data_inicio DATE,
    nome_completo TEXT NOT NULL,
    data_nascimento DATE,
    email TEXT,
    telemovel TEXT,
    telefone TEXT,
    cartao_cidadao TEXT,
    nif TEXT,
    morada TEXT,
    localidade TEXT,
    codigo_postal TEXT,
    escola TEXT,
    nivel_ensino TEXT,
    ano_escolar TEXT,
    turma TEXT,
    disciplina TEXT,
    tipo_servico TEXT,
    modalidade TEXT,
    pacote TEXT,
    obs TEXT,
    ee_nome TEXT,
    ee_nif TEXT,
    ee_email TEXT,
    ee_telemovel TEXT,
    ee_telefone TEXT,
    ee_morada TEXT,
    ee_localidade TEXT,
    ee_codigo_postal TEXT,
    ee_parentesco TEXT,
    aut_saida_nome_1 TEXT,
    aut_saida_parentesco_1 TEXT,
    aut_saida_nome_2 TEXT,
    aut_saida_parentesco_2 TEXT,
    estado TEXT NOT NULL DEFAULT 'pendente',
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pedidos_reagendamento_professor (
    id_pedido_reagendamento BIGSERIAL PRIMARY KEY,
    id_professor BIGINT NOT NULL,
    id_servico BIGINT NOT NULL,
    titulo_servico TEXT,
    aluno_nome TEXT,
    ano_label TEXT,
    data_original DATE,
    hora_original TEXT,
    sala_original TEXT,
    data_sugerida DATE,
    hora_sugerida TEXT,
    sala_sugerida TEXT,
    motivo TEXT,
    estado TEXT NOT NULL DEFAULT 'pendente',
    aprovado_por BIGINT,
    rejeitado_por BIGINT,
    decidido_em TIMESTAMPTZ,
    motivo_decisao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_publicas_estado
ON public.inscricoes_publicas (estado);

CREATE INDEX IF NOT EXISTS idx_inscricoes_publicas_created_at
ON public.inscricoes_publicas (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reagendamento_professor_estado
ON public.pedidos_reagendamento_professor (estado);

CREATE INDEX IF NOT EXISTS idx_reagendamento_professor_professor
ON public.pedidos_reagendamento_professor (id_professor);

-- ============================================================
-- updated_at support
-- ============================================================

DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'servicos_curriculares',
        'servicos_extracurriculares',
        'pacotes',
        'tipo_servico_extracurricular',
        'presencas',
        'pedidos_reagendamento_professor',
        'inscricoes_publicas'
    ]
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = v_table
        ) THEN
            IF v_table = 'servicos_curriculares' THEN
                EXECUTE 'ALTER TABLE public.servicos_curriculares ADD COLUMN IF NOT EXISTS dias_semana TEXT DEFAULT NULL';
            END IF;

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
-- Audit triggers for tables that were not automatically covered
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'presencas') THEN
        DROP TRIGGER IF EXISTS trg_presencas_audit ON public.presencas;
        CREATE TRIGGER trg_presencas_audit
        AFTER INSERT OR UPDATE OR DELETE ON public.presencas
        FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('presencas', 'id_presenca', 'info');
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pedidos_reagendamento_professor') THEN
        DROP TRIGGER IF EXISTS trg_pedidos_reagendamento_professor_audit ON public.pedidos_reagendamento_professor;
        CREATE TRIGGER trg_pedidos_reagendamento_professor_audit
        AFTER INSERT OR UPDATE OR DELETE ON public.pedidos_reagendamento_professor
        FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('pedidos_reagendamento_professor', 'id_pedido_reagendamento', 'alert');
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes_publicas') THEN
        DROP TRIGGER IF EXISTS trg_inscricoes_publicas_audit ON public.inscricoes_publicas;
        CREATE TRIGGER trg_inscricoes_publicas_audit
        AFTER INSERT OR UPDATE OR DELETE ON public.inscricoes_publicas
        FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('inscricoes_publicas', 'id_inscricao_publica', 'alert');
    END IF;
END;
$$;

-- ============================================================
-- Scheduling conflict checks
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_verificar_conflito_horario(
    p_id_sala bigint DEFAULT NULL,
    p_id_professor bigint DEFAULT NULL,
    p_data_inicio date DEFAULT NULL,
    p_hora_inicio time DEFAULT NULL,
    p_hora_fim time DEFAULT NULL,
    p_dias_semana text DEFAULT NULL,
    p_data_fim date DEFAULT NULL,
    p_excluir_id_servico bigint DEFAULT NULL
)
RETURNS TABLE (
    id_servico bigint,
    tipo_conflito text,
    id_sala bigint,
    id_professor bigint,
    data_inicio date,
    data_fim date,
    hora_inicio time,
    hora_fim time,
    dias_semana text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_novos_dias text[] := public.fn_dias_semana_to_array(p_dias_semana);
BEGIN
    IF p_data_inicio IS NULL OR p_hora_inicio IS NULL OR p_hora_fim IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.id_servico::bigint,
        CASE
            WHEN p_id_sala IS NOT NULL AND s.id_sala = p_id_sala THEN 'sala'
            ELSE 'professor'
        END AS tipo_conflito,
        s.id_sala::bigint,
        s.id_professor::bigint,
        s.data_inicio::date,
        COALESCE(s.data_fim, s.data_inicio)::date,
        s.hora_inicio::time,
        s.hora_fim::time,
        s.dias_semana::text
    FROM public.servicos_curriculares s
    WHERE COALESCE(s.ativo, true) = true
      AND (p_excluir_id_servico IS NULL OR s.id_servico <> p_excluir_id_servico)
      AND (
          (p_id_sala IS NOT NULL AND s.id_sala = p_id_sala)
          OR (p_id_professor IS NOT NULL AND s.id_professor = p_id_professor)
      )
      AND NOT (
          COALESCE(s.data_fim, s.data_inicio) < p_data_inicio
          OR s.data_inicio > COALESCE(p_data_fim, p_data_inicio)
      )
      AND p_hora_inicio < s.hora_fim::time
      AND p_hora_fim > s.hora_inicio::time
      AND (
          cardinality(v_novos_dias) = 0
          OR cardinality(public.fn_dias_semana_to_array(s.dias_semana::text)) = 0
          OR v_novos_dias && public.fn_dias_semana_to_array(s.dias_semana::text)
      )
    ORDER BY s.data_inicio, s.hora_inicio, s.id_servico;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_prevent_sala_schedule_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_conflict record;
BEGIN
    IF COALESCE(NEW.ativo, true) = false OR NEW.id_sala IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT *
    INTO v_conflict
    FROM public.fn_verificar_conflito_horario(
        NEW.id_sala,
        NULL,
        NEW.data_inicio,
        NEW.hora_inicio::time,
        NEW.hora_fim::time,
        NEW.dias_semana::text,
        COALESCE(NEW.data_fim, NEW.data_inicio),
        CASE WHEN TG_OP = 'UPDATE' THEN NEW.id_servico ELSE NULL END
    )
    WHERE tipo_conflito = 'sala'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Conflito de sala: sala % ja tem o servico % entre % e %',
            NEW.id_sala,
            v_conflict.id_servico,
            v_conflict.hora_inicio,
            v_conflict.hora_fim
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    v_inscricao_curricular_col text;
    v_inscricao_extra_col text;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_curriculares')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'professores')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pessoas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disciplinas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modalidades')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salas') THEN
        DROP TRIGGER IF EXISTS trg_servicos_curriculares_sala_conflict ON public.servicos_curriculares;
        CREATE TRIGGER trg_servicos_curriculares_sala_conflict
        BEFORE INSERT OR UPDATE OF id_sala, data_inicio, data_fim, hora_inicio, hora_fim, dias_semana, ativo
        ON public.servicos_curriculares
        FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_sala_schedule_conflict();
    END IF;
END;
$$;

-- ============================================================
-- Business functions
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alertas_definicoes')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alertas_preferencias_utilizador') THEN
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION public.fn_upsert_alerta_preferencia(
                p_id_user bigint,
                p_codigo text,
                p_canal_app boolean DEFAULT NULL,
                p_canal_email boolean DEFAULT NULL,
                p_canal_sms boolean DEFAULT NULL,
                p_ativo boolean DEFAULT NULL
            )
            RETURNS TABLE (
                id_alerta_preferencia bigint,
                id_user bigint,
                id_alerta_definicao bigint,
                canal_app boolean,
                canal_email boolean,
                canal_sms boolean,
                ativo boolean,
                atualizado_em timestamptz
            )
            LANGUAGE plpgsql
            AS $body$
            DECLARE
                v_def record;
            BEGIN
                SELECT *
                INTO v_def
                FROM public.alertas_definicoes ad
                WHERE ad.codigo = p_codigo
                  AND COALESCE(ad.ativo, true) = true
                LIMIT 1;

                IF NOT FOUND THEN
                    RETURN;
                END IF;

                RETURN QUERY
                INSERT INTO public.alertas_preferencias_utilizador (
                    id_user,
                    id_alerta_definicao,
                    canal_app,
                    canal_email,
                    canal_sms,
                    ativo,
                    atualizado_em
                )
                VALUES (
                    p_id_user,
                    v_def.id_alerta_definicao,
                    COALESCE(p_canal_app, v_def.canal_app_default, true),
                    COALESCE(p_canal_email, v_def.canal_email_default, true),
                    COALESCE(p_canal_sms, v_def.canal_sms_default, false),
                    COALESCE(p_ativo, true),
                    NOW()
                )
                ON CONFLICT ON CONSTRAINT uq_alertas_preferencias_user_definicao
                DO UPDATE SET
                    canal_app = COALESCE(p_canal_app, alertas_preferencias_utilizador.canal_app),
                    canal_email = COALESCE(p_canal_email, alertas_preferencias_utilizador.canal_email),
                    canal_sms = COALESCE(p_canal_sms, alertas_preferencias_utilizador.canal_sms),
                    ativo = COALESCE(p_ativo, alertas_preferencias_utilizador.ativo),
                    atualizado_em = NOW()
                RETURNING
                    alertas_preferencias_utilizador.id_alerta_preferencia::bigint,
                    alertas_preferencias_utilizador.id_user::bigint,
                    alertas_preferencias_utilizador.id_alerta_definicao::bigint,
                    alertas_preferencias_utilizador.canal_app,
                    alertas_preferencias_utilizador.canal_email,
                    alertas_preferencias_utilizador.canal_sms,
                    alertas_preferencias_utilizador.ativo,
                    alertas_preferencias_utilizador.atualizado_em::timestamptz;
            END;
            $body$;
        $fn$;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'presencas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alunos')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pessoas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_curriculares')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disciplinas') THEN
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION public.fn_calcular_faltas_aluno(
                p_id_aluno bigint,
                p_id_servico bigint DEFAULT NULL
            )
            RETURNS TABLE (
                id_aluno bigint,
                id_servico bigint,
                total_faltas integer,
                faltas_justificadas integer,
                faltas_repostas integer,
                faltas_por_resolver integer
            )
            LANGUAGE sql
            STABLE
            AS $body$
                SELECT
                    pr.id_aluno::bigint,
                    pr.id_servico::bigint,
                    COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'falta')::int AS total_faltas,
                    COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'justificada')::int AS faltas_justificadas,
                    COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'reposta')::int AS faltas_repostas,
                    COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'falta')::int AS faltas_por_resolver
                FROM public.presencas pr
                WHERE pr.id_aluno = p_id_aluno
                  AND (p_id_servico IS NULL OR pr.id_servico = p_id_servico)
                GROUP BY pr.id_aluno, pr.id_servico;
            $body$;
        $fn$;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alunos') THEN
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION public.fn_renovar_matricula(
                p_id_aluno bigint,
                p_ano_letivo text DEFAULT public.fn_current_academic_year(CURRENT_DATE)
            )
            RETURNS TABLE (
                id_aluno bigint,
                id_user bigint,
                data_renovacao_ultima timestamp,
                ano_letivo_renovacao text
            )
            LANGUAGE plpgsql
            AS $body$
            BEGIN
                RETURN QUERY
                UPDATE public.alunos a
                SET data_renovacao_ultima = NOW(),
                    ano_letivo_renovacao = p_ano_letivo
                WHERE a.id_aluno = p_id_aluno
                RETURNING
                    a.id_aluno::bigint,
                    a.id_user::bigint,
                    a.data_renovacao_ultima,
                    a.ano_letivo_renovacao::text;
            END;
            $body$;
        $fn$;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes_publicas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pessoas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alunos')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'encarregados') THEN
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION public.fn_processar_inscricao_publica(
                p_id_inscricao_publica bigint,
                p_aluno_password_hash text DEFAULT NULL,
                p_encarregado_password_hash text DEFAULT NULL
            )
            RETURNS TABLE (
                id_inscricao_publica bigint,
                id_user_aluno bigint,
                id_pessoa_aluno bigint,
                id_aluno bigint,
                id_user_encarregado bigint,
                id_pessoa_encarregado bigint,
                id_encarregado bigint,
                aluno_criado boolean,
                encarregado_criado boolean
            )
            LANGUAGE plpgsql
            AS $body$
            DECLARE
                v_ip record;
                v_email_aluno text;
                v_email_encarregado text;
                v_ano integer;
            BEGIN
                SELECT ip.*
                INTO v_ip
                FROM public.inscricoes_publicas ip
                WHERE ip.id_inscricao_publica = p_id_inscricao_publica
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Inscricao publica % nao encontrada', p_id_inscricao_publica;
                END IF;

                IF lower(coalesce(v_ip.estado, 'pendente')) <> 'pendente' THEN
                    RAISE EXCEPTION 'Inscricao publica % ja foi processada com estado %', p_id_inscricao_publica, v_ip.estado;
                END IF;

                v_email_aluno := lower(nullif(trim(v_ip.email), ''));
                IF v_email_aluno IS NULL THEN
                    RAISE EXCEPTION 'Inscricao publica % nao tem email do aluno', p_id_inscricao_publica;
                END IF;

                SELECT u.id_user
                INTO id_user_aluno
                FROM public.users u
                WHERE lower(u.email) = v_email_aluno
                LIMIT 1;

                IF id_user_aluno IS NULL THEN
                    INSERT INTO public.users (email, password, role, status, primeira_login)
                    VALUES (v_email_aluno, coalesce(p_aluno_password_hash, 'ALTERAR_PASSWORD'), 'aluno', true, true)
                    RETURNING users.id_user INTO id_user_aluno;
                END IF;

                SELECT p.id_pessoa
                INTO id_pessoa_aluno
                FROM public.pessoas p
                WHERE v_ip.nif IS NOT NULL
                  AND p.nif = v_ip.nif
                LIMIT 1;

                IF id_pessoa_aluno IS NULL THEN
                    INSERT INTO public.pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel, telefone)
                    VALUES (
                        coalesce(nullif(trim(v_ip.nome_completo), ''), 'Aluno'),
                        v_ip.data_nascimento,
                        coalesce(nullif(trim(v_ip.cartao_cidadao), ''), 'N/D'),
                        nullif(trim(v_ip.nif), ''),
                        nullif(trim(v_ip.morada), ''),
                        nullif(trim(v_ip.localidade), ''),
                        nullif(trim(v_ip.codigo_postal), ''),
                        nullif(trim(v_ip.telemovel), ''),
                        nullif(trim(v_ip.telefone), '')
                    )
                    RETURNING pessoas.id_pessoa INTO id_pessoa_aluno;
                END IF;

                v_email_encarregado := coalesce(
                    lower(nullif(trim(v_ip.ee_email), '')),
                    'encarregado.inscricao.' || p_id_inscricao_publica::text || '@placeholder.local'
                );

                SELECT u.id_user
                INTO id_user_encarregado
                FROM public.users u
                WHERE lower(u.email) = v_email_encarregado
                LIMIT 1;

                IF id_user_encarregado IS NULL THEN
                    INSERT INTO public.users (email, password, role, status, primeira_login)
                    VALUES (v_email_encarregado, coalesce(p_encarregado_password_hash, p_aluno_password_hash, 'ALTERAR_PASSWORD'), 'aluno', true, true)
                    RETURNING users.id_user INTO id_user_encarregado;
                END IF;

                SELECT e.id_encarregado, e.id_pessoa
                INTO id_encarregado, id_pessoa_encarregado
                FROM public.encarregados e
                INNER JOIN public.pessoas p ON p.id_pessoa = e.id_pessoa
                WHERE v_ip.ee_nif IS NOT NULL
                  AND p.nif = v_ip.ee_nif
                LIMIT 1;

                IF id_encarregado IS NULL THEN
                    INSERT INTO public.pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel, telefone)
                    VALUES (
                        coalesce(nullif(trim(v_ip.ee_nome), ''), 'Encarregado'),
                        DATE '1980-01-01',
                        'N/D',
                        nullif(trim(v_ip.ee_nif), ''),
                        nullif(trim(v_ip.ee_morada), ''),
                        nullif(trim(v_ip.ee_localidade), ''),
                        nullif(trim(v_ip.ee_codigo_postal), ''),
                        nullif(trim(v_ip.ee_telemovel), ''),
                        nullif(trim(v_ip.ee_telefone), '')
                    )
                    RETURNING pessoas.id_pessoa INTO id_pessoa_encarregado;

                    INSERT INTO public.encarregados (id_user, id_pessoa, parentesco)
                    VALUES (id_user_encarregado, id_pessoa_encarregado, nullif(trim(v_ip.ee_parentesco), ''))
                    RETURNING encarregados.id_encarregado INTO id_encarregado;

                    encarregado_criado := true;
                ELSE
                    encarregado_criado := false;
                END IF;

                SELECT a.id_aluno
                INTO id_aluno
                FROM public.alunos a
                WHERE a.id_user = id_user_aluno
                LIMIT 1;

                IF id_aluno IS NULL THEN
                    v_ano := NULLIF(regexp_replace(coalesce(v_ip.ano_escolar, ''), '\D', '', 'g'), '')::integer;

                    INSERT INTO public.alunos (id_user, id_pessoa, id_encarregado, ano, turma, escola)
                    VALUES (
                        id_user_aluno,
                        id_pessoa_aluno,
                        id_encarregado,
                        v_ano,
                        nullif(trim(v_ip.turma), ''),
                        nullif(trim(v_ip.escola), '')
                    )
                    RETURNING alunos.id_aluno INTO id_aluno;

                    aluno_criado := true;
                ELSE
                    aluno_criado := false;
                END IF;

                UPDATE public.inscricoes_publicas
                SET estado = 'aprovada'
                WHERE inscricoes_publicas.id_inscricao_publica = p_id_inscricao_publica;

                id_inscricao_publica := p_id_inscricao_publica;
                RETURN NEXT;
            END;
            $body$;
        $fn$;
    END IF;
END;
$$;

-- ============================================================
-- Views
-- ============================================================

DO $$
DECLARE
    v_inscricao_curricular_col text;
    v_inscricao_extra_col text;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'professores')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pessoas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE $view$
            CREATE OR REPLACE VIEW public.vw_professores_detalhe AS
            SELECT
                pr.id_professor,
                pr.id_user,
                pr.id_pessoa,
                p.nome,
                p.data_nasc AS data_nascimento,
                p.cc,
                p.nif,
                p.morada,
                p.localidade,
                p.cod_postal,
                p.telemovel,
                p.telefone,
                u.email,
                u.role,
                u.status,
                u.imagem_perfil_url,
                pr.habilitacao,
                pr.area_ensino,
                pr.nivel,
                u.created_at
            FROM public.professores pr
            INNER JOIN public.pessoas p ON p.id_pessoa = pr.id_pessoa
            INNER JOIN public.users u ON u.id_user = pr.id_user
        $view$;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_curriculares')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'professores')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pessoas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disciplinas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modalidades')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salas') THEN
        SELECT column_name
        INTO v_inscricao_curricular_col
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inscricoes'
          AND column_name IN ('id_servico_curricular', 'id_servico', 'id_servicocurricular', 'servico_id', 'id_servicos')
        ORDER BY CASE column_name
            WHEN 'id_servico_curricular' THEN 1
            WHEN 'id_servico' THEN 2
            ELSE 3
        END
        LIMIT 1;

        IF v_inscricao_curricular_col IS NULL THEN
            RAISE NOTICE 'vw_agenda_gestor nao criada: coluna de servico curricular em inscricoes nao existe.';
        ELSE
        EXECUTE format($view$
            CREATE OR REPLACE VIEW public.vw_agenda_gestor AS
            SELECT
                'curricular'::text AS origem,
                s.id_servico,
                s.ativo,
                s.id_professor,
                COALESCE(pp.nome, u.email, 'Professor') AS professor,
                s.id_disciplina,
                COALESCE(d.nome, 'Servico') AS disciplina_area,
                s.id_modalidade,
                m.nome AS modalidade,
                s.id_sala,
                sa.nome AS sala,
                s.data_inicio,
                s.data_fim,
                s.hora_inicio,
                s.hora_fim,
                s.dias_semana,
                s.capacidade_max,
                COUNT(DISTINCT i.id_aluno) FILTER (WHERE lower(coalesce(i.estado, 'ativa')) = 'ativa')::int AS inscritos
            FROM public.servicos_curriculares s
            LEFT JOIN public.professores pr ON pr.id_professor = s.id_professor
            LEFT JOIN public.pessoas pp ON pp.id_pessoa = pr.id_pessoa
            LEFT JOIN public.users u ON u.id_user = pr.id_user
            LEFT JOIN public.disciplinas d ON d.id_disciplina = s.id_disciplina
            LEFT JOIN public.modalidades m ON m.id_modalidade = s.id_modalidade
            LEFT JOIN public.salas sa ON sa.id_sala = s.id_sala
            LEFT JOIN public.inscricoes i ON i.%I = s.id_servico
            WHERE COALESCE(s.ativo, true) = true
            GROUP BY s.id_servico, pp.nome, u.email, d.nome, m.nome, sa.nome
        $view$, v_inscricao_curricular_col);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'presencas') THEN
        EXECUTE $view$
            CREATE OR REPLACE VIEW public.vw_faltas_por_aluno AS
            SELECT
                pr.id_aluno,
                a.id_user,
                p.nome AS aluno,
                pr.id_servico,
                COALESCE(d.nome, 'Servico') AS servico,
                COUNT(*)::int AS total_registos,
                COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'presente')::int AS presencas,
                COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'falta')::int AS faltas,
                COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'justificada')::int AS faltas_justificadas,
                COUNT(*) FILTER (WHERE lower(coalesce(pr.estado, '')) = 'reposta')::int AS reposicoes,
                MIN(pr.data_aula) AS primeira_aula,
                MAX(pr.data_aula) AS ultima_aula
            FROM public.presencas pr
            INNER JOIN public.alunos a ON a.id_aluno = pr.id_aluno
            INNER JOIN public.pessoas p ON p.id_pessoa = a.id_pessoa
            LEFT JOIN public.servicos_curriculares s ON s.id_servico = pr.id_servico
            LEFT JOIN public.disciplinas d ON d.id_disciplina = s.id_disciplina
            GROUP BY pr.id_aluno, a.id_user, p.nome, pr.id_servico, d.nome
        $view$;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alunos')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pessoas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pacotes')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_curriculares')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disciplinas')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modalidades')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_extracurriculares')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tipo_servico_extracurricular') THEN
        SELECT column_name
        INTO v_inscricao_curricular_col
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inscricoes'
          AND column_name IN ('id_servico_curricular', 'id_servico', 'id_servicocurricular', 'servico_id', 'id_servicos')
        ORDER BY CASE column_name
            WHEN 'id_servico_curricular' THEN 1
            WHEN 'id_servico' THEN 2
            ELSE 3
        END
        LIMIT 1;

        SELECT column_name
        INTO v_inscricao_extra_col
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inscricoes'
          AND column_name IN ('id_servico_extracurricular', 'id_servico_extra', 'id_servicoextracurricular', 'id_extra', 'id_servico_extra_curricular')
        ORDER BY CASE column_name
            WHEN 'id_servico_extracurricular' THEN 1
            WHEN 'id_servico_extra' THEN 2
            ELSE 3
        END
        LIMIT 1;

        IF v_inscricao_curricular_col IS NULL OR v_inscricao_extra_col IS NULL THEN
            RAISE NOTICE 'vw_inscricoes_detalhe nao criada: colunas de servicos em inscricoes nao existem.';
        ELSE
        EXECUTE format($view$
            CREATE OR REPLACE VIEW public.vw_inscricoes_detalhe AS
            SELECT
                i.id_inscricao,
                i.id_aluno,
                ap.nome AS aluno,
                a.ano,
                a.turma,
                a.escola,
                i.%I AS id_servico_curricular,
                i.%I AS id_servico_extracurricular,
                i.id_pacote,
                pac.nome AS pacote,
                pac.preco AS pacote_preco,
                i.estado,
                i.data_inscricao,
                COALESCE(dc.nome, d_extra.nome, 'Servico') AS servico,
                CASE WHEN i.%I IS NOT NULL THEN 'extracurricular' ELSE 'curricular' END AS tipo_servico,
                COALESCE(mc.nome, me.nome) AS modalidade
            FROM public.inscricoes i
            INNER JOIN public.alunos a ON a.id_aluno = i.id_aluno
            INNER JOIN public.pessoas ap ON ap.id_pessoa = a.id_pessoa
            LEFT JOIN public.pacotes pac ON pac.id_pacote = i.id_pacote
            LEFT JOIN public.servicos_curriculares sc ON sc.id_servico = i.%I
            LEFT JOIN public.disciplinas dc ON dc.id_disciplina = sc.id_disciplina
            LEFT JOIN public.modalidades mc ON mc.id_modalidade = sc.id_modalidade
            LEFT JOIN public.servicos_extracurriculares se ON se.id_servico = i.%I
            LEFT JOIN public.tipo_servico_extracurricular d_extra ON d_extra.id_tipo_servico_extra = se.id_tipo_servico_extra
            LEFT JOIN public.modalidades me ON me.id_modalidade = se.id_modalidade
        $view$,
            v_inscricao_curricular_col,
            v_inscricao_extra_col,
            v_inscricao_extra_col,
            v_inscricao_curricular_col,
            v_inscricao_extra_col
        );
        END IF;
    END IF;
END;
$$;

-- ============================================================
-- Useful constraints and indexes
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'presencas') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS ux_presencas_servico_aluno_data
        ON public.presencas (id_servico, id_aluno, data_aula);

        CREATE INDEX IF NOT EXISTS idx_presencas_aluno_data
        ON public.presencas (id_aluno, data_aula DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_curriculares') THEN
        CREATE INDEX IF NOT EXISTS idx_servicos_curriculares_sala_datas
        ON public.servicos_curriculares (id_sala, data_inicio, data_fim, hora_inicio, hora_fim);

        CREATE INDEX IF NOT EXISTS idx_servicos_curriculares_professor_datas
        ON public.servicos_curriculares (id_professor, data_inicio, data_fim);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inscricoes') THEN
        CREATE INDEX IF NOT EXISTS idx_inscricoes_aluno_estado
        ON public.inscricoes (id_aluno, estado);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alertas_eventos') THEN
        CREATE INDEX IF NOT EXISTS idx_alertas_eventos_user_lido
        ON public.alertas_eventos (id_user, lido, criado_em DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alertas_preferencias_utilizador') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS ux_alertas_preferencias_user_definicao
        ON public.alertas_preferencias_utilizador (id_user, id_alerta_definicao);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logs') THEN
        CREATE INDEX IF NOT EXISTS idx_logs_created_at
        ON public.logs (created_at DESC);
    END IF;
END;
$$;
