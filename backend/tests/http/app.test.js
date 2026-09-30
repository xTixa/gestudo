import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';

// Estes testes cobrem o que a API decide antes de chegar à base de dados:
// autenticação, CORS, CSRF, validação e cabeçalhos de segurança.

function tokenFor(payload, expiresIn = '5m') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

describe('API sem base de dados', () => {
    it('GET / responde online', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('online');
    });

    it('rota inexistente devolve 404 em JSON', async () => {
        const res = await request(app).get('/api/nao-existe');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
    });

    it('aplica os cabeçalhos de segurança', async () => {
        const res = await request(app).get('/');
        expect(res.headers['x-frame-options']).toBe('DENY');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    });
});

describe('CORS', () => {
    it('aceita origens permitidas', async () => {
        const res = await request(app).get('/').set('Origin', 'http://localhost:5173');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('bloqueia origens desconhecidas', async () => {
        const res = await request(app).get('/').set('Origin', 'https://site-malicioso.com');
        expect(res.status).toBe(403);
    });
});

describe('Autenticação', () => {
    it('rotas do gestor exigem sessão', async () => {
        const res = await request(app).get('/api/gestor/dashboard');
        expect(res.status).toBe(401);
    });

    it('tarefas automáticas exigem sessão de gestor', async () => {
        expect((await request(app).get('/api/gestor/tarefas-agendadas')).status).toBe(401);
        const res = await request(app).post('/api/gestor/tarefas-agendadas/lembrete-aulas/executar');
        expect(res.status).toBe(401);
    });

    it('token com assinatura errada devolve 401', async () => {
        const forged = jwt.sign({ id: 1, role: 'gestor' }, 'outro-segredo');
        const res = await request(app)
            .get('/api/gestor/dashboard')
            .set('Authorization', `Bearer ${forged}`);
        expect(res.status).toBe(401);
    });

    it('token expirado devolve 401', async () => {
        const res = await request(app)
            .get('/api/gestor/dashboard')
            .set('Authorization', `Bearer ${tokenFor({ id: 1, role: 'gestor' }, -10)}`);
        expect(res.status).toBe(401);
    });

    it('token sem id válido devolve 401', async () => {
        const res = await request(app)
            .get('/api/gestor/dashboard')
            .set('Authorization', `Bearer ${tokenFor({ id: 'abc' })}`);
        expect(res.status).toBe(401);
    });

    it('login valida o body antes de consultar a base de dados', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'sem-arroba', password: '' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

describe('CSRF', () => {
    const cookieToken = tokenFor({ id: 1, role: 'gestor' });

    it('pedido com cookie de sessão e sem cabeçalho CSRF é bloqueado', async () => {
        const res = await request(app)
            .post('/api/notificacoes/broadcast')
            .set('Cookie', `mc_token=${cookieToken}; mc_csrf=abc`)
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/CSRF/);
    });

    it('cabeçalho CSRF diferente do cookie é bloqueado', async () => {
        const res = await request(app)
            .post('/api/notificacoes/broadcast')
            .set('Cookie', `mc_token=${cookieToken}; mc_csrf=abc`)
            .set('X-CSRF-Token', 'xyz')
            .send({});
        expect(res.status).toBe(403);
    });
});

describe('Rate limit do login', () => {
    it('bloqueia com 429 depois de 10 tentativas', async () => {
        // O teste de validação acima já gastou uma tentativa neste processo.
        let last;
        for (let i = 0; i < 11; i += 1) {
            last = await request(app).post('/api/auth/login').send({});
        }
        expect(last.status).toBe(429);
    });
});
