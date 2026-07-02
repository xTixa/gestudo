import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    connect: vi.fn(),
}));

vi.mock('../../src/config/db.js', () => ({
    db: {
        query: mocks.query,
        connect: mocks.connect,
    },
}));

vi.mock('../../src/services/emailService.js', () => ({
    enviarEmailCredenciaisIniciais: vi.fn().mockResolvedValue({ ok: true }),
    enviarEmailContaCriadaEE: vi.fn().mockResolvedValue({ ok: true }),
    enviarEmailRecuperacaoPassword: vi.fn().mockResolvedValue({ ok: true }),
    enviarEmailRecuperacaoPasswordEE: vi.fn().mockResolvedValue({ ok: true }),
    enviarEmailPasswordAlterada: vi.fn().mockResolvedValue({ ok: true }),
    enviarEmailPasswordAlteradaEE: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../../src/services/alertasDispatchService.js', () => ({
    notificarGestoresAtividadeSuspeita: vi.fn().mockResolvedValue(undefined),
    notificarGestoresCriacaoConta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/logService.js', () => ({
    registarInsert: vi.fn().mockResolvedValue(undefined),
    registarUpdate: vi.fn().mockResolvedValue(undefined),
    registarDelete: vi.fn().mockResolvedValue(undefined),
}));

process.env.JWT_SECRET = 'segredo-de-teste-integracao';

const { default: app } = await import('../../src/app.js');

describe('POST /api/auth/login', () => {
    beforeEach(() => mocks.query.mockReset());

    it('devolve 400 quando email ou password estao em falta', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'gestor@example.com' })
            .expect(400);

        expect(response.body).toMatchObject(
            expect.objectContaining({ message: expect.any(String) })
        );
    });

    it('devolve 401 quando o utilizador nao existe', async () => {
        mocks.query.mockImplementation((sql) => {
            if (sql && sql.includes('information_schema')) {
                return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'naoexiste@example.com', password: 'qualquer' })
            .expect(401);

        expect(response.body.message).toMatch(/inv[áa]lid/i);
    });

    it('devolve 200 e token quando credenciais sao validas', async () => {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.default.hash('password123', 10);

        mocks.query.mockImplementation((sql) => {
            if (sql && sql.includes('information_schema')) {
                return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
            }
            return Promise.resolve({
                rows: [{
                    id: 1,
                    email: 'gestor@example.com',
                    password: hash,
                    role: 'gestor',
                    primeira_login: false,
                    imagem_perfil_url: null,
                }],
            });
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'gestor@example.com', password: 'password123' })
            .expect(200);

        expect(response.body).toMatchObject({
            message: expect.stringContaining('sucesso'),
            token: expect.any(String),
            user: expect.objectContaining({ email: 'gestor@example.com', role: 'gestor' }),
        });
    });
});
