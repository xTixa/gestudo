import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
}));

vi.mock('../../src/config/db.js', () => ({
    db: {
        query: mocks.query,
    },
}));

const { default: app } = await import('../../src/app.js');

describe('API app', () => {
    beforeEach(() => {
        mocks.query.mockReset();
    });

    it('responde ao endpoint raiz', async () => {
        const response = await request(app).get('/').expect(200);

        expect(response.body).toEqual({
            message: 'API MediaCenter',
            version: '1.0.0',
            status: 'online',
        });
    });

    it('devolve healthcheck com DB ligado', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

        const response = await request(app).get('/api/health').expect(200);

        expect(mocks.query).toHaveBeenCalledWith('SELECT 1');
        expect(response.body).toMatchObject({
            ok: true,
            db: 'connected',
        });
        expect(response.body.timestamp).toEqual(expect.any(String));
    });

    it('devolve 500 no healthcheck quando a DB falha', async () => {
        mocks.query.mockRejectedValueOnce(new Error('connection refused'));

        const response = await request(app).get('/api/health').expect(500);

        expect(response.body).toMatchObject({
            code: 'HEALTHCHECK_DB_ERROR',
            details: {
                db: 'error',
                reason: 'connection refused',
            },
            path: '/api/health',
        });
    });
});
