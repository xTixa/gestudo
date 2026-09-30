// Utilitários de data/hora para as tarefas agendadas. Tudo é calculado no
// fuso do centro (Europe/Lisbon por omissão), independentemente do fuso do
// servidor ou da base de dados.

export function fusoHorario() {
    return String(process.env.APP_TIMEZONE || '').trim() || 'Europe/Lisbon';
}

/**
 * Data (YYYY-MM-DD) e minutos desde a meia-noite de `date` no fuso indicado.
 */
export function partesNoFuso(date = new Date(), timeZone = fusoHorario()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(date).map((part) => [part.type, part.value])
    );

    return {
        data: `${parts.year}-${parts.month}-${parts.day}`,
        dia: Number(parts.day),
        minutosDoDia: Number(parts.hour) * 60 + Number(parts.minute),
    };
}

export function somarDias(isoDate, dias) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + dias);
    return date.toISOString().slice(0, 10);
}

function paraMinutos(hora) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(hora || ''));
    if (!match) {
        throw new Error(`Hora inválida na agenda da tarefa: ${hora}`);
    }
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Devolve a chave do período que já devia ter corrido, ou null se a hora
 * ainda não chegou. Uma tarefa diária das 09:00 que não correu (servidor em
 * baixo) corre assim que possível no mesmo dia; uma mensal corre em
 * qualquer dia do mês a partir do dia/hora marcados.
 *
 * agenda: { tipo: 'diaria', hora: 'HH:MM' } | { tipo: 'mensal', dia, hora }
 */
export function periodoEmDivida(agenda, agora = new Date(), timeZone = fusoHorario()) {
    const partes = partesNoFuso(agora, timeZone);
    const hora = paraMinutos(agenda.hora);

    if (agenda.tipo === 'diaria') {
        return partes.minutosDoDia >= hora ? partes.data : null;
    }

    if (agenda.tipo === 'mensal') {
        const passou =
            partes.dia > agenda.dia ||
            (partes.dia === agenda.dia && partes.minutosDoDia >= hora);
        return passou ? partes.data.slice(0, 7) : null;
    }

    throw new Error(`Tipo de agenda desconhecido: ${agenda.tipo}`);
}

export function descreverAgenda(agenda) {
    if (agenda.tipo === 'diaria') return `Todos os dias às ${agenda.hora}`;
    if (agenda.tipo === 'mensal') return `Dia ${agenda.dia} de cada mês às ${agenda.hora}`;
    return '';
}

const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// '2026-09-01' → 'setembro de 2026'
export function nomeMes(isoDate) {
    const [ano, mes] = String(isoDate).split('-');
    return `${MESES[Number(mes) - 1]} de ${ano}`;
}

// '2026-09-08' → '08/09/2026'
export function dataPt(isoDate) {
    const [ano, mes, dia] = String(isoDate).slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
}

export function euros(valor) {
    return `${Number(valor || 0).toFixed(2).replace('.', ',')} €`;
}
