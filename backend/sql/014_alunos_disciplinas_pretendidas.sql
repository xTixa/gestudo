-- A ficha do aluno so mostrava disciplinas quando ja existia um servico
-- curricular associado (via inscricoes). Nao havia forma de registar que um
-- aluno pretende uma disciplina antes de lhe ser atribuido um servico
-- concreto (professor/sala/horario). Esta coluna guarda essa lista, editavel
-- pelo gestor na ficha do aluno, como um array JSON de strings (nomes de
-- disciplina).
ALTER TABLE public.alunos
    ADD COLUMN IF NOT EXISTS disciplinas_pretendidas JSONB NOT NULL DEFAULT '[]'::jsonb;
