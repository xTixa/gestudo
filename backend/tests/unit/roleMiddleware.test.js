import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { fakeRes } from '../helpers.js';
import { authMiddleware } from '../../src/middlewares/authMiddleware.js';

const query = vi.fn();
vi.mock('../../src/config/db.js', () => ({ db: { query: (...args) => query(...args) } }));

const { roleMiddleware, requireSession } = await import(
    '../../src/middlewares/roleMiddleware.js'
);

async function correr(middleware, req) {
    const res = fakeRes();
    let nextCalled = false;
    await middleware(req, res, () => {
        nextCalled = true;
    });
    return { res, nextCalled };
}

function utilizador(overrides = {}) {
    return { role: 'gestor', status: true, token_version: 0, ...overrides };
}

beforeEach(() => {
    query.mockReset();
});

describe('roleMiddleware e token_version', () => {
    it('aceita quando a versão do token coincide com a da BD', async () => {
        query.mockResolvedValue({ rows: [utilizador({ token_version: 2 })] });
        const { nextCalled } = await correr(roleMiddleware('gestor'), {
            userId: 1,
            tokenVersion: 2,
        });
        expect(nextCalled).toBe(true);
    });

    it('recusa com 401 um token emitido antes da mudança de password', async () => {
        query.mockResolvedValue({ rows: [utilizador({ token_version: 3 })] });
        const { res, nextCalled } = await correr(roleMiddleware('gestor'), {
            userId: 1,
            tokenVersion: 2,
        });
        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Sessão terminada');
    });

    it('token sem versão conta como 0', async () => {
        query.mockResolvedValue({ rows: [utilizador({ token_version: 0 })] });
        const { nextCalled } = await correr(requireSession(), { userId: 1 });
        expect(nextCalled).toBe(true);
    });

    it('role errada dá 403 sem revelar a role do utilizador', async () => {
        query.mockResolvedValue({ rows: [utilizador({ role: 'aluno' })] });
        const { res } = await correr(roleMiddleware('gestor'), { userId: 1, tokenVersion: 0 });
        expect(res.statusCode).toBe(403);
        expect(res.body).not.toHaveProperty('userRole');
    });

    it('requireSession aceita qualquer role e recusa contas desativadas', async () => {
        query.mockResolvedValue({ rows: [utilizador({ role: 'professor' })] });
        expect((await correr(requireSession(), { userId: 1, tokenVersion: 0 })).nextCalled).toBe(true);

        query.mockResolvedValue({ rows: [utilizador({ status: false })] });
        const { res } = await correr(requireSession(), { userId: 1, tokenVersion: 0 });
        expect(res.statusCode).toBe(401);
    });
});

describe('authMiddleware', () => {
    it('lê a versão do token do campo tv', () => {
        const token = jwt.sign({ id: 5, role: 'aluno', tv: 4 }, process.env.JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        authMiddleware(req, fakeRes(), () => {});
        expect(req.userId).toBe(5);
        expect(req.tokenVersion).toBe(4);
    });
});
