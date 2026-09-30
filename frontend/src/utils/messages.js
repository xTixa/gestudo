import { useEffect, useSyncExternalStore } from 'react';
import { apiGet, apiPatch, apiPost } from './api';

// Mensagens internas (ver backend/src/services/mensagensService.js).

async function lerResposta(response, mensagemErro) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || mensagemErro);
    }
    return data;
}

export async function listarConversas({ arquivadas = false } = {}) {
    const response = await apiGet(`/api/mensagens/conversas?arquivadas=${arquivadas}`);
    const data = await lerResposta(response, 'Erro ao carregar conversas.');
    return data.conversas || [];
}

export async function listarMensagens(idConversa, { antes = null, limit = 30 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (antes) params.set('antes', String(antes));
    const response = await apiGet(`/api/mensagens/conversas/${idConversa}/mensagens?${params}`);
    return lerResposta(response, 'Erro ao carregar mensagens.');
}

export async function enviarMensagem(idConversa, corpo) {
    const response = await apiPost(`/api/mensagens/conversas/${idConversa}/mensagens`, { corpo });
    const data = await lerResposta(response, 'Erro ao enviar a mensagem.');
    return data.mensagem;
}

export async function criarConversa({ participantes, assunto, mensagem }) {
    const response = await apiPost('/api/mensagens/conversas', { participantes, assunto, mensagem });
    return lerResposta(response, 'Erro ao enviar a mensagem.');
}

export async function marcarConversaLida(idConversa) {
    const response = await apiPost(`/api/mensagens/conversas/${idConversa}/lida`, {});
    await lerResposta(response, 'Erro ao marcar como lida.');
    void atualizarNaoLidas();
}

export async function arquivarConversa(idConversa, arquivada) {
    const response = await apiPatch(`/api/mensagens/conversas/${idConversa}`, { arquivada });
    await lerResposta(response, 'Erro ao arquivar a conversa.');
    void atualizarNaoLidas();
}

export async function procurarContactos(q = '') {
    const response = await apiGet(`/api/mensagens/contactos?q=${encodeURIComponent(q)}`);
    const data = await lerResposta(response, 'Erro ao carregar contactos.');
    return data.contactos || [];
}

// ---------- contador de não lidas (partilhado por toda a app) ----------

const INTERVALO_MS = 30 * 1000;
let naoLidas = 0;
const ouvintes = new Set();
let subscritores = 0;
let timer = null;

function emitir(valor) {
    if (valor === naoLidas) return;
    naoLidas = valor;
    ouvintes.forEach((ouvinte) => ouvinte());
}

export async function atualizarNaoLidas() {
    try {
        const response = await apiGet('/api/mensagens/nao-lidas');
        if (!response.ok) return;
        const data = await response.json();
        emitir(Number(data.total) || 0);
    } catch {
        // Sem rede: mantém o último valor.
    }
}

function aoMudarVisibilidade() {
    if (document.visibilityState === 'visible') void atualizarNaoLidas();
}

function iniciarPolling() {
    void atualizarNaoLidas();
    timer = setInterval(() => {
        if (document.visibilityState === 'visible') void atualizarNaoLidas();
    }, INTERVALO_MS);
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
}

function pararPolling() {
    clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
}

function subscrever(ouvinte) {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
}

/**
 * Número de mensagens por ler. Só faz pedidos enquanto houver algum
 * componente montado com `enabled` (ex.: módulo incluído no pacote).
 */
export function useUnreadMessages(enabled = true) {
    const valor = useSyncExternalStore(subscrever, () => naoLidas);

    useEffect(() => {
        if (!enabled) return undefined;
        subscritores += 1;
        if (subscritores === 1) iniciarPolling();
        return () => {
            subscritores -= 1;
            if (subscritores === 0) pararPolling();
        };
    }, [enabled]);

    return enabled ? valor : 0;
}

// ---------- formatação ----------

const PAPEL_LABEL = {
    gestor: 'Gestão',
    professor: 'Professor',
    aluno: 'Aluno',
    encarregado: 'Encarregado',
};

export function papelLabel(papel) {
    return PAPEL_LABEL[papel] || '';
}

export function tituloConversa(conversa) {
    if (conversa?.assunto) return conversa.assunto;
    const nomes = (conversa?.participantes || []).map((p) => p.nome);
    if (!nomes.length) return 'Conversa';
    if (nomes.length <= 3) return nomes.join(', ');
    return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
}

export function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    const primeira = partes[0][0];
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return `${primeira}${ultima}`.toUpperCase();
}

function mesmoDia(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

// Hora se for hoje, "ontem", dia da semana nesta semana, ou data.
export function dataCurta(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    const agora = new Date();
    if (mesmoDia(data, agora)) {
        return data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }
    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    if (mesmoDia(data, ontem)) return 'Ontem';
    const diffDias = (agora - data) / 86400000;
    if (diffDias < 7) return data.toLocaleDateString('pt-PT', { weekday: 'short' });
    return data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function separadorDia(valor) {
    const data = new Date(valor);
    const agora = new Date();
    if (mesmoDia(data, agora)) return 'Hoje';
    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    if (mesmoDia(data, ontem)) return 'Ontem';
    return data.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function hora(valor) {
    return new Date(valor).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}
