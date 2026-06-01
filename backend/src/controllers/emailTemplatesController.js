import {
    getEmailTemplate,
    listEmailTemplates,
    renderTemplateText,
    resetEmailTemplate,
    updateEmailTemplate,
} from '../services/emailTemplateService.js';

const SAMPLE_VARIABLES = {
    nome: 'Maria Silva',
    email: 'maria@example.com',
    password_temporaria: 'Temp1234!',
    titulo: 'Aviso importante',
    descricao: 'Existe uma nova informacao disponivel no MediaCenter.',
    link: 'http://localhost:5173',
    app_url: 'http://localhost:5173',
    titulo_sessao: 'Portugues - Individual',
    data_anterior: '12/05/2026',
    hora_anterior: '15:00',
    sala_anterior: 'Sala 2',
    data_nova: '13/05/2026',
    hora_nova: '16:00',
    sala_nova: 'Sala 1',
    motivo: 'Indisponibilidade pontual.',
    motivo_decisao: 'Horario confirmado pelo gestor.',
    decisao: 'aprovado',
};

function withPreview(template) {
    return {
        ...template,
        preview: {
            subject: renderTemplateText(template.subject, SAMPLE_VARIABLES),
            title: renderTemplateText(template.title, SAMPLE_VARIABLES),
            introText: renderTemplateText(template.introText, SAMPLE_VARIABLES),
            bodyText: renderTemplateText(template.bodyText, SAMPLE_VARIABLES),
            footerText: renderTemplateText(
                template.footerText,
                SAMPLE_VARIABLES
            ),
            buttonLabel: renderTemplateText(
                template.buttonLabel,
                SAMPLE_VARIABLES
            ),
        },
    };
}

export async function listarEmailTemplates(req, res) {
    try {
        const templates = await listEmailTemplates();
        return res.json({ templates: templates.map(withPreview) });
    } catch (error) {
        console.error('Erro ao listar templates de email:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao listar templates de email.' });
    }
}

export async function obterEmailTemplate(req, res) {
    try {
        const template = await getEmailTemplate(req.params.key);

        if (!template) {
            return res
                .status(404)
                .json({ message: 'Template de email nao encontrado.' });
        }

        return res.json({ template: withPreview(template) });
    } catch (error) {
        console.error('Erro ao obter template de email:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao obter template de email.' });
    }
}

export async function atualizarEmailTemplate(req, res) {
    try {
        const template = await updateEmailTemplate(
            req.params.key,
            req.body || {},
            req.userId ?? null
        );

        if (!template) {
            return res
                .status(404)
                .json({ message: 'Template de email nao encontrado.' });
        }

        return res.json({ template: withPreview(template) });
    } catch (error) {
        console.error('Erro ao atualizar template de email:', error);
        return res.status(error.status || 500).json({
            message:
                error.message || 'Erro ao atualizar template de email.',
        });
    }
}

export async function reporEmailTemplate(req, res) {
    try {
        const template = await resetEmailTemplate(
            req.params.key,
            req.userId ?? null
        );

        if (!template) {
            return res
                .status(404)
                .json({ message: 'Template de email nao encontrado.' });
        }

        return res.json({ template: withPreview(template) });
    } catch (error) {
        console.error('Erro ao repor template de email:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao repor template de email.' });
    }
}
