-- Perfil de utilizador "encarregado" (encarregado de educação).
--
-- Até aqui a constraint users_role_check só aceitava gestor/aluno/professor,
-- pelo que as contas criadas para encarregados ficavam com role 'aluno' sem
-- aluno associado (e eram expulsas da área do aluno). Esta migração é
-- idempotente: corre em cada arranque sem efeitos repetidos.

DO $$
DECLARE
    current_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
    INTO current_def
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    INNER JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND c.conname = 'users_role_check';

    IF current_def IS NOT NULL AND current_def NOT LIKE '%encarregado%' THEN
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
        current_def := NULL;
    END IF;

    IF current_def IS NULL THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('gestor', 'aluno', 'professor', 'encarregado'));
    END IF;
END $$;

-- Contas de encarregado criadas antes deste perfil existir: estão ligadas a
-- um registo em encarregados, têm role 'aluno' e não são alunos.
UPDATE public.users u
SET role = 'encarregado'
WHERE u.role = 'aluno'
  AND EXISTS (SELECT 1 FROM public.encarregados e WHERE e.id_user = u.id_user)
  AND NOT EXISTS (SELECT 1 FROM public.alunos a WHERE a.id_user = u.id_user);
