import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'mc_csrf';

function parseAllowedOrigins(rawOrigins) {
    return String(rawOrigins || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function resolveAllowedOrigins() {
    const explicitOrigins = parseAllowedOrigins(
        process.env.CORS_ALLOWED_ORIGINS
    );
    if (explicitOrigins.length > 0) {
        return explicitOrigins;
    }

    const frontendUrl = String(process.env.FRONTEND_URL || '').trim();
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        return frontendUrl ? [frontendUrl] : [];
    }

    return [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5000',
        ...(frontendUrl ? [frontendUrl] : []),
    ];
}

export function parseCookieHeader(cookieHeader) {
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

export function createCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

function getCsrfCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: false,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
        maxAge: Number(
            process.env.JWT_COOKIE_MAX_AGE_MS || 12 * 60 * 60 * 1000
        ),
    };
}

export function setCsrfCookie(res, token) {
    res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
}

export function clearCsrfCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(CSRF_COOKIE_NAME, {
        httpOnly: false,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
    });
}

export function ensureCsrfCookie(req, res) {
    const cookies = parseCookieHeader(req.headers.cookie);
    const existingToken = cookies[CSRF_COOKIE_NAME];

    if (existingToken) {
        return existingToken;
    }

    const nextToken = createCsrfToken();
    setCsrfCookie(res, nextToken);
    return nextToken;
}
/**
 * ========================================
 * SECURITY & RATE LIMITING MIDDLEWARE
 * ========================================
 * Proteção contra ataques: rate limiting, CORS, headers de segurança
 *
 * Uso em server.js:
 * --------
 * app.use(corsMiddleware());
 * app.use(securityHeadersMiddleware());
 * app.use(rateLimitMiddleware(100, 15));  // 100 reqs por 15 min
 *
 * ========================================
 */

/**
 * CORS Middleware - Permite requisições de origem cruzada
 * Retorna: Access-Control-Allow-* headers
 *
 * Security: Restringe origem a domínios permitidos
 */
export function corsMiddleware() {
    const allowedOrigins = resolveAllowedOrigins();
    const allowedOriginSet = new Set(allowedOrigins);

    return (req, res, next) => {
        const origin = req.headers.origin;

        res.setHeader('Vary', 'Origin');

        // Permitir sempre OPTIONS para evitar bloqueios de preflight
        if (req.method === 'OPTIONS') {
            if (origin && allowedOriginSet.has(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }

            res.setHeader(
                'Access-Control-Allow-Methods',
                'GET, POST, PATCH, DELETE, OPTIONS'
            );
            res.setHeader(
                'Access-Control-Allow-Headers',
                'Content-Type, Authorization, X-User-Id, X-CSRF-Token'
            );
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            return res.sendStatus(200);
        }

        // Para pedidos normais
        if (origin && allowedOriginSet.has(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        } else if (origin) {
            return res.status(403).json({
                message: 'Origem não permitida por política CORS.',
            });
        }

        next();
    };
}

export function csrfProtectionMiddleware(options = {}) {
    const ignoredPaths = new Set([
        '/api/auth/login',
        '/api/auth/recuperar-password',
        '/api/auth/csrf-token',
        '/api/health',
        ...(Array.isArray(options.ignoredPaths) ? options.ignoredPaths : []),
    ]);

    const protectedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

    return (req, res, next) => {
        if (!protectedMethods.has(req.method)) {
            return next();
        }

        if (ignoredPaths.has(req.path)) {
            return next();
        }

        const cookies = parseCookieHeader(req.headers.cookie);
        const authCookie = cookies.mc_token;

        // Apenas aplica CSRF quando a sessão está a usar cookie auth.
        if (!authCookie) {
            return next();
        }

        const csrfCookie = cookies[CSRF_COOKIE_NAME];
        const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();

        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return res.status(403).json({
                message: 'Validação CSRF falhou.',
            });
        }

        return next();
    };
}

/**
 * Security Headers Middleware - Protege contra vulnerabilidades comuns
 * Define headers de segurança padrão HTTP
 */
export function securityHeadersMiddleware() {
    return (req, res, next) => {
        // Proteção contra clickjacking (X-Frame-Options)
        res.setHeader('X-Frame-Options', 'DENY');

        // Proteção contra MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Proteção contra XSS
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Content Security Policy (simples)
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'"
        );

        // Referrer Policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions Policy (antes Feature-Policy)
        res.setHeader(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=()'
        );

        // HTTP Strict Transport Security (para HTTPS)
        if (process.env.NODE_ENV === 'production') {
            res.setHeader(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains'
            );
        }

        next();
    };
}

/**
 * Rate Limiting Middleware - Limita requisições por IP
 * Protege contra brute force, DoS
 *
 * @param {number} requestsPerWindow - Quantidade máxima de requisições
 * @param {number} windowMinutes - Janela de tempo em minutos
 *
 * Uso: app.use(rateLimitMiddleware(100, 15))  // 100 reqs por 15 min
 */
export function rateLimitMiddleware(
    requestsPerWindow = 100,
    windowMinutes = 15
) {
    const store = new Map();

    const windowMs = windowMinutes * 60 * 1000;

    return (req, res, next) => {
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        // Obter histórico de requisições do cliente
        if (!store.has(clientIP)) {
            store.set(clientIP, []);
        }

        const requests = store.get(clientIP);

        // Remover requisições fora da janela de tempo
        const recentRequests = requests.filter(
            (timestamp) => now - timestamp < windowMs
        );
        store.set(clientIP, recentRequests);

        // Verificar se ultrapassou o limite
        if (recentRequests.length >= requestsPerWindow) {
            const resetTime = new Date(Math.min(...recentRequests) + windowMs);

            return res.status(429).json({
                error: 'Muitas requisições',
                message:
                    'Você fez demasiadas requisições. Tente novamente mais tarde.',
                retryAfter: Math.ceil((resetTime - now) / 1000),
                resetTime: resetTime.toISOString(),
            });
        }

        // Adicionar requisição atual ao histórico
        recentRequests.push(now);
        store.set(clientIP, recentRequests);

        // Headers informativos
        res.setHeader('RateLimit-Limit', requestsPerWindow);
        res.setHeader(
            'RateLimit-Remaining',
            requestsPerWindow - recentRequests.length
        );
        res.setHeader(
            'RateLimit-Reset',
            Math.ceil((Math.max(...recentRequests) + windowMs) / 1000)
        );

        next();
    };
}

/**
 * Request Logging Middleware - Log cada requisição (opcional)
 * Útil para auditoria e debugging
 */
export function loggingMiddleware() {
    return (req, res, next) => {
        const shouldLogRequests =
            process.env.NODE_ENV !== 'production' ||
            process.env.ENABLE_REQUEST_LOGS === 'true';

        if (!shouldLogRequests) {
            return next();
        }

        const start = Date.now();

        // Interceptar método res.json para logar resposta
        const originalJson = res.json;
        res.json = function (data) {
            const duration = Date.now() - start;
            console.log(
                `[${new Date().toISOString()}] ${req.method} ${req.path} - Status: ${res.statusCode} - ${duration}ms`
            );
            return originalJson.call(this, data);
        };

        next();
    };
}

/**
 * Middleware para sanitizar input - Remove caracteres perigosos
 * Protege contra SQL injection, XSS (primeira camada)
 */
export function sanitizeInputMiddleware() {
    return (req, res, next) => {
        // Sanitizar query string
        Object.keys(req.query || {}).forEach((key) => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeString(req.query[key]);
            }
        });

        // Sanitizar body
        if (req.body && typeof req.body === 'object') {
            sanitizeObject(req.body);
        }

        next();
    };
}

/**
 * Função auxiliar para sanitizar string
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;

    return str
        .replace(/[<>]/g, '') // Remove tags simples
        .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control chars
        .trim();
}

/**
 * Função auxiliar para sanitizar objeto recursivamente
 */
function sanitizeObject(obj) {
    Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'string') {
            obj[key] = sanitizeString(obj[key]);
        } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item, idx) => {
                if (typeof item === 'string') {
                    obj[key][idx] = sanitizeString(item);
                }
            });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
        }
    });
}
