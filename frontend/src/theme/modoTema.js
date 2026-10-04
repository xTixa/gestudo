import { useEffect, useSyncExternalStore } from 'react';

/**
 * Preferência de modo de cor (claro/escuro/sistema), guardada por browser.
 * As cores em si vêm das variáveis CSS geradas em tailwind/coresTema.js;
 * aqui só se decide se o <html> leva a classe "dark".
 */

export const MODOS_TEMA = ['claro', 'escuro', 'sistema'];

const CHAVE = 'gestudo:modo-tema';
const MODO_POR_OMISSAO = 'claro';
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

const ouvintes = new Set();

function lerModo() {
    try {
        const valor = localStorage.getItem(CHAVE);
        return MODOS_TEMA.includes(valor) ? valor : MODO_POR_OMISSAO;
    } catch {
        return MODO_POR_OMISSAO;
    }
}

function sistemaEscuro() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia?.(CONSULTA_ESCURO).matches === true
    );
}

function notificar() {
    ouvintes.forEach((ouvinte) => ouvinte());
}

function subscrever(ouvinte) {
    ouvintes.add(ouvinte);
    const media = window.matchMedia?.(CONSULTA_ESCURO);
    media?.addEventListener('change', ouvinte);
    // Outro separador mudou a preferência.
    const aoMudarStorage = (event) => {
        if (event.key === CHAVE) ouvinte();
    };
    window.addEventListener('storage', aoMudarStorage);
    return () => {
        ouvintes.delete(ouvinte);
        media?.removeEventListener('change', ouvinte);
        window.removeEventListener('storage', aoMudarStorage);
    };
}

export function resolverEscuro(modo) {
    return modo === 'escuro' || (modo === 'sistema' && sistemaEscuro());
}

export function definirModoTema(modo) {
    if (!MODOS_TEMA.includes(modo)) return;
    try {
        localStorage.setItem(CHAVE, modo);
    } catch {
        // Sem storage (ex.: modo privado): a escolha vale só até recarregar.
    }
    notificar();
}

/** Devolve { modo, escuro } e atualiza quando a preferência ou o SO mudam. */
export function useModoTema() {
    const modo = useSyncExternalStore(subscrever, lerModo);
    const escuro = useSyncExternalStore(subscrever, () =>
        resolverEscuro(lerModo())
    );
    return { modo, escuro };
}

/**
 * Aplica a classe "dark" ao <html> enquanto "ativo" for verdadeiro.
 * O modo escuro só existe na área autenticada; as páginas públicas ficam claras.
 */
export function useAplicarModoTema(ativo) {
    const { escuro } = useModoTema();
    useEffect(() => {
        document.documentElement.classList.toggle('dark', ativo && escuro);
    }, [ativo, escuro]);
}

/**
 * Chamado antes do primeiro render, para não piscar em claro ao abrir a app
 * com sessão iniciada e modo escuro.
 */
export function aplicarModoTemaInicial(comSessao) {
    document.documentElement.classList.toggle(
        'dark',
        comSessao && resolverEscuro(lerModo())
    );
}
