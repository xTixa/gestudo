import { useEffect, useState } from 'react';
import { apiGet } from './api';

// Pacote contratado desta instalação (ver backend/src/config/plans.js).
// Carregado uma vez e partilhado por todos os componentes.

// Contacto comercial para mudanças de pacote. Substituir pelo real.
export const SALES_EMAIL = 'geral@gestudo.pt';

let cachedPlan = null;
let pendingRequest = null;

function loadPlan() {
    if (cachedPlan) return Promise.resolve(cachedPlan);
    if (!pendingRequest) {
        pendingRequest = apiGet('/api/public/plano')
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null)
            .then((data) => {
                // Sem resposta do servidor não se bloqueia nada: o backend
                // continua a validar cada pedido.
                cachedPlan = data?.modulos
                    ? data
                    : { plano: 'completo', nome: 'Completo', modulos: null, limites: {} };
                pendingRequest = null;
                return cachedPlan;
            });
    }
    return pendingRequest;
}

export function usePlan() {
    const [plan, setPlan] = useState(cachedPlan);

    useEffect(() => {
        if (plan) return undefined;
        let active = true;
        loadPlan().then((data) => {
            if (active) setPlan(data);
        });
        return () => {
            active = false;
        };
    }, [plan]);

    return {
        loading: !plan,
        plano: plan?.plano ?? null,
        nome: plan?.nome ?? '',
        limites: plan?.limites ?? {},
        // { nome, desde, desdeNome } do módulo, para mensagens de upgrade.
        moduleInfo: (moduleKey) => plan?.catalogo?.[moduleKey] ?? null,
        // Enquanto carrega, considera-se indisponível para evitar mostrar
        // menus que depois desaparecem.
        hasModule: (moduleKey) =>
            Boolean(plan) && (plan.modulos == null || plan.modulos[moduleKey] !== false),
    };
}
