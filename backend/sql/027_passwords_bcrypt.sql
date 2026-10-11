-- Converte as passwords antigas guardadas em texto simples para bcrypt.
-- O login deixa de aceitar passwords que não sejam hash bcrypt ($2a/$2b/$2y).
-- O pgcrypto gera hashes "$2a$", que o bcryptjs valida sem alterações.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.users
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password <> ''
  AND password NOT LIKE '$2%';
