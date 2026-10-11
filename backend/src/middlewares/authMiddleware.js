import jwt from 'jsonwebtoken';

// Função auxiliar para parsear o header de cookies em um objeto chave-valor
function parseCookieHeader(cookieHeader) {
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return {};
    }

    return cookieHeader.split(';').reduce((acc, part) => {
        const [rawKey, ...rawValue] = part.split('=');
        const key = String(rawKey || '').trim();
        if (!key) {
            return acc;
        }

        acc[key] = decodeURIComponent(rawValue.join('=').trim());
        return acc;
    }, {});
}

/**
 * ========================================
 * AUTH MIDDLEWARE
 * ========================================
 * Extrai informações de autenticação do utilizador
 *
 * Lê o JWT do cookie mc_token ou do header "Authorization: Bearer <jwt>".
 *
 * Resultado:
 * - req.userId, req.userRole e req.tokenVersion (null/0 sem token)
 *
 * Notas:
 * - Só valida a assinatura e a validade do token; NÃO bloqueia pedidos sem
 *   token. As rotas protegidas usam o roleMiddleware/requireSession, que
 *   confirma na BD se a sessão não foi revogada.
 * ========================================
 */

export function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const cookies = parseCookieHeader(req.headers.cookie);
        const tokenFromCookie = cookies.mc_token;
        const tokenFromHeader = authHeader?.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : null;
        const token = tokenFromHeader || tokenFromCookie;

        // Sem token: rota pode ser pública.
        if (!token) {
            req.userId = null;
            req.userRole = null;
            return next();
        }

        const jwtSecret = String(process.env.JWT_SECRET || '').trim();
        if (!jwtSecret) {
            req.userId = null;
            req.userRole = null;
            return res.status(500).json({
                message: 'Configuração de autenticação em falta no servidor.',
            });
        }

        const payload = jwt.verify(token, jwtSecret);
        const userId = Number(payload?.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            req.userId = null;
            req.userRole = null;
            return res.status(401).json({
                message: 'Token de autenticação inválido.',
            });
        }

        req.userId = userId;
        req.userRole = String(payload?.role || '').trim() || null;
        // Comparado com users.token_version no roleMiddleware. Tokens emitidos
        // antes desta funcionalidade não têm "tv" e contam como versão 0.
        req.tokenVersion = Number.isInteger(payload?.tv) ? payload.tv : 0;
        next();
    } catch (error) {
        console.error('Erro no middleware de autenticação:', error.message);
        req.userId = null;
        req.userRole = null;
        return res.status(401).json({
            message: 'Sessão inválida ou expirada. Faça login novamente.',
        });
    }
}
