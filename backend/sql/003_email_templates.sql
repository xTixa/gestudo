CREATE TABLE IF NOT EXISTS public.email_templates (
    template_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    intro_text TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    footer_text TEXT NOT NULL DEFAULT '',
    button_label TEXT NOT NULL DEFAULT '',
    allowed_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by BIGINT NULL REFERENCES public.users(id_user) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_updated_at
ON public.email_templates (updated_at DESC);

INSERT INTO public.email_templates (
    template_key,
    name,
    description,
    subject,
    title,
    intro_text,
    body_text,
    footer_text,
    button_label,
    allowed_variables,
    required_variables
)
VALUES
(
    'credentials_initial',
    'Credenciais iniciais',
    'Email enviado quando uma conta e criada ou quando e gerada uma password temporaria.',
    'Bem-vindo ao Bloco de Notas - Password temporaria',
    'Bem-vindo ao portal',
    'Ola {nome},',
    'A tua conta foi criada com sucesso.

Segue a tua password temporaria para primeiro acesso: {password_temporaria}

No primeiro login, vais ser obrigado a definir uma nova password.',
    'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
    'Entrar na plataforma',
    '["nome", "email", "password_temporaria", "app_url"]'::jsonb,
    '["nome", "password_temporaria"]'::jsonb
),
(
    'alert_notification',
    'Alerta por email',
    'Email enviado quando uma notificacao tambem deve chegar por email.',
    '{titulo}',
    '{titulo}',
    'Ola {nome},',
    '{descricao}',
    'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
    'Abrir no MediaCenter',
    '["nome", "titulo", "descricao", "link", "app_url"]'::jsonb,
    '["titulo", "descricao"]'::jsonb
),
(
    'session_rescheduled',
    'Sessao reagendada',
    'Email enviado quando uma sessao e reagendada.',
    'Sessao reagendada - atualizacao de horario',
    'Sessao reagendada',
    'Ola {nome},',
    'Informamos que a sessao "{titulo_sessao}" foi reagendada.

Antes: {data_anterior} as {hora_anterior}, sala {sala_anterior}
Agora: {data_nova} as {hora_nova}, sala {sala_nova}

Motivo: {motivo}',
    'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
    'Ver na plataforma',
    '["nome", "titulo_sessao", "data_anterior", "hora_anterior", "sala_anterior", "data_nova", "hora_nova", "sala_nova", "motivo", "app_url"]'::jsonb,
    '["nome", "titulo_sessao", "data_nova", "hora_nova"]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;
