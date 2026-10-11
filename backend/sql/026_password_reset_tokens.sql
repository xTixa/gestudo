-- Recuperação de password por link de uso único.
--
-- Guarda-se só o hash SHA-256 do token: quem ler a tabela não consegue
-- usar os links. A password só muda quando o link é usado, por isso um
-- pedido de recuperação feito por outra pessoa já não bloqueia a conta.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id_token BIGSERIAL PRIMARY KEY,
    id_user INTEGER NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_ativos
ON public.password_reset_tokens (id_user, created_at DESC)
WHERE used_at IS NULL;

-- Os modelos antigos enviavam uma password temporária ({password_temporaria}),
-- que deixou de existir neste fluxo. Ao apagá-los, a API volta a criá-los
-- com os textos novos (ensureDefaultEmailTemplates).
DELETE FROM public.email_templates
WHERE template_key IN ('password_recovery', 'password_recovery_guardian');
