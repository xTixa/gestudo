import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    verify: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
    default: { verify: mocks.verify },
}));

const { authMiddleware } = await import('../../src/middlewares/authMiddleware.js');

function createMocks() {
    const req = { headers: {}, ip: '127.0.0.1' };
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
    const next = vi.fn();
    return { req, res, next };
}

describe('authMiddleware', () => {
    beforeEach(() => {
        mocks.verify.mockReset();
        process.env.JWT_SECRET = 'segredo-de-teste';
    });

    it('sem token define userId null e chama next', () => {
        const { req, res, next } = createMocks();

        authMiddleware(req, res, next);

        expect(req.userId).toBeNull();
        expect(req.userRole).toBeNull();
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('Bearer token valido define userId e role corretos', () => {
        const { req, res, next } = createMocks();
        req.headers.authorization = 'Bearer token-valido';
        mocks.verify.mockReturnValueOnce({ id: 7, role: 'gestor' });

        authMiddleware(req, res, next);

        expect(req.userId).toBe(7);
        expect(req.userRole).toBe('gestor');
        expect(next).toHaveBeenCalledOnce();
    });

    it('token via cookie define userId corretamente', () => {
        const { req, res, next } = createMocks();
        req.headers.cookie = 'mc_token=cookie-token';
        mocks.verify.mockReturnValueOnce({ id: 3, role: 'aluno' });

        authMiddleware(req, res, next);

        expect(req.userId).toBe(3);
        expect(req.userRole).toBe('aluno');
        expect(next).toHaveBeenCalledOnce();
    });

    it('token expirado ou invalido devolve 401', () => {
        const { req, res, next } = createMocks();
        req.headers.authorization = 'Bearer token-expirado';
        mocks.verify.mockImplementationOnce(() => {
            throw new Error('jwt expired');
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('expirada') })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('JWT_SECRET em falta devolve 500', () => {
        const { req, res, next } = createMocks();
        req.headers.authorization = 'Bearer qualquer-token';
        process.env.JWT_SECRET = '';

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
    });
});
