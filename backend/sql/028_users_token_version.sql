-- Versão das sessões de cada utilizador. Vai dentro do JWT (campo "tv") e é
-- comparada em cada pedido autenticado: incrementá-la invalida todos os
-- tokens emitidos antes (mudança/redefinição de password, reposição pelo gestor).
-- Tokens antigos sem "tv" contam como versão 0, por isso continuam válidos
-- até à primeira mudança.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
