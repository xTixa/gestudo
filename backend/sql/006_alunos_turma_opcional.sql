-- A inscricao publica nem sempre chega com turma definida (o formulario
-- publico nao recolhe este campo), pelo que aprovar a inscricao falhava com
-- "campo obrigatorio em falta (turma)" quando a coluna era NOT NULL.
-- Turma pode ser atribuida mais tarde pelo gestor na ficha do aluno.
ALTER TABLE public.alunos ALTER COLUMN turma DROP NOT NULL;
