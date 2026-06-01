-- Foundation schema for alerts and Firebase push notification tokens.
-- Kept idempotent because startup migrations run on every boot.

CREATE TABLE IF NOT EXISTS public.alertas_definicoes (
    id_alerta_definicao BIGSERIAL PRIMARY KEY,
    grupo TEXT NOT NULL DEFAULT 'sistema',
    codigo TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    icone TEXT,
    canal_app_default BOOLEAN NOT NULL DEFAULT true,
    canal_email_default BOOLEAN NOT NULL DEFAULT false,
    canal_sms_default BOOLEAN NOT NULL DEFAULT false,
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordenacao INTEGER NOT NULL DEFAULT 100,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alertas_preferencias_utilizador (
    id_alerta_preferencia BIGSERIAL PRIMARY KEY,
    id_user INTEGER NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    id_alerta_definicao BIGINT NOT NULL REFERENCES public.alertas_definicoes(id_alerta_definicao) ON DELETE CASCADE,
    canal_app BOOLEAN NOT NULL DEFAULT true,
    canal_email BOOLEAN NOT NULL DEFAULT false,
    canal_sms BOOLEAN NOT NULL DEFAULT false,
    ativo BOOLEAN NOT NULL DEFAULT true,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_alertas_preferencias_user_definicao UNIQUE (id_user, id_alerta_definicao)
);

CREATE TABLE IF NOT EXISTS public.alertas_eventos (
    id_alerta_evento BIGSERIAL PRIMARY KEY,
    id_alerta_definicao BIGINT REFERENCES public.alertas_definicoes(id_alerta_definicao) ON DELETE SET NULL,
    id_user INTEGER NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    canal TEXT NOT NULL DEFAULT 'app' CHECK (canal IN ('app', 'email')),
    titulo TEXT,
    descricao TEXT,
    nivel TEXT NOT NULL DEFAULT 'info',
    payload JSONB,
    lido BOOLEAN NOT NULL DEFAULT false,
    lido_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notificacoes_device_tokens (
    id_notificacao_device_token BIGSERIAL PRIMARY KEY,
    id_user INTEGER NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    plataforma VARCHAR(30) NOT NULL DEFAULT 'web',
    ativo BOOLEAN NOT NULL DEFAULT true,
    ultimo_registo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alertas_definicoes
    ADD COLUMN IF NOT EXISTS grupo TEXT NOT NULL DEFAULT 'sistema',
    ADD COLUMN IF NOT EXISTS codigo TEXT,
    ADD COLUMN IF NOT EXISTS titulo TEXT,
    ADD COLUMN IF NOT EXISTS descricao TEXT,
    ADD COLUMN IF NOT EXISTS icone TEXT,
    ADD COLUMN IF NOT EXISTS canal_app_default BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS canal_email_default BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS canal_sms_default BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ordenacao INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.alertas_preferencias_utilizador
    ADD COLUMN IF NOT EXISTS canal_app BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS canal_email BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS canal_sms BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.alertas_eventos
    ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'app',
    ADD COLUMN IF NOT EXISTS titulo TEXT,
    ADD COLUMN IF NOT EXISTS descricao TEXT,
    ADD COLUMN IF NOT EXISTS nivel TEXT NOT NULL DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS payload JSONB,
    ADD COLUMN IF NOT EXISTS lido BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.notificacoes_device_tokens
    ADD COLUMN IF NOT EXISTS plataforma VARCHAR(30) NOT NULL DEFAULT 'web',
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS ultimo_registo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
    v_constraint record;
BEGIN
    FOR v_constraint IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.alertas_eventos'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%canal%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.alertas_eventos DROP CONSTRAINT IF EXISTS %I',
            v_constraint.conname
        );
    END LOOP;

    ALTER TABLE public.alertas_eventos
        ADD CONSTRAINT chk_alertas_eventos_canal
        CHECK (canal IN ('app', 'email', 'sms'));
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_alertas_definicoes_codigo
ON public.alertas_definicoes (codigo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_notificacoes_device_tokens_token
ON public.notificacoes_device_tokens (token);

CREATE INDEX IF NOT EXISTS idx_alertas_definicoes_grupo_ativo
ON public.alertas_definicoes (grupo, ativo, ordenacao);

CREATE INDEX IF NOT EXISTS idx_alertas_eventos_user_lido
ON public.alertas_eventos (id_user, lido, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_device_tokens_user_ativo
ON public.notificacoes_device_tokens (id_user, ativo, updated_at DESC);

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
    ('financeiro', 'faturas-vencidas', 'Faturas vencidas', 'Avisos sobre faturas vencidas.', 'ReceiptText', true, true, true, true, 10),
    ('financeiro', 'pagamentos-recebidos', 'Pagamentos recebidos', 'Confirmacoes de pagamentos processados.', 'CircleCheck', true, false, false, true, 20),
    ('academico', 'ausencias-alunos', 'Ausencias de alunos', 'Avisos quando uma falta e registada.', 'UserX', true, true, true, true, 30),
    ('academico', 'renovacao-matricula', 'Renovacao da matricula', 'Notificacao sobre renovacao de matricula do aluno.', 'RefreshCcw', true, true, false, true, 40),
    ('sistema', 'manutencao-sistema', 'Manutencao do sistema', 'Avisos de manutencao planeada do sistema.', 'Wrench', true, true, true, true, 50)
ON CONFLICT (codigo) DO NOTHING;
