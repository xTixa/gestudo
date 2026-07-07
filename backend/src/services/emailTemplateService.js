import { db } from '../config/db.js';

export const DEFAULT_EMAIL_TEMPLATES = {
    credentials_initial: {
        templateKey: 'credentials_initial',
        name: 'Credenciais iniciais',
        description:
            'Email enviado quando uma conta e criada ou quando e gerada uma password temporaria.',
        subject: 'Bem-vindo ao Bloco de Notas - Password temporaria',
        title: 'Bem-vindo ao portal',
        introText: 'Ola {nome},',
        bodyText:
            'A tua conta foi criada com sucesso.\n\nSegue a tua password temporaria para primeiro acesso: {password_temporaria}\n\nNo primeiro login, vais ser obrigado a definir uma nova password.',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Entrar na plataforma',
        allowedVariables: ['nome', 'email', 'password_temporaria', 'app_url'],
        requiredVariables: ['nome', 'password_temporaria'],
    },
    alert_notification: {
        templateKey: 'alert_notification',
        name: 'Alerta por email',
        description:
            'Email enviado quando uma notificacao tambem deve chegar por email.',
        subject: '{titulo}',
        title: '{titulo}',
        introText: 'Ola {nome},',
        bodyText: '{descricao}',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Abrir no MediaCenter',
        allowedVariables: ['nome', 'titulo', 'descricao', 'link', 'app_url'],
        requiredVariables: ['titulo', 'descricao'],
    },
    session_rescheduled: {
        templateKey: 'session_rescheduled',
        name: 'Sessao reagendada',
        description: 'Email enviado quando uma sessao e reagendada.',
        subject: 'Sessao reagendada - atualizacao de horario',
        title: 'Sessao reagendada',
        introText: 'Ola {nome},',
        bodyText:
            'Informamos que a sessao "{titulo_sessao}" foi reagendada.\n\nAntes: {data_anterior} as {hora_anterior}, sala {sala_anterior}\nAgora: {data_nova} as {hora_nova}, sala {sala_nova}\n\nMotivo: {motivo}',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Ver na plataforma',
        allowedVariables: [
            'nome',
            'titulo_sessao',
            'data_anterior',
            'hora_anterior',
            'sala_anterior',
            'data_nova',
            'hora_nova',
            'sala_nova',
            'motivo',
            'app_url',
        ],
        requiredVariables: ['nome', 'titulo_sessao', 'data_nova', 'hora_nova'],
    },
    reschedule_decision: {
        templateKey: 'reschedule_decision',
        name: 'Decisao de reagendamento',
        description:
            'Email enviado quando um pedido de reagendamento e aprovado ou rejeitado.',
        subject: 'Pedido de reagendamento {decisao}',
        title: 'Pedido {decisao}',
        introText: 'Ola {nome},',
        bodyText:
            'O teu pedido para "{titulo_sessao}" foi {decisao}.\n\nAntes: {data_anterior} as {hora_anterior}, sala {sala_anterior}\nAgora: {data_nova} as {hora_nova}, sala {sala_nova}\n\nMotivo do pedido: {motivo}\nMotivo da decisao: {motivo_decisao}',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Ver na plataforma',
        allowedVariables: [
            'nome',
            'decisao',
            'titulo_sessao',
            'data_anterior',
            'hora_anterior',
            'sala_anterior',
            'data_nova',
            'hora_nova',
            'sala_nova',
            'motivo',
            'motivo_decisao',
            'app_url',
        ],
        requiredVariables: ['nome', 'decisao', 'titulo_sessao'],
    },
    credentials_guardian: {
        templateKey: 'credentials_guardian',
        name: 'Credenciais iniciais - Encarregado de educacao',
        description:
            'Email enviado ao encarregado de educacao quando a conta do aluno e criada, com as credenciais temporarias.',
        subject: 'Conta criada para o seu educando - Credenciais temporarias',
        title: 'Conta criada para o seu educando',
        introText: 'Caro(a) Encarregado(a) de Educacao,',
        bodyText:
            'Foi criada uma conta no MediaCenter para o seu educando {nome}.\n\nPassword temporaria de primeiro acesso: {password_temporaria}\n\nNo primeiro login, o aluno sera obrigado a definir uma nova password. Sera notificado(a) quando essa alteracao for efetuada.',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Aceder a plataforma',
        allowedVariables: ['nome', 'email', 'password_temporaria', 'app_url'],
        requiredVariables: ['nome', 'password_temporaria'],
    },
    password_changed_student: {
        templateKey: 'password_changed_student',
        name: 'Password atualizada - Aluno',
        description:
            'Email enviado ao aluno apos definir a sua nova password no primeiro login.',
        subject: 'Password atualizada - Acesso ao MediaCenter',
        title: 'A tua password foi definida com sucesso',
        introText: 'Ola {nome},',
        bodyText:
            'A tua password de acesso ao MediaCenter foi alterada com sucesso.\n\nPor motivos de seguranca, nao enviamos a nova password por email. Se nao reconheces esta alteracao, contacta o gestor do centro de imediato.',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Entrar na plataforma',
        allowedVariables: ['nome', 'app_url'],
        requiredVariables: ['nome'],
    },
    password_changed_guardian: {
        templateKey: 'password_changed_guardian',
        name: 'Password atualizada - Encarregado de educacao',
        description:
            'Email enviado ao encarregado de educacao quando o aluno define a sua nova password no primeiro login.',
        subject: 'Notificacao: O seu educando definiu uma nova password de acesso',
        title: 'O seu educando atualizou a password de acesso',
        introText: 'Caro(a) Encarregado(a) de Educacao,',
        bodyText:
            'O seu educando {nome} alterou a password de acesso ao MediaCenter.\n\nPor motivos de seguranca, nao enviamos a nova password por email. Se nao reconhece esta alteracao, contacte o gestor do centro de imediato.',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Aceder a plataforma',
        allowedVariables: ['nome', 'app_url'],
        requiredVariables: ['nome'],
    },
    password_recovery: {
        templateKey: 'password_recovery',
        name: 'Recuperacao de password',
        description:
            'Email enviado ao utilizador quando solicita a recuperacao da sua password.',
        subject: 'Recuperacao de password - Acesso temporario ao MediaCenter',
        title: 'Recuperacao de password',
        introText: 'Ola {nome},',
        bodyText:
            'Recebemos um pedido de recuperacao de password para a tua conta.\n\nPassword temporaria de acesso: {password_temporaria}\n\nNo proximo login, ser-te-a pedido que definas uma nova password. Se nao solicitaste esta recuperacao, contacta o gestor do centro de imediato.',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Recuperar acesso',
        allowedVariables: ['nome', 'password_temporaria', 'app_url'],
        requiredVariables: ['nome', 'password_temporaria'],
    },
    password_recovery_guardian: {
        templateKey: 'password_recovery_guardian',
        name: 'Recuperacao de password - Encarregado de educacao',
        description:
            'Email enviado ao encarregado de educacao quando e solicitada a recuperacao de password do aluno.',
        subject: 'Notificacao: Pedido de recuperacao de password do seu educando',
        title: 'Recuperacao de password do educando',
        introText: 'Caro(a) Encarregado(a) de Educacao,',
        bodyText:
            'Foi solicitada uma recuperacao de password para a conta do seu educando {nome}.\n\nPassword temporaria de acesso: {password_temporaria}\n\nNo proximo login, o aluno sera obrigado a definir uma nova password. Se nao reconhece este pedido, contacte o gestor do centro de imediato.',
        footerText:
            'Este email foi enviado automaticamente. Nao respondas a esta mensagem.',
        buttonLabel: 'Aceder a plataforma',
        allowedVariables: ['nome', 'password_temporaria', 'app_url'],
        requiredVariables: ['nome', 'password_temporaria'],
    },
};

const EDITABLE_FIELDS = [
    'subject',
    'title',
    'introText',
    'bodyText',
    'footerText',
    'buttonLabel',
];

function rowToTemplate(row) {
    return {
        templateKey: row.template_key,
        name: row.name,
        description: row.description || '',
        subject: row.subject || '',
        title: row.title || '',
        introText: row.intro_text || '',
        bodyText: row.body_text || '',
        footerText: row.footer_text || '',
        buttonLabel: row.button_label || '',
        allowedVariables: Array.isArray(row.allowed_variables)
            ? row.allowed_variables
            : [],
        requiredVariables: Array.isArray(row.required_variables)
            ? row.required_variables
            : [],
        updatedAt: row.updated_at || null,
        updatedBy: row.updated_by || null,
    };
}

function templateToDbValues(template, updatedBy = null) {
    return [
        template.templateKey,
        template.name,
        template.description,
        template.subject,
        template.title,
        template.introText,
        template.bodyText,
        template.footerText,
        template.buttonLabel,
        JSON.stringify(template.allowedVariables || []),
        JSON.stringify(template.requiredVariables || []),
        updatedBy,
    ];
}

export function listDefaultEmailTemplates() {
    return Object.values(DEFAULT_EMAIL_TEMPLATES);
}

export async function ensureDefaultEmailTemplates() {
    const query = `
        INSERT INTO email_templates (
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
            required_variables,
            updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
        ON CONFLICT (template_key) DO NOTHING
    `;

    for (const template of listDefaultEmailTemplates()) {
        await db.query(query, templateToDbValues(template));
    }
}

export async function listEmailTemplates() {
    await ensureDefaultEmailTemplates();

    const { rows } = await db.query(`
        SELECT *
        FROM email_templates
        ORDER BY name ASC
    `);

    return rows.map(rowToTemplate);
}

export async function getEmailTemplate(templateKey) {
    const fallback = DEFAULT_EMAIL_TEMPLATES[templateKey];
    if (!fallback) {
        return null;
    }

    try {
        await ensureDefaultEmailTemplates();
        const { rows } = await db.query(
            'SELECT * FROM email_templates WHERE template_key = $1',
            [templateKey]
        );

        return rows[0] ? rowToTemplate(rows[0]) : fallback;
    } catch (error) {
        console.warn(
            '[emailTemplateService] A usar template default:',
            error.message
        );
        return fallback;
    }
}

export function extractVariables(text) {
    const variables = new Set();
    const pattern = /\{([a-zA-Z0-9_]+)\}/g;
    let match;

    while ((match = pattern.exec(String(text || ''))) !== null) {
        variables.add(match[1]);
    }

    return [...variables];
}

export function validateTemplatePayload(template, payload) {
    const allowed = new Set(template.allowedVariables || []);
    const required = template.requiredVariables || [];
    const next = {
        ...template,
        ...Object.fromEntries(
            EDITABLE_FIELDS.map((field) => [
                field,
                payload[field] !== undefined
                    ? String(payload[field])
                    : template[field],
            ])
        ),
    };

    const combined = EDITABLE_FIELDS.map((field) => next[field] || '').join(
        '\n'
    );
    const usedVariables = extractVariables(combined);
    const invalidVariables = usedVariables.filter((item) => !allowed.has(item));
    const missingRequiredVariables = required.filter(
        (item) => !usedVariables.includes(item)
    );

    if (!next.subject.trim()) {
        return { ok: false, message: 'O assunto e obrigatorio.' };
    }

    if (!next.title.trim()) {
        return { ok: false, message: 'O titulo e obrigatorio.' };
    }

    if (!next.bodyText.trim()) {
        return { ok: false, message: 'O texto principal e obrigatorio.' };
    }

    if (invalidVariables.length) {
        return {
            ok: false,
            message: `Variaveis nao permitidas: ${invalidVariables
                .map((item) => `{${item}}`)
                .join(', ')}`,
        };
    }

    if (missingRequiredVariables.length) {
        return {
            ok: false,
            message: `Variaveis obrigatorias em falta: ${missingRequiredVariables
                .map((item) => `{${item}}`)
                .join(', ')}`,
        };
    }

    return { ok: true, template: next };
}

export async function updateEmailTemplate(templateKey, payload, updatedBy) {
    const current = await getEmailTemplate(templateKey);
    if (!current) {
        return null;
    }

    const validation = validateTemplatePayload(current, payload);
    if (!validation.ok) {
        const error = new Error(validation.message);
        error.status = 400;
        throw error;
    }

    const next = validation.template;
    const { rows } = await db.query(
        `
            UPDATE email_templates
            SET subject = $2,
                title = $3,
                intro_text = $4,
                body_text = $5,
                footer_text = $6,
                button_label = $7,
                updated_by = $8,
                updated_at = now()
            WHERE template_key = $1
            RETURNING *
        `,
        [
            templateKey,
            next.subject,
            next.title,
            next.introText,
            next.bodyText,
            next.footerText,
            next.buttonLabel,
            updatedBy || null,
        ]
    );

    return rowToTemplate(rows[0]);
}

export async function resetEmailTemplate(templateKey, updatedBy) {
    const defaults = DEFAULT_EMAIL_TEMPLATES[templateKey];
    if (!defaults) {
        return null;
    }

    const { rows } = await db.query(
        `
            INSERT INTO email_templates (
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
                required_variables,
                updated_by
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
            ON CONFLICT (template_key) DO UPDATE
            SET name = EXCLUDED.name,
                description = EXCLUDED.description,
                subject = EXCLUDED.subject,
                title = EXCLUDED.title,
                intro_text = EXCLUDED.intro_text,
                body_text = EXCLUDED.body_text,
                footer_text = EXCLUDED.footer_text,
                button_label = EXCLUDED.button_label,
                allowed_variables = EXCLUDED.allowed_variables,
                required_variables = EXCLUDED.required_variables,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            RETURNING *
        `,
        templateToDbValues(defaults, updatedBy || null)
    );

    return rowToTemplate(rows[0]);
}

export function renderTemplateText(text, variables = {}) {
    return String(text || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
        variables[key] == null ? '' : String(variables[key])
    );
}
