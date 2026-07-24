-- Ao criar um pacote no catalogo, preco e modalidade deixaram de ser
-- obrigatorios (o gestor pode querer registar o pacote antes de definir
-- estes detalhes). id_disciplina ja era opcional.
ALTER TABLE public.pacotes ALTER COLUMN preco DROP NOT NULL;
ALTER TABLE public.pacotes ALTER COLUMN id_modalidade DROP NOT NULL;

-- Esta constraint exigia exatamente um de id_disciplina/id_area
-- preenchido, impedindo pacotes sem disciplina (o formulario nem tem
-- campo de area). Removida para permitir ambos em branco.
ALTER TABLE public.pacotes DROP CONSTRAINT IF EXISTS pacotes_disciplina_ou_area_check;
