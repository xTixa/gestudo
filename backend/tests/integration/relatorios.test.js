import jwt from 'jsonwebtoken';
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

process.env.JWT_SECRET = 'segredo-de-teste-integracao';

const { default: app } = await import('../../src/app.js');

function tokenGestor() {
    return jwt.sign({ id: 1, role: 'gestor' }, process.env.JWT_SECRET);
}

describe('GET /api/gestor/relatorios/interesse-disciplinas', () => {
    beforeEach(() => mocks.query.mockReset());

    it('devolve uma linha por inscricao mesmo quando o aluno pediu multiplas disciplinas', async () => {
        // Simula o resultado da view vw_interesse_disciplinas apos a correcao
        // do bug de duplicacao: string_agg + GROUP BY por id_inscricao_publica
        // devolve uma unica linha com as disciplinas concatenadas, em vez de
        // uma linha por disciplina (o que acontecia com o jsonb_array_elements
        // sem reagregar).
        const linhaAgregada = {
            id_inscricao_publica: 35,
            nome_completo: 'Ana Leonor Mota Videira',
            estado: 'aprovada',
            disciplinas: 'Matemática; Português',
            modalidades: 'Grupo',
            pacotes: '8',
            created_at: '2026-08-02T16:55:29.379Z',
        };

        mocks.query.mockImplementation((sql) => {
            const query = String(sql || '');
            if (query.includes('FROM users')) {
                return Promise.resolve({
                    rows: [{ role: 'gestor', status: true }],
                });
            }
            if (query.includes('COUNT(*)')) {
                return Promise.resolve({ rows: [{ total: 1 }] });
            }
            return Promise.resolve({ rows: [linhaAgregada] });
        });

        const response = await request(app)
            .get('/api/gestor/relatorios/interesse-disciplinas')
            .set('Authorization', `Bearer ${tokenGestor()}`)
            .expect(200);

        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0]).toMatchObject({
            id_inscricao_publica: 35,
            nome_completo: 'Ana Leonor Mota Videira',
            disciplinas: 'Matemática; Português',
        });
        // Nao deve existir nenhuma linha extra para a mesma inscricao
        // (regressao do bug: jsonb_array_elements sem GROUP BY produzia uma
        // linha por disciplina, ex. duas linhas para "Ana Leonor").
        const linhasDaMesmaInscricao = response.body.items.filter(
            (item) => item.id_inscricao_publica === 35
        );
        expect(linhasDaMesmaInscricao).toHaveLength(1);
    });

    it('devolve 401 sem token de autenticacao', async () => {
        await request(app)
            .get('/api/gestor/relatorios/interesse-disciplinas')
            .expect(401);
    });

    it('devolve 404 para uma chave de relatorio desconhecida', async () => {
        mocks.query.mockImplementation((sql) => {
            const query = String(sql || '');
            if (query.includes('FROM users')) {
                return Promise.resolve({
                    rows: [{ role: 'gestor', status: true }],
                });
            }
            return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
            .get('/api/gestor/relatorios/relatorio-inexistente')
            .set('Authorization', `Bearer ${tokenGestor()}`)
            .expect(404);

        expect(response.body.relatoriosDisponiveis).toContain(
            'interesse-disciplinas'
        );
    });
});
