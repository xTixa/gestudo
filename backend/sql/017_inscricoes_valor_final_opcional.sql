-- Pacotes passaram a poder ser "packs de horas" sem preco fixo (ver 013).
-- inscricoes.valor_final ainda exigia NOT NULL, o que bloqueava a
-- inscricao de alunos em servicos associados a esses pacotes. Passa a
-- aceitar null quando o pacote nao tem preco definido.
ALTER TABLE public.inscricoes ALTER COLUMN valor_final DROP NOT NULL;
