-- Mensagens internas: conversas (1:1 ou em grupo) entre gestores,
-- professores, alunos e encarregados.
--
-- O estado de leitura é guardado por participante como o id da última
-- mensagem lida, por isso "não lidas" = mensagens de outros com id maior.

CREATE TABLE IF NOT EXISTS public.conversas (
    id_conversa BIGSERIAL PRIMARY KEY,
    assunto TEXT CHECK (assunto IS NULL OR char_length(assunto) <= 150),
    criada_por INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    ultima_mensagem_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversa_participantes (
    id_conversa BIGINT NOT NULL REFERENCES public.conversas(id_conversa) ON DELETE CASCADE,
    id_user INTEGER NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    ultima_lida_id BIGINT NOT NULL DEFAULT 0,
    arquivada BOOLEAN NOT NULL DEFAULT false,
    entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_conversa, id_user)
);

CREATE INDEX IF NOT EXISTS idx_conversa_participantes_user
ON public.conversa_participantes (id_user, arquivada);

CREATE TABLE IF NOT EXISTS public.mensagens (
    id_mensagem BIGSERIAL PRIMARY KEY,
    id_conversa BIGINT NOT NULL REFERENCES public.conversas(id_conversa) ON DELETE CASCADE,
    id_autor INTEGER REFERENCES public.users(id_user) ON DELETE SET NULL,
    corpo TEXT NOT NULL CHECK (char_length(btrim(corpo)) BETWEEN 1 AND 5000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa
ON public.mensagens (id_conversa, id_mensagem DESC);

-- Nome a mostrar de cada utilizador (os gestores não têm registo em pessoas).
CREATE OR REPLACE VIEW public.vw_utilizadores_nome AS
SELECT
    u.id_user,
    LOWER(COALESCE(u.role, '')) AS papel,
    u.status,
    CASE
        WHEN LOWER(COALESCE(u.role, '')) = 'gestor' THEN 'Gestão do centro'
        ELSE COALESCE(
            NULLIF(TRIM(pa.nome), ''),
            NULLIF(TRIM(pp.nome), ''),
            NULLIF(TRIM(pe.nome), ''),
            u.email
        )
    END AS nome
FROM public.users u
LEFT JOIN public.alunos a ON a.id_user = u.id_user
LEFT JOIN public.pessoas pa ON pa.id_pessoa = a.id_pessoa
LEFT JOIN public.professores pr ON pr.id_user = u.id_user
LEFT JOIN public.pessoas pp ON pp.id_pessoa = pr.id_pessoa
LEFT JOIN public.encarregados e ON e.id_user = u.id_user
LEFT JOIN public.pessoas pe ON pe.id_pessoa = e.id_pessoa;

-- Que professor dá que serviço a que aluno (inscrições ativas). Define quem
-- pode trocar mensagens. A parte extracurricular só é incluída se a coluna
-- existir, para a migração não falhar em instalações com schema diferente.
DO $$
DECLARE
    v_tem_extra boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inscricoes'
          AND column_name = 'id_servico_extracurricular'
    ) INTO v_tem_extra;

    EXECUTE $v$
        CREATE OR REPLACE VIEW public.vw_relacoes_professor_aluno AS
        SELECT i.id_aluno, s.id_professor, COALESCE(d.nome, s.tipo, 'Explicação') AS servico
        FROM public.inscricoes i
        INNER JOIN public.servicos_curriculares s ON s.id_servico = i.id_servico_curricular
        LEFT JOIN public.disciplinas d ON d.id_disciplina = s.id_disciplina
        WHERE LOWER(COALESCE(i.estado, '')) = 'ativa'
          AND COALESCE(s.ativo, true) = true
          AND s.id_professor IS NOT NULL
    $v$ || CASE WHEN v_tem_extra THEN $v$
        UNION ALL
        SELECT i.id_aluno, se.id_professor, COALESCE(tse.nome, se.tipo, 'Atividade') AS servico
        FROM public.inscricoes i
        INNER JOIN public.servicos_extracurriculares se ON se.id_servico = i.id_servico_extracurricular
        LEFT JOIN public.tipo_servico_extracurricular tse ON tse.id_tipo_servico_extra = se.id_tipo_servico_extra
        WHERE LOWER(COALESCE(i.estado, '')) = 'ativa'
          AND COALESCE(se.ativo, true) = true
          AND se.id_professor IS NOT NULL
    $v$ ELSE '' END;
END;
$$;

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
    ('sistema', 'mensagens-por-ler', 'Mensagens por ler', 'Resumo diário por email das mensagens que ainda não leu.', 'Bell', false, true, false, true, 50)
ON CONFLICT (codigo) DO NOTHING;
