-- Guarda os textos e labels visiveis do formulario publico de inscricao
-- (frontend/src/pages/Infos/enrollment.jsx), para que o gestor os possa editar
-- em /gestor/configuracoes sem precisar de alterar codigo. O seed dos valores
-- por omissao fica no service (inscricaoFormTextosService.js), nao aqui,
-- para ter uma unica fonte de verdade em JS que tambem serve de fallback.
CREATE TABLE IF NOT EXISTS public.inscricao_form_textos (
    text_key TEXT PRIMARY KEY,
    secao TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_by BIGINT NULL REFERENCES public.users(id_user) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
