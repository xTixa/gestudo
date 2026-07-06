-- A inscricao publica recolhe nivel de ensino, data de inicio real,
-- observacoes e autorizacao de saida, mas integrarInscricaoAprovada() nunca
-- os copiava para a tabela alunos, pelo que desapareciam da ficha do aluno
-- depois da aprovacao. Estas colunas passam a guardar esses dados a partir
-- de agora (inscricoes ja aprovadas antes desta migracao nao tem como ser
-- recuperadas, pois o dado nunca foi persistido fora de inscricoes_publicas).
ALTER TABLE public.alunos
    ADD COLUMN IF NOT EXISTS nivel_ensino TEXT,
    ADD COLUMN IF NOT EXISTS data_inicio DATE,
    ADD COLUMN IF NOT EXISTS observacoes TEXT,
    ADD COLUMN IF NOT EXISTS aut_saida_nome_1 TEXT,
    ADD COLUMN IF NOT EXISTS aut_saida_parentesco_1 TEXT,
    ADD COLUMN IF NOT EXISTS aut_saida_nome_2 TEXT,
    ADD COLUMN IF NOT EXISTS aut_saida_parentesco_2 TEXT;
