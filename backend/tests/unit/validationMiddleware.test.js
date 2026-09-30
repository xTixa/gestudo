import { describe, expect, it } from 'vitest';
import {
    validateBody,
    validateParams,
    validateQuery,
} from '../../src/middlewares/validationMiddleware.js';
import { runMiddleware as run } from '../helpers.js';

describe('validateBody', () => {
    const schema = {
        nome: { type: 'string', required: true, min: 2, max: 5 },
        idade: { type: 'number' },
        email: { type: 'email' },
        estado: { type: 'string', enum: ['ativo', 'inativo'] },
    };

    it('aceita um body válido', () => {
        const { nextCalled } = run(validateBody(schema), {
            body: { nome: 'Ana', idade: '12', email: 'a@b.pt', estado: 'ATIVO' },
        });
        expect(nextCalled).toBe(true);
    });

    it('junta todos os erros numa resposta 400', () => {
        const { res, nextCalled } = run(validateBody(schema), {
            body: { nome: 'A', idade: 'x', email: 'sem-arroba', estado: 'outro' },
        });
        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details.errors).toHaveLength(4);
    });

    it('exige campos obrigatórios', () => {
        const { res } = run(validateBody(schema), { body: {} });
        expect(res.body.details.errors).toEqual(['Campo obrigatório: nome']);
    });
});

describe('validateParams', () => {
    it('rejeita ids não numéricos', () => {
        const { res } = run(validateParams({ id: 'number' }), { params: { id: 'abc' } });
        expect(res.statusCode).toBe(400);
    });

    it('aceita ids numéricos', () => {
        const { nextCalled } = run(validateParams({ id: 'number' }), { params: { id: '42' } });
        expect(nextCalled).toBe(true);
    });
});

describe('validateQuery', () => {
    it('valida datas no formato YYYY-MM-DD', () => {
        const middleware = validateQuery({ from: { type: 'date', required: true } });
        expect(run(middleware, { query: { from: '2026-09-30' } }).nextCalled).toBe(true);
        expect(run(middleware, { query: { from: '30-09-2026' } }).res.statusCode).toBe(400);
        expect(run(middleware, { query: {} }).res.statusCode).toBe(400);
    });
});
