import { describe, expect, it, vi } from 'vitest';
import { validateBody, validateParams, validateQuery } from '../../src/middlewares/validationMiddleware.js';

function createResponse() {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
}

describe('validationMiddleware', () => {
    it('aceita um body valido e chama next', () => {
        const req = {
            body: {
                nome: 'Maria Silva',
                email: 'maria@example.com',
                estado: 'pendente',
            },
            path: '/teste',
        };
        const res = createResponse();
        const next = vi.fn();

        validateBody({
            nome: { type: 'string', required: true, min: 3 },
            email: { type: 'email', required: true },
            estado: { type: 'string', enum: ['pendente', 'aprovada'] },
        })(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('devolve 400 quando faltam campos obrigatorios no body', () => {
        const req = { body: { email: 'sem-nome@example.com' }, path: '/teste' };
        const res = createResponse();
        const next = vi.fn();

        validateBody({
            nome: { type: 'string', required: true },
            email: { type: 'email', required: true },
        })(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'VALIDATION_ERROR',
                details: expect.objectContaining({
                    scope: 'body',
                    errors: expect.arrayContaining([expect.stringContaining('nome')]),
                }),
            })
        );
    });

    it('valida parametros numericos', () => {
        const req = { params: { id: 'abc' }, path: '/alunos/abc' };
        const res = createResponse();
        const next = vi.fn();

        validateParams({ id: 'number' })(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].details.scope).toBe('params');
    });

    it('valida queries de data', () => {
        const req = { query: { from: '2026-06-15' }, path: '/agenda' };
        const res = createResponse();
        const next = vi.fn();

        validateQuery({ from: { type: 'date', required: true } })(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });
});
