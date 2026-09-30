import { afterEach, describe, expect, it } from 'vitest';
import {
    getCookieDomain,
    sanitizeInputMiddleware,
    sanitizeString,
} from '../../src/middlewares/securityMiddleware.js';

describe('sanitizeString', () => {
    it('mantém < e > (texto legítimo)', () => {
        expect(sanitizeString('a < b e c > d')).toBe('a < b e c > d');
        expect(sanitizeString('Obrigada <3')).toBe('Obrigada <3');
    });

    it('remove caracteres de controlo mas mantém tab e quebras de linha', () => {
        expect(sanitizeString('ol\u0000á\u0007')).toBe('olá');
        expect(sanitizeString('linha 1\nlinha 2\tfim')).toBe('linha 1\nlinha 2\tfim');
    });

    it('apara espaços e ignora valores que não são texto', () => {
        expect(sanitizeString('  x  ')).toBe('x');
        expect(sanitizeString(42)).toBe(42);
        expect(sanitizeString(null)).toBeNull();
    });
});

describe('sanitizeInputMiddleware', () => {
    it('limpa body (incluindo objetos e listas aninhados) e query', () => {
        const req = {
            query: { q: ' <b>x</b>\u0000 ' },
            body: { corpo: ' a < b ', lista: [' 1 ', 2], nested: { n: '\u0001y' } },
        };
        let chamou = false;
        sanitizeInputMiddleware()(req, {}, () => {
            chamou = true;
        });
        expect(chamou).toBe(true);
        expect(req.query.q).toBe('<b>x</b>');
        expect(req.body).toEqual({ corpo: 'a < b', lista: ['1', 2], nested: { n: 'y' } });
    });
});

describe('getCookieDomain', () => {
    const original = process.env.COOKIE_DOMAIN;
    afterEach(() => {
        if (original === undefined) delete process.env.COOKIE_DOMAIN;
        else process.env.COOKIE_DOMAIN = original;
    });

    it('vazio = só o domínio da API', () => {
        delete process.env.COOKIE_DOMAIN;
        expect(getCookieDomain()).toBeUndefined();
        process.env.COOKIE_DOMAIN = '   ';
        expect(getCookieDomain()).toBeUndefined();
    });

    it('usa o valor configurado', () => {
        process.env.COOKIE_DOMAIN = ' .exemplo.pt ';
        expect(getCookieDomain()).toBe('.exemplo.pt');
    });
});
