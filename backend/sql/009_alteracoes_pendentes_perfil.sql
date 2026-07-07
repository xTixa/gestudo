-- Alterações que um aluno faz ao próprio perfil ficam pendentes de aprovação
-- do gestor em vez de serem gravadas de imediato (pedido: alunos não devem
-- poder alterar os seus dados sem revisão).
CREATE TABLE IF NOT EXISTS public.alteracoes_pendentes_perfil (
    id_alteracao SERIAL PRIMARY KEY,
    id_aluno INTEGER NOT NULL REFERENCES public.alunos(id_aluno) ON DELETE CASCADE,
    dados_propostos JSONB NOT NULL,
    dados_anteriores JSONB,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    revisto_por INTEGER REFERENCES public.users(id_user),
    revisto_em TIMESTAMPTZ,
    motivo_rejeicao TEXT
);

CREATE INDEX IF NOT EXISTS idx_alteracoes_pendentes_perfil_aluno
    ON public.alteracoes_pendentes_perfil(id_aluno);

CREATE INDEX IF NOT EXISTS idx_alteracoes_pendentes_perfil_estado
    ON public.alteracoes_pendentes_perfil(estado);
