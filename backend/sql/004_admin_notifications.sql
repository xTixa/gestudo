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
    ('sistema', 'limpeza-dados-massa', 'Limpeza de dados em massa', 'Aviso quando é executada uma limpeza de dados em massa.', 'Trash2', true, true, false, true, 70)
ON CONFLICT (codigo) DO NOTHING;
