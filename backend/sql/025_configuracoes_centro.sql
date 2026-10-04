-- Configurações do centro guardadas como chave/valor (ex.: cor do tema).
-- Os valores por omissão e a validação ficam no código
-- (src/services/aparenciaService.js); a tabela só guarda o que o gestor mudou.

CREATE TABLE IF NOT EXISTS public.configuracoes_centro (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_by INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
