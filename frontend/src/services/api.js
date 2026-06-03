const API_URL = import.meta.env.VITE_API_URL;

/**
 * Função helper para fazer fetch à API com CSRF e cookies
 * @param {string} url - caminho relativo da API
 * @param {object} options - opções do fetch
 * @returns {Promise<object>} resposta JSON da API
 */
export async function apiFetch(url, options = {}) {
    const method = options.method?.toUpperCase() || 'GET';

    const headers = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.csrfToken, // token global obtido no login
        ...(options.headers || {}),
    };

    // Só adiciona CSRF em métodos de escrita
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        headers['X-CSRF-Token'] = window.csrfToken;
    }

    if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        !window.csrfToken
    ) {
        throw new Error('CSRF token não definido');
    }

    const res = await fetch(`${API_URL}${url}`, {
        ...options,
        headers,
        credentials: 'include', // envia cookies mc_token + mc_csrf
    });

    const data = await res.json();
    if (!res.ok) throw data; // lança erro para tratar nos catch
    return data;
}
