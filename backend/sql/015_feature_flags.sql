-- Tabela genérica de feature flags, para o gestor poder ligar/desligar
-- funcionalidades visíveis aos alunos sem precisar de alterar código.
-- Segue o mesmo padrão de inscricao_form_textos (seed via service, tabela
-- só guarda o estado atual).
CREATE TABLE IF NOT EXISTS public.feature_flags (
    flag_key TEXT PRIMARY KEY,
    ativo BOOLEAN NOT NULL DEFAULT true,
    updated_by BIGINT NULL REFERENCES public.users(id_user) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
