import { describe, expect, it } from 'vitest';
import { isISODate, parseMes, toMoney } from '../../src/services/financeUtils.js';

describe('toMoney', () => {
    it('arredonda a 2 casas decimais', () => {
        expect(toMoney('12.345')).toBe(12.35);
        expect(toMoney(0.1 + 0.2)).toBe(0.3);
    });

    it('devolve 0 para valores não numéricos', () => {
        expect(toMoney('abc')).toBe(0);
        expect(toMoney(undefined)).toBe(0);
        expect(toMoney(Infinity)).toBe(0);
    });
});

describe('parseMes', () => {
    it('converte YYYY-MM no primeiro dia do mês', () => {
        expect(parseMes('2026-09')).toBe('2026-09-01');
        expect(parseMes(' 2026-01 ')).toBe('2026-01-01');
    });

    it('rejeita meses inválidos ou formatos errados', () => {
        expect(parseMes('2026-13')).toBeNull();
        expect(parseMes('2026-00')).toBeNull();
        expect(parseMes('2026-9')).toBeNull();
        expect(parseMes('2026-09-01')).toBeNull();
        expect(parseMes(null)).toBeNull();
    });
});

describe('isISODate', () => {
    it('aceita datas reais', () => {
        expect(isISODate('2026-02-28')).toBe(true);
        expect(isISODate('2028-02-29')).toBe(true);
    });

    it('rejeita datas impossíveis ou mal formatadas', () => {
        expect(isISODate('2026-02-29')).toBe(false);
        expect(isISODate('2026-04-31')).toBe(false);
        expect(isISODate('26-04-01')).toBe(false);
        expect(isISODate('')).toBe(false);
    });
});
