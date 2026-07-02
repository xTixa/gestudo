import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
}));

vi.mock('../../src/config/db.js', () => ({
    db: { query: mocks.query },
}));

const { roleMiddleware } = await import('../../src/middlewares/roleMiddleware.js');

function createMocks(userId = null) {
    const req = { userId, userRole: null };
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
    const next = vi.fn();
    return { req, res, next };
}

describe('roleMiddleware', () => {
    beforeEach(() => mocks.query.mockReset());

    it('sem userId devolve 401', async () => {
        const { req, res, next } = createMocks(null);

        await roleMiddleware('gestor')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('utilizador nao encontrado na BD devolve 401', async () => {
        const { req, res, next } = createMocks(99);
        mocks.query.mockResolvedValueOnce({ rows: [] });

        await roleMiddleware('gestor')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('conta desativada devolve 401', async () => {
        const { req, res, next } = createMocks(5);
        mocks.query.mockResolvedValueOnce({ rows: [{ role: 'gestor', status: false }] });

        await roleMiddleware('gestor')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Conta desativada' })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('role insuficiente devolve 403', async () => {
        const { req, res, next } = createMocks(5);
        mocks.query.mockResolvedValueOnce({ rows: [{ role: 'aluno', status: true }] });

        await roleMiddleware('gestor')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                userRole: 'aluno',
                requiredRole: 'gestor',
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('role correta chama next e define req.userRole', async () => {
        const { req, res, next } = createMocks(2);
        mocks.query.mockResolvedValueOnce({ rows: [{ role: 'gestor', status: true }] });

        await roleMiddleware('gestor')(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.userRole).toBe('gestor');
        expect(res.status).not.toHaveBeenCalled();
    });
});
