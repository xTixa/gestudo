-- Gestão financeira (fase 1): mensalidades por aluno e pagamentos.
--
-- Uma mensalidade = o que um aluno deve num mês, paga pelo encarregado de
-- educação. Tem uma linha por serviço (ex.: Matemática 50€ + Inglês 60€).
-- O estado pendente/parcial/paga/vencida é calculado a partir dos pagamentos;
-- só "anulada" é guardado explicitamente.
-- Idempotente: as migrações correm em cada arranque.

CREATE TABLE IF NOT EXISTS public.mensalidades (
    id_mensalidade BIGSERIAL PRIMARY KEY,
    id_aluno INTEGER NOT NULL REFERENCES public.alunos(id_aluno) ON DELETE RESTRICT,
    id_encarregado INTEGER REFERENCES public.encarregados(id_encarregado) ON DELETE SET NULL,
    mes_referencia DATE NOT NULL CHECK (EXTRACT(DAY FROM mes_referencia) = 1),
    data_vencimento DATE NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
    anulada BOOLEAN NOT NULL DEFAULT false,
    motivo_anulacao TEXT,
    observacoes TEXT,
    criado_por INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Só pode existir uma mensalidade ativa (não anulada) por aluno e mês.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mensalidades_aluno_mes_ativa
ON public.mensalidades (id_aluno, mes_referencia)
WHERE anulada = false;

CREATE INDEX IF NOT EXISTS idx_mensalidades_mes
ON public.mensalidades (mes_referencia);

CREATE TABLE IF NOT EXISTS public.mensalidade_linhas (
    id_linha BIGSERIAL PRIMARY KEY,
    id_mensalidade BIGINT NOT NULL REFERENCES public.mensalidades(id_mensalidade) ON DELETE CASCADE,
    id_inscricao INTEGER REFERENCES public.inscricoes(id_inscricao) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    ordem INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mensalidade_linhas_mensalidade
ON public.mensalidade_linhas (id_mensalidade);

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id_pagamento BIGSERIAL PRIMARY KEY,
    id_mensalidade BIGINT NOT NULL REFERENCES public.mensalidades(id_mensalidade) ON DELETE RESTRICT,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
    data_pagamento DATE NOT NULL,
    metodo TEXT NOT NULL CHECK (metodo IN ('numerario', 'transferencia', 'mbway', 'multibanco', 'cartao', 'outro')),
    referencia TEXT,
    observacoes TEXT,
    anulado BOOLEAN NOT NULL DEFAULT false,
    motivo_anulacao TEXT,
    registado_por INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_mensalidade
ON public.pagamentos (id_mensalidade);

CREATE INDEX IF NOT EXISTS idx_pagamentos_data
ON public.pagamentos (data_pagamento);

-- Estado calculado de cada mensalidade (usado por listagens e resumos).
CREATE OR REPLACE VIEW public.vw_mensalidades_estado AS
SELECT
    m.id_mensalidade,
    m.id_aluno,
    m.id_encarregado,
    m.mes_referencia,
    m.data_vencimento,
    m.valor_total,
    m.anulada,
    COALESCE(pg.valor_pago, 0)::numeric(10, 2) AS valor_pago,
    GREATEST(m.valor_total - COALESCE(pg.valor_pago, 0), 0)::numeric(10, 2) AS valor_em_divida,
    CASE
        WHEN m.anulada THEN 'anulada'
        WHEN COALESCE(pg.valor_pago, 0) >= m.valor_total THEN 'paga'
        WHEN m.data_vencimento < CURRENT_DATE THEN 'vencida'
        WHEN COALESCE(pg.valor_pago, 0) > 0 THEN 'parcial'
        ELSE 'pendente'
    END AS estado,
    pg.ultimo_pagamento
FROM public.mensalidades m
LEFT JOIN (
    SELECT
        id_mensalidade,
        SUM(valor) AS valor_pago,
        MAX(data_pagamento) AS ultimo_pagamento
    FROM public.pagamentos
    WHERE anulado = false
    GROUP BY id_mensalidade
) pg ON pg.id_mensalidade = m.id_mensalidade;

-- updated_at e auditoria (mesmo padrão das restantes tabelas).
DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['mensalidades', 'pagamentos']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I', v_table, v_table);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at()',
            v_table,
            v_table
        );
    END LOOP;

    DROP TRIGGER IF EXISTS trg_mensalidades_audit ON public.mensalidades;
    CREATE TRIGGER trg_mensalidades_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.mensalidades
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('mensalidades', 'id_mensalidade', 'info');

    DROP TRIGGER IF EXISTS trg_pagamentos_audit ON public.pagamentos;
    CREATE TRIGGER trg_pagamentos_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('pagamentos', 'id_pagamento', 'info');
END;
$$;
