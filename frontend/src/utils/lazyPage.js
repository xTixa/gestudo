import { lazy } from 'react';

const RELOAD_KEY = 'mc_chunk_reload';

/**
 * React.lazy para páginas, com recuperação de deploys: se um ficheiro da
 * versão anterior já não existir no servidor ("Failed to fetch dynamically
 * imported module"), recarrega a aplicação uma vez para obter a versão nova.
 */
export function lazyPage(loader) {
    return lazy(async () => {
        try {
            const module = await loader();
            sessionStorage.removeItem(RELOAD_KEY);
            return module;
        } catch (error) {
            const jaRecarregou = sessionStorage.getItem(RELOAD_KEY) === '1';
            if (!jaRecarregou) {
                sessionStorage.setItem(RELOAD_KEY, '1');
                window.location.reload();
                // Nunca resolve: a página vai recarregar.
                return new Promise(() => {});
            }
            throw error;
        }
    });
}
