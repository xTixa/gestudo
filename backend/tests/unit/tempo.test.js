import { describe, expect, it } from 'vitest';
import {
    dataPt,
    descreverAgenda,
    euros,
    nomeMes,
    partesNoFuso,
    periodoEmDivida,
    somarDias,
} from '../../src/scheduler/tempo.js';

const LISBOA = 'Europe/Lisbon';

describe('partesNoFuso', () => {
    it('converte UTC para a data e hora de Lisboa (verão, UTC+1)', () => {
        const partes = partesNoFuso(new Date('2026-09-30T23:30:00Z'), LISBOA);
        expect(partes.data).toBe('2026-10-01');
        expect(partes.minutosDoDia).toBe(30);
    });

    it('respeita a hora de inverno (UTC+0)', () => {
        const partes = partesNoFuso(new Date('2026-12-15T09:00:00Z'), LISBOA);
        expect(partes.data).toBe('2026-12-15');
        expect(partes.minutosDoDia).toBe(9 * 60);
    });
});

describe('periodoEmDivida', () => {
    const diaria = { tipo: 'diaria', hora: '09:00' };
    const mensal = { tipo: 'mensal', dia: 1, hora: '07:00' };

    it('diária: nada antes da hora marcada', () => {
        // 07:59 UTC = 08:59 em Lisboa (verão)
        expect(periodoEmDivida(diaria, new Date('2026-09-30T07:59:00Z'), LISBOA)).toBeNull();
    });

    it('diária: devolve o dia a partir da hora marcada', () => {
        expect(periodoEmDivida(diaria, new Date('2026-09-30T08:00:00Z'), LISBOA)).toBe('2026-09-30');
        expect(periodoEmDivida(diaria, new Date('2026-09-30T22:00:00Z'), LISBOA)).toBe('2026-09-30');
    });

    it('mensal: dia 1 antes da hora ainda não está em dívida', () => {
        expect(periodoEmDivida(mensal, new Date('2026-10-01T05:00:00Z'), LISBOA)).toBeNull();
    });

    it('mensal: em dívida a partir do dia/hora e no resto do mês', () => {
        expect(periodoEmDivida(mensal, new Date('2026-10-01T06:00:00Z'), LISBOA)).toBe('2026-10');
        expect(periodoEmDivida(mensal, new Date('2026-10-20T03:00:00Z'), LISBOA)).toBe('2026-10');
    });

    it('rejeita horas mal escritas', () => {
        expect(() => periodoEmDivida({ tipo: 'diaria', hora: '9h' })).toThrow();
    });
});

describe('somarDias', () => {
    it('atravessa meses, anos e anos bissextos', () => {
        expect(somarDias('2026-09-30', 1)).toBe('2026-10-01');
        expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
        expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
    });

    it('não é afetado pela mudança de hora', () => {
        expect(somarDias('2026-03-28', 1)).toBe('2026-03-29');
        expect(somarDias('2026-10-24', 1)).toBe('2026-10-25');
    });
});

describe('formatação', () => {
    it('nomeMes, dataPt, euros e descreverAgenda', () => {
        expect(nomeMes('2026-09-01')).toBe('setembro de 2026');
        expect(dataPt('2026-09-08')).toBe('08/09/2026');
        expect(euros(50)).toBe('50,00 €');
        expect(euros('12.5')).toBe('12,50 €');
        expect(descreverAgenda({ tipo: 'diaria', hora: '09:00' })).toBe('Todos os dias às 09:00');
        expect(descreverAgenda({ tipo: 'mensal', dia: 1, hora: '07:00' })).toBe('Dia 1 de cada mês às 07:00');
    });
});
