/**
 * Utility para requisições com autenticação
 * Envia automaticamente o token JWT no header Authorization
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CSRF_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Restaurar CSRF token ao carregar o módulo (após refresh da página)
if (typeof window !== 'undefined' && !window.csrfToken) {
    const _stored = localStorage.getItem('mc_csrf_token');
    if (_stored) window.csrfToken = _stored;
}

function getCookie(name) {
    if (typeof document === 'undefined') {
        return '';
    }

    const cookiePrefix = `${name}=`;
    const cookies = document.cookie.split(';');

    for (const rawCookie of cookies) {
        const cookie = rawCookie.trim();
        if (cookie.startsWith(cookiePrefix)) {
            return decodeURIComponent(cookie.slice(cookiePrefix.length));
        }
    }

    return '';
}

/**
 * Obter o user armazenado em localStorage
 */
export function getStoredUser() {
    try {
        const stored =
            localStorage.getItem('mc_user') || localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

export function getStoredToken() {
    try {
        return localStorage.getItem('mc_token') || '';
    } catch {
        return '';
    }
}

/**
 * Fetch wrapper que adiciona header de autenticação
 * @param {string} url - URL da requisição
 * @param {object} options - Opções do fetch (method, body, headers, etc)
 * @returns {Promise} Resposta do fetch
 */
export async function apiFetch(url, options = {}) {
    const token = getStoredToken();
    const method = String(options.method || 'GET').toUpperCase();
    const requiresCsrf = CSRF_METHODS.includes(method);

    // ✅ Constrói URL completa se for caminho relativo
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

    const headers = {
        ...options.headers,
    };

    // Adicionar header de autenticação se existir token JWT
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // ✅ CSRF: tenta cookie primeiro, fallback para window.csrfToken
    if (requiresCsrf) {
        const csrfToken =
            window.csrfToken ||
            localStorage.getItem('mc_csrf_token') ||
            getCookie('mc_csrf') ||
            '';
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        } else {
            console.warn('[apiFetch] CSRF token em falta para', method, url);
        }
    }

    const response = await fetch(fullUrl, {
        // ✅ usa fullUrl
        ...options,
        headers,
        credentials: options.credentials || 'include',
    });

    const endpoint = String(url || '');
    const isLoginEndpoint = endpoint.includes('/api/auth/login');

    if (response.status === 401 && !isLoginEndpoint) {
        window.dispatchEvent(
            new CustomEvent('mc:unauthorized', {
                detail: {
                    url: endpoint,
                    status: response.status,
                },
            })
        );
    }

    return response;
}

/**
 * Helper para requisições GET
 */
export async function apiGet(endpoint, options = {}) {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_URL}${endpoint}`;
    return apiFetch(url, {
        method: 'GET',
        ...options,
    });
}

/**
 * Helper para requisições POST
 */
export async function apiPost(endpoint, body, options = {}) {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_URL}${endpoint}`;
    return apiFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        body: JSON.stringify(body),
        ...options,
    });
}

/**
 * Helper para requisições PATCH
 */
export async function apiPatch(endpoint, body, options = {}) {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_URL}${endpoint}`;
    return apiFetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        body: JSON.stringify(body),
        ...options,
    });
}

/**
 * Helper para requisições DELETE
 */
export async function apiDelete(endpoint, options = {}) {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_URL}${endpoint}`;
    return apiFetch(url, {
        method: 'DELETE',
        ...options,
    });
}

/**
 * ========================================
 * ALERTAS API FUNCTIONS
 * ========================================
 * Interface para o sistema de alertas do backend
 */

/**
 * Obter todas as definições de alertas disponíveis (catalog)
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function obterDefinicoes() {
    const response = await apiGet('/api/alertas');
    return response.json();
}

/**
 * Obter preferências pessoais de alertas do utilizador autenticado
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function obterMinhasPreferencias() {
    const response = await apiGet('/api/alertas/minhas-preferencias');
    return response.json();
}

/**
 * Atualizar preferência de um alerta específico
 * @param {string} codigo - Código do alerta (ex: 'faturas-vencidas')
 * @param {object} preferencias - {canal_app?, canal_email?, ativo?}
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function atualizarPreferencias(codigo, preferencias) {
    const body = {
        codigo,
        ...preferencias,
    };
    const response = await apiPost('/api/alertas/preferencias', body);
    return response.json();
}

/**
 * Marcar um evento de alerta como lido
 * @param {number} id_alerta_evento - ID do evento de alerta
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function marcarAlertalido(id_alerta_evento) {
    const body = { id_alerta_evento };
    const response = await apiPost('/api/alertas/marcar-lido', body);
    return response.json();
}

/**
 * Listar eventos de alertas do utilizador com paginação e filtros
 * @param {object} filters - {limite?, offset?, lido?, grupo?, canal?}
 * @returns {Promise<{success: boolean, data: array, total: number, limite: number, offset: number}>}
 */
export async function listarEventos(filters = {}) {
    const queryParams = new URLSearchParams();

    if (filters.limite !== undefined)
        queryParams.append('limite', filters.limite);
    if (filters.offset !== undefined)
        queryParams.append('offset', filters.offset);
    if (filters.lido !== undefined) queryParams.append('lido', filters.lido);
    if (filters.grupo !== undefined) queryParams.append('grupo', filters.grupo);
    if (filters.canal !== undefined) queryParams.append('canal', filters.canal);

    const url = `/api/alertas/eventos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiGet(url);
    return response.json();
}

export async function registarTokenPush(token, plataforma = 'web') {
    const response = await apiPost('/api/notificacoes/device-token', {
        token,
        plataforma,
    });
    return response.json();
}

export async function removerTokenPush(token) {
    const response = await apiPost('/api/notificacoes/device-token/remover', {
        token,
    });
    return response.json();
}
