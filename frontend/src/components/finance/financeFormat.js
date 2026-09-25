const moneyFormatter = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
});

export function formatMoney(value) {
    const n = Number(value);
    return moneyFormatter.format(Number.isFinite(n) ? n : 0);
}

/** "2026-09-08" -> "08/09/2026" (sem conversões de fuso horário). */
export function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

/** "2026-09" -> "Setembro de 2026" */
export function formatMes(value, { short = false } = {}) {
    const match = /^(\d{4})-(\d{2})/.exec(String(value || ''));
    if (!match) return '—';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    const label = date.toLocaleDateString('pt-PT', {
        month: short ? 'short' : 'long',
        year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

export function currentMes() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function todayISO() {
    const now = new Date();
    return `${currentMes()}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Soma meses a "AAAA-MM". */
export function shiftMes(mes, delta) {
    const [y, m] = mes.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Vencimento por omissão: dia 8 do mês de referência. */
export function defaultVencimento(mes) {
    return `${mes}-08`;
}

export const METODOS_PAGAMENTO = [
    { value: 'numerario', label: 'Numerário' },
    { value: 'transferencia', label: 'Transferência' },
    { value: 'mbway', label: 'MB WAY' },
    { value: 'multibanco', label: 'Multibanco' },
    { value: 'cartao', label: 'Cartão' },
    { value: 'outro', label: 'Outro' },
];

export function metodoLabel(value) {
    return METODOS_PAGAMENTO.find((m) => m.value === value)?.label || value || '—';
}

export const ESTADO_OPTIONS = [
    { value: '', label: 'Todos os estados' },
    { value: 'em_divida', label: 'Em dívida' },
    { value: 'pendente', label: 'Pendentes' },
    { value: 'parcial', label: 'Parciais' },
    { value: 'vencida', label: 'Vencidas' },
    { value: 'paga', label: 'Pagas' },
    { value: 'anulada', label: 'Anuladas' },
];

