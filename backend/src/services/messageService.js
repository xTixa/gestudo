function getMessageWebhookConfig() {
    const url = String(
        process.env.MESSAGE_WEBHOOK_URL || process.env.SMS_WEBHOOK_URL || ''
    ).trim();
    const token = String(
        process.env.MESSAGE_WEBHOOK_TOKEN || process.env.SMS_WEBHOOK_TOKEN || ''
    ).trim();

    return { url, token };
}

function normalizePhone(value) {
    return String(value || '')
        .trim()
        .replace(/[^\d+]/g, '');
}

export async function enviarMensagemAlerta({
    telefone,
    nome,
    titulo,
    descricao,
    payload,
}) {
    const to = normalizePhone(telefone);
    if (!to) {
        return { ok: false, skipped: true, reason: 'phone_unavailable' };
    }

    const { url, token } = getMessageWebhookConfig();
    if (!url) {
        return {
            ok: false,
            skipped: true,
            reason: 'message_webhook_not_configured',
        };
    }

    const body = {
        to,
        name: nome || '',
        title: titulo || 'Nova notificacao',
        message: descricao || '',
        payload: payload || null,
    };

    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
            ok: false,
            status: response.status,
            error: text || response.statusText,
        };
    }

    return { ok: true };
}
