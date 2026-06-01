import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import {
    getEmailTemplate,
    renderTemplateText,
} from './emailTemplateService.js';

/**
 * Serviço de Email
 * Envia emails com password temporária para novos professores e alunos registados no painel de administração.
 * Envia emails de reagendamento de sessões para alunos e professores.
 */

let transporter = null;
let transporterConfigKey = null;
let transporterVerified = false;
let cloudinaryConfigured = false;

// Função auxiliar para validar se uma string é não vazia
function isNonEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

// Configura o Cloudinary se as variáveis de ambiente necessárias estiverem presentes
function configureCloudinaryIfNeeded() {
    if (cloudinaryConfigured) {
        return;
    }

    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

    if (!cloudName || !apiKey || !apiSecret) {
        return;
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    cloudinaryConfigured = true;
}

// Resolve a URL do logo a ser usado nos emails, considerando variáveis de ambiente e fallback para o logo local
function resolveEmailLogoUrl(appUrl) {
    const explicitUrl = String(process.env.EMAIL_LOGO_URL || '').trim();
    if (isNonEmpty(explicitUrl)) {
        return explicitUrl;
    }

    const logoPublicId = String(
        process.env.EMAIL_LOGO_PUBLIC_ID ||
            process.env.CLOUDINARY_LOGO_PUBLIC_ID ||
            ''
    ).trim();

    if (isNonEmpty(logoPublicId)) {
        configureCloudinaryIfNeeded();

        if (cloudinaryConfigured) {
            return cloudinary.url(logoPublicId, {
                secure: true,
                transformation: [
                    {
                        width: 220,
                        crop: 'limit',
                        fetch_format: 'auto',
                        quality: 'auto',
                    },
                ],
            });
        }

        const cloudName = String(
            process.env.CLOUDINARY_CLOUD_NAME || ''
        ).trim();
        if (cloudName) {
            return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_limit,w_220/${encodeURIComponent(logoPublicId)}.png`;
        }
    }

    return `${appUrl}/logo.png`;
}

// Obtém configuração de email a partir das variáveis de ambiente, com validação e mensagens de erro detalhadas
function getEmailConfig() {
    const host =
        String(process.env.EMAIL_HOST || '').trim() || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT || 587);
    const secure =
        String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true';
    const allowSelfSigned =
        String(process.env.EMAIL_ALLOW_SELF_SIGNED || '').toLowerCase() ===
        'true';
    const user = String(process.env.EMAIL_USER || '').trim();
    const pass = String(process.env.EMAIL_PASSWORD || '').trim();
    const from =
        String(process.env.EMAIL_FROM || '').trim() ||
        `"MediaCenter" <${user}>`;
    const appUrl = String(
        process.env.APP_URL || 'http://localhost:5173'
    ).trim();
    const logoUrl = resolveEmailLogoUrl(appUrl);

    const isPlaceholderUser =
        !user || user.toLowerCase() === 'seu_email@gmail.com';
    const isPlaceholderPass =
        !pass || pass.toLowerCase() === 'sua_senha_de_app';

    const errors = [];
    if (!host) errors.push('EMAIL_HOST em falta');
    if (!Number.isFinite(port) || port <= 0) errors.push('EMAIL_PORT inválido');
    if (isPlaceholderUser) errors.push('EMAIL_USER não configurado');
    if (isPlaceholderPass) errors.push('EMAIL_PASSWORD não configurado');

    return {
        host,
        port,
        secure,
        allowSelfSigned,
        user,
        pass,
        from,
        appUrl,
        logoUrl,
        valid: errors.length === 0,
        errorMessage: errors.join('; '),
    };
}

// Gera uma chave única para a configuração atual do transporter, usada para determinar se é necessário criar um novo transporter
function getConfigKey(cfg) {
    return `${cfg.host}|${cfg.port}|${cfg.secure}|${cfg.allowSelfSigned}|${cfg.user}|${cfg.from}`;
}

// Obtém um transporter SMTP verificado, criando um novo se a configuração tiver mudado ou se ainda não tiver sido verificado
async function getVerifiedTransporter() {
    const cfg = getEmailConfig();

    if (!cfg.valid) {
        return {
            ok: false,
            error: `Configuração SMTP inválida: ${cfg.errorMessage}`,
            appUrl: cfg.appUrl,
            from: cfg.from,
            logoUrl: cfg.logoUrl,
        };
    }

    const nextKey = getConfigKey(cfg);

    if (!transporter || transporterConfigKey !== nextKey) {
        transporter = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: {
                user: cfg.user,
                pass: cfg.pass,
            },
            tls: {
                rejectUnauthorized: !cfg.allowSelfSigned,
            },
        });
        transporterConfigKey = nextKey;
        transporterVerified = false;
    }

    if (!transporterVerified) {
        try {
            await transporter.verify();
            transporterVerified = true;
        } catch (error) {
            return {
                ok: false,
                error: `Falha na verificação SMTP: ${error?.message || 'erro desconhecido'}`,
                appUrl: cfg.appUrl,
                from: cfg.from,
                logoUrl: cfg.logoUrl,
            };
        }
    }

    return {
        ok: true,
        transporter,
        appUrl: cfg.appUrl,
        from: cfg.from,
        logoUrl: cfg.logoUrl,
    };
}

function renderManagedEmailHtml({ template, variables, logoUrl, buttonUrl }) {
    const paragraphs = [
        renderTemplateText(template.introText, variables),
        renderTemplateText(template.bodyText, variables),
    ]
        .join('\n\n')
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map(
            (paragraph) =>
                `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`
        )
        .join('');

    const footerText = renderTemplateText(template.footerText, variables);
    const buttonLabel = renderTemplateText(template.buttonLabel, variables);
    const safeButtonUrl = String(buttonUrl || variables.app_url || '').trim();

    return `
        <html dir="ltr" lang="pt">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <style>
                    body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif; }
                    .wrapper { padding: 24px 12px; }
                    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
                    .header { background: #88C488; color: #f8fafc; padding: 24px; }
                    .brand-logo { display: block; height: 42px; width: auto; margin: 0 0 10px; }
                    .header h1 { margin: 12px 0 6px; font-size: 24px; line-height: 1.25; }
                    .content { padding: 24px; }
                    .content p { margin: 0 0 14px; line-height: 1.6; color: #334155; }
                    .button { display: inline-block; margin: 8px 0 14px; background: #0f172a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 11px 18px; border-radius: 10px; border: 1px solid #0f172a; }
                    .footer { border-top: 1px solid #e2e8f0; padding: 16px 24px 20px; background: #f8fafc; }
                    .footer p { margin: 0 0 6px; font-size: 12px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="container">
                        <div class="header">
                            <img src="${escapeHtml(logoUrl)}" alt="MediaCenter" class="brand-logo" />
                            <h1>${escapeHtml(renderTemplateText(template.title, variables))}</h1>
                        </div>
                        <div class="content">
                            ${paragraphs}
                            ${
                                buttonLabel && safeButtonUrl
                                    ? `<a href="${escapeHtml(safeButtonUrl)}" class="button">${escapeHtml(buttonLabel)}</a>`
                                    : ''
                            }
                        </div>
                        <div class="footer">
                            <p>MediaCenter - Bloco de Notas</p>
                            ${
                                footerText
                                    ? `<p>${escapeHtml(footerText)}</p>`
                                    : ''
                            }
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `;
}

async function sendManagedTemplateEmail({
    transporter,
    from,
    to,
    templateKey,
    variables,
    logoUrl,
    buttonUrl,
    priority = '3',
}) {
    const template = await getEmailTemplate(templateKey);
    const subject =
        renderTemplateText(template?.subject || 'MediaCenter', variables) ||
        'MediaCenter';
    const html = renderManagedEmailHtml({
        template,
        variables,
        logoUrl,
        buttonUrl,
    });
    const text = [
        renderTemplateText(template.title, variables),
        renderTemplateText(template.introText, variables),
        renderTemplateText(template.bodyText, variables),
        buttonUrl,
        renderTemplateText(template.footerText, variables),
    ]
        .filter(Boolean)
        .join('\n\n');

    return transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
        headers: {
            'X-Priority': priority,
            'X-MSMail-Priority': priority === '1' ? 'High' : 'Normal',
        },
    });
}

/**
 * Envia email com credenciais temporárias para novo utilizador
 * @param {string} nome - Nome do utilizador
 * @param {string} email - Email do utilizador
 * @param {string} temporaryPassword - Password temporária em plaintext
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function enviarEmailCredenciaisIniciais(
    nome,
    email,
    temporaryPassword
) {
    try {
        const transporterResult = await getVerifiedTransporter();

        if (!transporterResult.ok) {
            console.error(
                'Envio de email desativado/indisponível:',
                transporterResult.error
            );
            return { ok: false, error: transporterResult.error };
        }

        const {
            appUrl,
            from,
            logoUrl,
            transporter: currentTransporter,
        } = transporterResult;

        const managedResponse = await sendManagedTemplateEmail({
            transporter: currentTransporter,
            from,
            to: email,
            templateKey: 'credentials_initial',
            variables: {
                nome,
                email,
                password_temporaria: temporaryPassword,
                app_url: appUrl,
            },
            logoUrl,
            buttonUrl: `${appUrl}/login`,
        });

        console.log(`Email enviado para ${email}:`, managedResponse.messageId);
        return { ok: true };

        const htmlContent = `
            <html dir="ltr" lang="pt">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #f8fafc;
                            color: #0f172a;
                            font-family: 'Segoe UI', Arial, sans-serif;
                        }
                        .wrapper {
                            padding: 24px 12px;
                        }
                        .container {
                            max-width: 620px;
                            margin: 0 auto;
                            background: #ffffff;
                            border: 1px solid #e2e8f0;
                            border-radius: 18px;
                            overflow: hidden;
                            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
                        }
                        .header {
                            background: #88C488;
                            color: #f8fafc;
                            padding: 24px;
                        }
                        .brand-logo {
                            display: block;
                            height: 42px;
                            width: auto;
                            margin: 0 0 10px;
                        }
                        .header h1 {
                            margin: 12px 0 6px;
                            font-size: 24px;
                            line-height: 1.25;
                        }
                        .header p {
                            margin: 0;
                            color: #cbd5e1;
                            font-size: 14px;
                        }
                        .content {
                            padding: 24px;
                        }
                        .content p {
                            margin: 0 0 14px;
                            line-height: 1.6;
                            color: #334155;
                        }
                        .password-card {
                            background: #f0fdf4;
                            border: 1px solid #bef264;
                            border-radius: 12px;
                            padding: 14px;
                            margin: 14px 0;
                            text-align: center;
                        }
                        .password-label {
                            display: block;
                            font-size: 12px;
                            color: #3f6212;
                            margin-bottom: 8px;
                            text-transform: uppercase;
                            letter-spacing: 0.06em;
                            font-weight: 700;
                        }
                        .password-value {
                            font-family: 'Consolas', 'Courier New', monospace;
                            font-size: 20px;
                            font-weight: 700;
                            color: #14532d;
                            word-break: break-all;
                        }
                        .warning {
                            background: #fffbeb;
                            border: 1px solid #fcd34d;
                            border-left: 4px solid #f59e0b;
                            border-radius: 10px;
                            padding: 12px 14px;
                            margin: 16px 0;
                            color: #78350f;
                            font-size: 14px;
                        }
                        .button {
                            display: inline-block;
                            margin: 8px 0 14px;
                            background: #0f172a;
                            color: #ffffff !important;
                            text-decoration: none;
                            font-weight: 700;
                            font-size: 14px;
                            padding: 11px 18px;
                            border-radius: 10px;
                            border: 1px solid #0f172a;
                        }
                        .steps {
                            margin: 10px 0 0;
                            padding-left: 18px;
                            color: #334155;
                        }
                        .steps li {
                            margin: 6px 0;
                            line-height: 1.45;
                        }
                        .footer {
                            border-top: 1px solid #e2e8f0;
                            padding: 16px 24px 20px;
                            background: #f8fafc;
                        }
                        .footer p {
                            margin: 0 0 6px;
                            font-size: 12px;
                            color: #64748b;
                        }
                    </style>
                </head>
                <body>
                    <div class="wrapper">
                        <div class="container">
                            <div class="header">
                                <img src="${escapeHtml(logoUrl)}" alt="MediaCenter" class="brand-logo" />
                                <h1>Bem-vindo ao portal</h1>
                                <p>A tua conta foi criada com sucesso.</p>
                            </div>

                            <div class="content">
                                <p>Olá ${escapeHtml(nome)},</p>
                                <p>
                                    Segue a tua password temporária para primeiro acesso.
                                </p>

                                <div class="password-card">
                                    <span class="password-label">Password temporária</span>
                                    <span class="password-value">${escapeHtml(temporaryPassword)}</span>
                                </div>

                                <div class="warning">
                                    <strong>Importante:</strong> no primeiro login, vais ser obrigado a definir uma nova password.
                                </div>

                                <a href="${appUrl}/login" class="button">Entrar na plataforma</a>

                                <p><strong>Passos rápidos:</strong></p>
                                <ol class="steps">
                                    <li>Entrar com o teu email e esta password temporária.</li>
                                    <li>Alterar a password quando for pedido.</li>
                                    <li>Concluir o acesso e começar a usar o sistema.</li>
                                </ol>

                                <p>Se precisares de ajuda, contacta o gestor do centro.</p>
                            </div>

                            <div class="footer">
                                <p>MediaCenter · Bloco de Notas</p>
                                <p>Este email foi enviado automaticamente. Não respondas a esta mensagem.</p>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const response = await currentTransporter.sendMail({
            from,
            to: email,
            subject: 'Bem-vindo ao Bloco de Notas - Password Temporária',
            html: htmlContent,
            headers: {
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal',
            },
        });

        console.log(`Email enviado para ${email}:`, response.messageId);
        return { ok: true };
    } catch (error) {
        console.error('Erro ao enviar email:', error.message);
        return {
            ok: false,
            error: error?.message || 'Falha no envio de email',
        };
    }
}

/**
 * Compatibilidade retroativa para código antigo.
 */
export async function enviarEmailAlerta({
    email,
    nome,
    titulo,
    descricao,
    nivel = 'info',
    link,
}) {
    try {
        const targetEmail = String(email || '').trim();
        if (!targetEmail) {
            return { ok: false, skipped: true, error: 'Email indisponivel' };
        }

        const transporterResult = await getVerifiedTransporter();

        if (!transporterResult.ok) {
            console.error(
                'Envio de email de alerta desativado/indisponivel:',
                transporterResult.error
            );
            return { ok: false, error: transporterResult.error };
        }

        const {
            appUrl,
            from,
            logoUrl,
            transporter: currentTransporter,
        } = transporterResult;
        const resolvedLink = resolveEmailLink(link, appUrl);
        const safeTitle = String(titulo || 'Nova notificacao').trim();
        const safeDescription = String(descricao || '').trim();
        const accentColor = getAlertAccentColor(nivel);

        const managedResponse = await sendManagedTemplateEmail({
            transporter: currentTransporter,
            from,
            to: targetEmail,
            templateKey: 'alert_notification',
            variables: {
                nome: nome || 'utilizador',
                titulo: safeTitle,
                descricao:
                    safeDescription ||
                    'Tem uma nova notificacao no MediaCenter.',
                link: resolvedLink,
                app_url: appUrl,
            },
            logoUrl,
            buttonUrl: resolvedLink,
            priority: nivel === 'danger' ? '1' : '3',
        });

        console.log(
            `Email de alerta enviado para ${targetEmail}:`,
            managedResponse.messageId
        );
        return { ok: true };

        const htmlContent = `
            <html dir="ltr" lang="pt">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <style>
                        body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif; }
                        .wrapper { padding: 24px 12px; }
                        .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
                        .header { background: ${accentColor}; color: #ffffff; padding: 22px 24px; }
                        .brand-logo { display: block; height: 38px; width: auto; margin: 0 0 12px; }
                        .header h1 { margin: 0; font-size: 22px; line-height: 1.3; }
                        .content { padding: 24px; }
                        .content p { margin: 0 0 14px; line-height: 1.6; color: #334155; }
                        .alert-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${accentColor}; border-radius: 10px; padding: 14px; margin: 14px 0 18px; }
                        .button { display: inline-block; background: #0f172a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 11px 18px; border-radius: 10px; }
                        .footer { border-top: 1px solid #e2e8f0; padding: 16px 24px 20px; background: #f8fafc; }
                        .footer p { margin: 0 0 6px; font-size: 12px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <div class="wrapper">
                        <div class="container">
                            <div class="header">
                                <img src="${escapeHtml(logoUrl)}" alt="MediaCenter" class="brand-logo" />
                                <h1>${escapeHtml(safeTitle)}</h1>
                            </div>
                            <div class="content">
                                <p>Ola ${escapeHtml(nome || 'utilizador')},</p>
                                <div class="alert-box">
                                    <p>${escapeHtml(safeDescription || 'Tem uma nova notificacao no MediaCenter.')}</p>
                                </div>
                                <a href="${escapeHtml(resolvedLink)}" class="button">Abrir no MediaCenter</a>
                            </div>
                            <div class="footer">
                                <p>MediaCenter</p>
                                <p>Este email foi enviado automaticamente. Nao respondas a esta mensagem.</p>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const response = await currentTransporter.sendMail({
            from,
            to: targetEmail,
            subject: safeTitle,
            html: htmlContent,
            text: `${safeTitle}\n\n${safeDescription}\n\n${resolvedLink}`,
            headers: {
                'X-Priority': nivel === 'danger' ? '1' : '3',
                'X-MSMail-Priority': nivel === 'danger' ? 'High' : 'Normal',
            },
        });

        console.log(
            `Email de alerta enviado para ${targetEmail}:`,
            response.messageId
        );
        return { ok: true };
    } catch (error) {
        console.error('Erro ao enviar email de alerta:', error.message);
        return {
            ok: false,
            error: error?.message || 'Falha no envio de email de alerta',
        };
    }
}

export async function enviarEmailPasswordTemporaria(
    nome,
    email,
    temporaryPassword
) {
    return enviarEmailCredenciaisIniciais(nome, email, temporaryPassword);
}

export async function enviarEmailReagendamentoSessao({
    nome,
    email,
    tituloSessao,
    dataAnterior,
    horaAnterior,
    salaAnterior,
    dataNova,
    horaNova,
    salaNova,
    motivo,
}) {
    try {
        const transporterResult = await getVerifiedTransporter();

        if (!transporterResult.ok) {
            console.error(
                'Envio de email desativado/indisponível:',
                transporterResult.error
            );
            return { ok: false, error: transporterResult.error };
        }

        const {
            appUrl,
            from,
            logoUrl,
            transporter: currentTransporter,
        } = transporterResult;

        const titulo = String(tituloSessao || 'Sessão').trim();
        const nomeDest = String(nome || '').trim() || 'Utilizador';
        const motivoLabel = String(motivo || '').trim() || 'Não indicado';
        const dataAnteriorLabel = String(dataAnterior || '').trim() || '-';
        const horaAnteriorLabel = String(horaAnterior || '').trim() || '-';
        const salaAnteriorLabel = String(salaAnterior || '').trim() || '-';
        const dataNovaLabel = String(dataNova || '').trim() || '-';
        const horaNovaLabel = String(horaNova || '').trim() || '-';
        const salaNovaLabel = String(salaNova || '').trim() || '-';

        const managedResponse = await sendManagedTemplateEmail({
            transporter: currentTransporter,
            from,
            to: email,
            templateKey: 'session_rescheduled',
            variables: {
                nome: nomeDest,
                titulo_sessao: titulo,
                data_anterior: dataAnteriorLabel,
                hora_anterior: horaAnteriorLabel,
                sala_anterior: salaAnteriorLabel,
                data_nova: dataNovaLabel,
                hora_nova: horaNovaLabel,
                sala_nova: salaNovaLabel,
                motivo: motivoLabel,
                app_url: appUrl,
            },
            logoUrl,
            buttonUrl: appUrl,
        });

        console.log(
            `Email de reagendamento enviado para ${email}:`,
            managedResponse.messageId
        );
        return { ok: true };

        const htmlContent = `
            <html dir="ltr" lang="pt">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #f8fafc;
                            color: #0f172a;
                            font-family: 'Segoe UI', Arial, sans-serif;
                        }
                        .wrapper {
                            padding: 24px 12px;
                        }
                        .container {
                            max-width: 620px;
                            margin: 0 auto;
                            background: #ffffff;
                            border: 1px solid #e2e8f0;
                            border-radius: 18px;
                            overflow: hidden;
                            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
                        }
                        .header {
                            background: #88C488;
                            color: #f8fafc;
                            padding: 24px;
                        }
                        .brand-logo {
                            display: block;
                            height: 42px;
                            width: auto;
                            margin: 0 0 10px;
                        }
                        .header h1 {
                            margin: 12px 0 6px;
                            font-size: 24px;
                            line-height: 1.25;
                        }
                        .content {
                            padding: 24px;
                        }
                        .content p {
                            margin: 0 0 14px;
                            line-height: 1.6;
                            color: #334155;
                        }
                        .grid {
                            display: grid;
                            grid-template-columns: 1fr;
                            gap: 12px;
                        }
                        .card {
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 12px;
                            background: #f8fafc;
                        }
                        .label {
                            display: block;
                            font-size: 11px;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 0.06em;
                            margin-bottom: 4px;
                            font-weight: 700;
                        }
                        .value {
                            color: #0f172a;
                            font-weight: 600;
                            font-size: 14px;
                        }
                        .reason {
                            margin-top: 14px;
                            border-left: 3px solid #38bdf8;
                            background: #f0f9ff;
                            border-radius: 8px;
                            padding: 10px 12px;
                            color: #0c4a6e;
                            font-size: 14px;
                        }
                        .button {
                            display: inline-block;
                            margin: 14px 0 0;
                            background: #0f172a;
                            color: #ffffff !important;
                            text-decoration: none;
                            font-weight: 700;
                            font-size: 14px;
                            padding: 11px 18px;
                            border-radius: 10px;
                            border: 1px solid #0f172a;
                        }
                        .footer {
                            border-top: 1px solid #e2e8f0;
                            padding: 16px 24px 20px;
                            background: #f8fafc;
                        }
                        .footer p {
                            margin: 0 0 6px;
                            font-size: 12px;
                            color: #64748b;
                        }
                    </style>
                </head>
                <body>
                    <div class="wrapper">
                        <div class="container">
                            <div class="header">
                                <img src="${escapeHtml(logoUrl)}" alt="MediaCenter" class="brand-logo" />
                                <h1>Sessão reagendada</h1>
                                <p>${escapeHtml(titulo)}</p>
                            </div>

                            <div class="content">
                                <p>Olá ${escapeHtml(nomeDest)},</p>
                                <p>
                                    Informamos que a sessão foi reagendada. Consulta abaixo os detalhes da alteração.
                                </p>

                                <div class="grid">
                                    <div class="card">
                                        <span class="label">Antes</span>
                                        <div class="value">${escapeHtml(dataAnteriorLabel)} · ${escapeHtml(horaAnteriorLabel)} · ${escapeHtml(salaAnteriorLabel)}</div>
                                    </div>
                                    <div class="card">
                                        <span class="label">Agora</span>
                                        <div class="value">${escapeHtml(dataNovaLabel)} · ${escapeHtml(horaNovaLabel)} · ${escapeHtml(salaNovaLabel)}</div>
                                    </div>
                                </div>

                                <div class="reason">
                                    <strong>Motivo:</strong> ${escapeHtml(motivoLabel)}
                                </div>

                                <a href="${appUrl}" class="button">Ver na plataforma</a>
                            </div>

                            <div class="footer">
                                <p>MediaCenter · Bloco de Notas</p>
                                <p>Este email foi enviado automaticamente. Não respondas a esta mensagem.</p>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const response = await currentTransporter.sendMail({
            from,
            to: email,
            subject: 'Sessão reagendada - atualização de horário',
            html: htmlContent,
            headers: {
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal',
            },
        });

        console.log(
            `Email de reagendamento enviado para ${email}:`,
            response.messageId
        );
        return { ok: true };
    } catch (error) {
        console.error('Erro ao enviar email de reagendamento:', error.message);
        return {
            ok: false,
            error: error?.message || 'Falha no envio de email',
        };
    }
}

export async function enviarEmailDecisaoReagendamento({
    nome,
    email,
    estado,
    tituloSessao,
    dataAnterior,
    horaAnterior,
    salaAnterior,
    dataNova,
    horaNova,
    salaNova,
    motivo,
    motivoDecisao,
}) {
    try {
        const transporterResult = await getVerifiedTransporter();

        if (!transporterResult.ok) {
            console.error(
                'Envio de email desativado/indisponível:',
                transporterResult.error
            );
            return { ok: false, error: transporterResult.error };
        }

        const {
            appUrl,
            from,
            logoUrl,
            transporter: currentTransporter,
        } = transporterResult;

        const estadoNormalizado = String(estado || '')
            .trim()
            .toLowerCase();
        const titulo = String(tituloSessao || 'Sessão').trim();
        const nomeDest = String(nome || '').trim() || 'Utilizador';
        const motivoLabel = String(motivo || '').trim() || 'Não indicado';
        const motivoDecisaoLabel =
            String(motivoDecisao || '').trim() || 'Sem motivo adicional';

        const dataAnteriorLabel = String(dataAnterior || '').trim() || '-';
        const horaAnteriorLabel = String(horaAnterior || '').trim() || '-';
        const salaAnteriorLabel = String(salaAnterior || '').trim() || '-';
        const dataNovaLabel = String(dataNova || '').trim() || '-';
        const horaNovaLabel = String(horaNova || '').trim() || '-';
        const salaNovaLabel = String(salaNova || '').trim() || '-';

        const aprovado = estadoNormalizado === 'aprovado';
        const managedResponse = await sendManagedTemplateEmail({
            transporter: currentTransporter,
            from,
            to: email,
            templateKey: 'reschedule_decision',
            variables: {
                nome: nomeDest,
                decisao: aprovado ? 'aprovado' : 'rejeitado',
                titulo_sessao: titulo,
                data_anterior: dataAnteriorLabel,
                hora_anterior: horaAnteriorLabel,
                sala_anterior: salaAnteriorLabel,
                data_nova: aprovado ? dataNovaLabel : '-',
                hora_nova: aprovado ? horaNovaLabel : '-',
                sala_nova: aprovado ? salaNovaLabel : '-',
                motivo: motivoLabel,
                motivo_decisao: motivoDecisaoLabel,
                app_url: appUrl,
            },
            logoUrl,
            buttonUrl: appUrl,
        });

        console.log(
            `Email de decisao de reagendamento enviado para ${email}:`,
            managedResponse.messageId
        );
        return { ok: true };
        const assunto = aprovado
            ? 'Pedido de reagendamento aprovado'
            : 'Pedido de reagendamento rejeitado';
        const tituloPrincipal = aprovado
            ? 'Pedido aprovado'
            : 'Pedido rejeitado';
        const mensagemPrincipal = aprovado
            ? 'O teu pedido foi aprovado e a sessão foi reagendada.'
            : 'O teu pedido de reagendamento foi rejeitado.';

        const htmlContent = `
            <html dir="ltr" lang="pt">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <style>
                        body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif; }
                        .wrapper { padding: 24px 12px; }
                        .container { max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
                        .header { background: #88C488; color: #f8fafc; padding: 24px; }
                        .brand-logo { display: block; height: 42px; width: auto; margin: 0 0 10px; }
                        .header h1 { margin: 12px 0 6px; font-size: 24px; line-height: 1.25; }
                        .content { padding: 24px; }
                        .content p { margin: 0 0 14px; line-height: 1.6; color: #334155; }
                        .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
                        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc; }
                        .label { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; font-weight: 700; }
                        .value { color: #0f172a; font-weight: 600; font-size: 14px; }
                        .reason { margin-top: 14px; border-left: 3px solid ${aprovado ? '#10b981' : '#f59e0b'}; background: ${aprovado ? '#ecfdf5' : '#fffbeb'}; border-radius: 8px; padding: 10px 12px; color: ${aprovado ? '#065f46' : '#78350f'}; font-size: 14px; }
                        .decision { margin: 16px 0; border: 1px solid ${aprovado ? '#86efac' : '#fcd34d'}; background: ${aprovado ? '#f0fdf4' : '#fffbeb'}; border-radius: 12px; padding: 14px; }
                        .button { display: inline-block; margin: 14px 0 0; background: #0f172a; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 11px 18px; border-radius: 10px; border: 1px solid #0f172a; }
                        .footer { border-top: 1px solid #e2e8f0; padding: 16px 24px 20px; background: #f8fafc; }
                        .footer p { margin: 0 0 6px; font-size: 12px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <div class="wrapper">
                        <div class="container">
                            <div class="header">
                                <img src="${escapeHtml(logoUrl)}" alt="MediaCenter" class="brand-logo" />
                                <h1>${escapeHtml(tituloPrincipal)}</h1>
                                <p>${escapeHtml(titulo)}</p>
                            </div>

                            <div class="content">
                                <p>Olá ${escapeHtml(nomeDest)},</p>
                                <p>${escapeHtml(mensagemPrincipal)}</p>

                                <div class="decision">
                                    <strong>Decisão:</strong> ${escapeHtml(aprovado ? 'Aprovado' : 'Rejeitado')}
                                </div>

                                <div class="grid">
                                    <div class="card">
                                        <span class="label">Antes</span>
                                        <div class="value">${escapeHtml(dataAnteriorLabel)} · ${escapeHtml(horaAnteriorLabel)} · ${escapeHtml(salaAnteriorLabel)}</div>
                                    </div>
                                    ${
                                        aprovado
                                            ? `
                                    <div class="card">
                                        <span class="label">Agora</span>
                                        <div class="value">${escapeHtml(dataNovaLabel)} · ${escapeHtml(horaNovaLabel)} · ${escapeHtml(salaNovaLabel)}</div>
                                    </div>
                                    `
                                            : ''
                                    }
                                </div>

                                <div class="reason">
                                    <strong>Motivo do pedido:</strong> ${escapeHtml(motivoLabel)}<br/>
                                    <strong>Motivo da decisão:</strong> ${escapeHtml(motivoDecisaoLabel)}
                                </div>

                                <a href="${appUrl}" class="button">Ver na plataforma</a>
                            </div>

                            <div class="footer">
                                <p>MediaCenter · Bloco de Notas</p>
                                <p>Este email foi enviado automaticamente. Não respondas a esta mensagem.</p>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const response = await currentTransporter.sendMail({
            from,
            to: email,
            subject: assunto,
            html: htmlContent,
            headers: {
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal',
            },
        });

        console.log(
            `Email de decisão de reagendamento enviado para ${email}:`,
            response.messageId
        );
        return { ok: true };
    } catch (error) {
        console.error(
            'Erro ao enviar email de decisão de reagendamento:',
            error.message
        );
        return {
            ok: false,
            error: error?.message || 'Falha no envio de email',
        };
    }
}

function resolveEmailLink(link, appUrl) {
    const normalizedLink = String(link || '').trim();
    const baseUrl = String(appUrl || 'http://localhost:5173').trim();

    if (!normalizedLink) {
        return baseUrl;
    }

    if (/^https?:\/\//i.test(normalizedLink)) {
        return normalizedLink;
    }

    try {
        return new URL(normalizedLink, baseUrl).toString();
    } catch {
        return baseUrl;
    }
}

function getAlertAccentColor(nivel) {
    const normalized = String(nivel || 'info').trim().toLowerCase();

    if (normalized === 'danger' || normalized === 'critical') {
        return '#dc2626';
    }

    if (normalized === 'warning' || normalized === 'alert') {
        return '#d97706';
    }

    if (normalized === 'success') {
        return '#16a34a';
    }

    return '#2563eb';
}

/**
 * Função auxiliar para escapar HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text || '').replace(/[&<>"']/g, (m) => map[m]);
}
