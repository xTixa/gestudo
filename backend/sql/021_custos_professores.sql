-- Custos com professores: valor por hora (por modalidade) e fecho mensal.
--
-- Uma sessão conta para pagamento quando o professor marcou presenças nesse
-- dia do serviço. O valor/hora vem de tarifas_professores: primeiro a tarifa
-- específica do professor para a modalidade, senão a tarifa geral
-- (id_professor NULL) dessa modalidade.
--
-- "Fechar o mês" grava uma cópia (linhas) das sessões e valores, para que
-- alterações posteriores às tarifas não mudem pagamentos já fechados.
-- Idempotente: as migrações correm em cada arranque.

CREATE TABLE IF NOT EXISTS public.tarifas_professores (
    id_tarifa BIGSERIAL PRIMARY KEY,
    id_professor INTEGER REFERENCES public.professores(id_professor) ON DELETE CASCADE,
    id_modalidade INTEGER NOT NULL REFERENCES public.modalidades(id_modalidade) ON DELETE CASCADE,
    valor_hora NUMERIC(10, 2) NOT NULL CHECK (valor_hora >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma tarifa geral por modalidade e uma por professor+modalidade.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tarifas_professores_modalidade
ON public.tarifas_professores (COALESCE(id_professor, 0), id_modalidade);

CREATE TABLE IF NOT EXISTS public.pagamentos_professores (
    id_pagamento_professor BIGSERIAL PRIMARY KEY,
    id_professor INTEGER NOT NULL REFERENCES public.professores(id_professor) ON DELETE RESTRICT,
    mes_referencia DATE NOT NULL CHECK (EXTRACT(DAY FROM mes_referencia) = 1),
    sessoes INTEGER NOT NULL DEFAULT 0,
    minutos INTEGER NOT NULL DEFAULT 0,
    valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
    pago BOOLEAN NOT NULL DEFAULT false,
    data_pagamento DATE,
    metodo TEXT CHECK (metodo IS NULL OR metodo IN ('numerario', 'transferencia', 'mbway', 'multibanco', 'cartao', 'outro')),
    referencia TEXT,
    observacoes TEXT,
    anulado BOOLEAN NOT NULL DEFAULT false,
    motivo_anulacao TEXT,
    fechado_por INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (NOT pago OR data_pagamento IS NOT NULL)
);

-- Só um fecho ativo (não anulado) por professor e mês.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pagamentos_professores_mes_ativo
ON public.pagamentos_professores (id_professor, mes_referencia)
WHERE anulado = false;

CREATE INDEX IF NOT EXISTS idx_pagamentos_professores_mes
ON public.pagamentos_professores (mes_referencia);

CREATE TABLE IF NOT EXISTS public.pagamento_professor_linhas (
    id_linha BIGSERIAL PRIMARY KEY,
    id_pagamento_professor BIGINT NOT NULL REFERENCES public.pagamentos_professores(id_pagamento_professor) ON DELETE CASCADE,
    id_servico INTEGER,
    data_aula DATE NOT NULL,
    hora_inicio TEXT,
    minutos INTEGER NOT NULL CHECK (minutos >= 0),
    descricao TEXT NOT NULL,
    modalidade TEXT,
    valor_hora NUMERIC(10, 2) NOT NULL,
    valor NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagamento_professor_linhas_pagamento
ON public.pagamento_professor_linhas (id_pagamento_professor);

DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['tarifas_professores', 'pagamentos_professores']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I', v_table, v_table);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at()',
            v_table,
            v_table
        );
    END LOOP;

    DROP TRIGGER IF EXISTS trg_tarifas_professores_audit ON public.tarifas_professores;
    CREATE TRIGGER trg_tarifas_professores_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.tarifas_professores
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('tarifas_professores', 'id_tarifa', 'info');

    DROP TRIGGER IF EXISTS trg_pagamentos_professores_audit ON public.pagamentos_professores;
    CREATE TRIGGER trg_pagamentos_professores_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_professores
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change('pagamentos_professores', 'id_pagamento_professor', 'info');
END;
$$;
