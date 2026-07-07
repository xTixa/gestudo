-- Professor e Sala passam a poder ficar por atribuir na criação de um
-- Serviço Curricular (a atribuir mais tarde). As consultas que listam estes
-- serviços já usam LEFT JOIN para professores/salas, pelo que aceitam bem
-- valores nulos.
ALTER TABLE public.servicos_curriculares ALTER COLUMN id_professor DROP NOT NULL;
ALTER TABLE public.servicos_curriculares ALTER COLUMN id_sala DROP NOT NULL;
