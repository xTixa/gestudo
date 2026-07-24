-- Alert definitions for events the gestor (admin) should always be aware of.
-- Kept idempotent because startup migrations run on every boot.

INSERT INTO public.alertas_definicoes (
    grupo,
    codigo,
    titulo,
    descricao,
    icone,
    canal_app_default,
    canal_email_default,
    canal_sms_default,
    ativo,
    ordenacao
)
VALUES
    ('sistema', 'criacao-conta', 'Criação de conta', 'Notificação quando uma nova conta de professor ou aluno é criada.', 'UserPlus', true, false, false, true, 60),
    ('sistema', 'limpeza-dados-massa', 'Limpeza de dados em massa', 'Aviso quando é executada uma limpeza de dados em massa.', 'Trash2', true, true, false, true, 70),
    ('operacional', 'reagendamento-pendente', 'Novo pedido de reagendamento', 'Um professor submeteu um novo pedido de reagendamento de sessão.', 'CalendarClock', true, true, false, true, 85),
    ('operacional', 'alteracao-perfil-pendente', 'Novo pedido de alteração de perfil', 'Um aluno submeteu um pedido de alteração ao seu perfil que aguarda aprovação do gestor.', 'UserCog', true, true, false, true, 86)
ON CONFLICT (codigo) DO NOTHING;

-- Instalações onde este ficheiro já correu antes de o email ter sido ligado
-- para reagendamentos pendentes: liga o canal agora (idempotente).
UPDATE public.alertas_definicoes
SET canal_email_default = true
WHERE codigo = 'reagendamento-pendente' AND canal_email_default = false;
