-- Tarefas agendadas (lembretes, mensalidades, limpeza de logs).
--
-- Cada execução fica registada com a tarefa e o período a que diz respeito
-- (ex.: '2026-09-30' para tarefas diárias, '2026-10' para mensais). A chave
-- única garante que cada período corre uma só vez, mesmo com várias
-- instâncias da API ou reinícios a meio do dia.

CREATE TABLE IF NOT EXISTS public.tarefas_agendadas_execucoes (
    id_execucao BIGSERIAL PRIMARY KEY,
    tarefa TEXT NOT NULL,
    periodo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'a_correr'
        CHECK (estado IN ('a_correr', 'concluida', 'falhou')),
    tentativas INTEGER NOT NULL DEFAULT 1,
    manual BOOLEAN NOT NULL DEFAULT false,
    iniciado_por INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    resultado JSONB,
    erro TEXT,
    iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terminado_em TIMESTAMPTZ,
    CONSTRAINT ux_tarefas_agendadas_tarefa_periodo UNIQUE (tarefa, periodo)
);

CREATE INDEX IF NOT EXISTS idx_tarefas_agendadas_tarefa_inicio
ON public.tarefas_agendadas_execucoes (tarefa, iniciado_em DESC);

INSERT INTO public.alertas_definicoes (
    grupo,
    codigo,
    titulo,
    descricao,
    icone,
    canal_app_default,
    canal_email_default,
    canal_sms_default,
    ativo,
    ordenacao
)
VALUES
    ('financeiro', 'mensalidade-a-vencer', 'Mensalidade a vencer', 'Lembrete alguns dias antes do vencimento de uma mensalidade por pagar.', 'CalendarClock', true, true, false, true, 15),
    ('academico', 'lembrete-aulas', 'Lembrete de aulas', 'Resumo das aulas do dia seguinte.', 'BellRing', true, false, false, true, 35),
    ('sistema', 'tarefas-automaticas', 'Tarefas automáticas', 'Resumo do que as tarefas automáticas fizeram (mensalidades geradas, vencidas, falhas).', 'MonitorCog', true, false, false, true, 80)
ON CONFLICT (codigo) DO NOTHING;
