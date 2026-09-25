// Utilitários partilhados pelos módulos financeiros.

export const METODOS_PAGAMENTO = new Set([
    'numerario',
    'transferencia',
    'mbway',
    'multibanco',
    'cartao',
    'outro',
]);

export function toMoney(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function parseMes(value) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return `${match[1]}-${match[2]}-01`;
}

export function isISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
