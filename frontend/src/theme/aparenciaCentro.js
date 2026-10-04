import { useEffect, useSyncExternalStore } from 'react';
import { apiGet } from '../utils/api';
import { TEMA_CENTRO_POR_OMISSAO, TEMAS_CENTRO } from './temasCentro';

/**
 * Cor do tema do centro, escolhida pelo gestor e igual para todos.
 * Fica em cache no browser para a app abrir logo com a cor certa; o valor do
 * servidor é lido uma vez por carregamento e substitui a cache.
 * As paletas são geradas em tailwind/coresTema.js (html[data-tema="..."]).
 */

const CHAVE_CACHE = 'gestudo:tema-centro';
const ouvintes = new Set();

function valido(tema) {
    return TEMAS_CENTRO.some((item) => item.id === tema);
}

function lerCache() {
    try {
        const valor = localStorage.getItem(CHAVE_CACHE);
        return valido(valor) ? valor : TEMA_CENTRO_POR_OMISSAO;
    } catch {
        return TEMA_CENTRO_POR_OMISSAO;
    }
}

let temaAtual = lerCache();
let pedido = null;

function subscrever(ouvinte) {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
}

/** Atualiza a cor (ex.: depois de o gestor a gravar) e guarda em cache. */
export function definirTemaCentroLocal(tema) {
    if (!valido(tema) || tema === temaAtual) return;
    temaAtual = tema;
    try {
        localStorage.setItem(CHAVE_CACHE, tema);
    } catch {
        // Sem storage: vale até recarregar.
    }
    ouvintes.forEach((ouvinte) => ouvinte());
}

function carregarTemaCentro() {
    if (!pedido) {
        pedido = apiGet('/api/public/aparencia')
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => definirTemaCentroLocal(data?.tema))
            // Sem servidor fica a cor em cache (ou a por omissão).
            .catch(() => {});
    }
    return pedido;
}

export function useTemaCentro() {
    return useSyncExternalStore(subscrever, () => temaAtual);
}

function aplicar(ativo, tema) {
    const raiz = document.documentElement;
    if (ativo && tema !== TEMA_CENTRO_POR_OMISSAO) {
        raiz.dataset.tema = tema;
    } else {
        delete raiz.dataset.tema;
    }
}

/**
 * Aplica a cor do centro ao <html> enquanto "ativo" for verdadeiro (área
 * autenticada). As páginas públicas ficam com a cor da marca.
 */
export function useAplicarTemaCentro(ativo) {
    const tema = useTemaCentro();
    useEffect(() => {
        if (ativo) carregarTemaCentro();
    }, [ativo]);
    useEffect(() => {
        aplicar(ativo, tema);
    }, [ativo, tema]);
}

/** Chamado antes do primeiro render, com a cor em cache. */
export function aplicarTemaCentroInicial(comSessao) {
    aplicar(comSessao, temaAtual);
}
