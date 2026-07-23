-- Cada professor passa a ter uma cor própria e persistida, atribuída no
-- momento do registo, para que a agenda deixe de calcular a cor a partir de
-- um hash do nome (o que causava colisões entre professores diferentes).
ALTER TABLE public.professores ADD COLUMN IF NOT EXISTS cor VARCHAR(7);

-- Atribui cores às linhas já existentes que ainda não têm cor, ciclando pela
-- mesma paleta usada no frontend, por ordem de criação.
WITH paleta (idx, cor) AS (
    VALUES (0, '#14ad81'),
           (1, '#1e3a5f'),
           (2, '#63738c'),
           (3, '#f97316'),
           (4, '#8b5cf6'),
           (5, '#eab308')
),
numerados AS (
    SELECT id_professor,
           ROW_NUMBER() OVER (ORDER BY id_professor) - 1 AS posicao
    FROM public.professores
    WHERE cor IS NULL
)
UPDATE public.professores pr
SET cor = paleta.cor
FROM numerados
JOIN paleta ON paleta.idx = numerados.posicao % 6
WHERE pr.id_professor = numerados.id_professor;
