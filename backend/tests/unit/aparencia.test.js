import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEMAS_CENTRO, TEMA_POR_OMISSAO } from '../../src/config/temas.js';
import { TEMAS_CENTRO as TEMAS_FRONTEND } from '../../../frontend/src/theme/temasCentro.js';

const query = vi.fn();
vi.mock('../../src/config/db.js', () => ({ db: { query: (...args) => query(...args) } }));

const { definirTemaCentro, obterTemaCentro } = await import(
    '../../src/services/aparenciaService.js'
);

beforeEach(() => {
    query.mockReset();
});

describe('temas do centro', () => {
    it('a lista do backend é a mesma do frontend', () => {
        expect(TEMAS_FRONTEND.map((tema) => tema.id)).toEqual(TEMAS_CENTRO);
        expect(TEMAS_CENTRO).toContain(TEMA_POR_OMISSAO);
    });
});

describe('obterTemaCentro', () => {
    it('devolve o tema guardado', async () => {
        query.mockResolvedValue({ rows: [{ valor: 'violeta' }] });
        await expect(obterTemaCentro()).resolves.toBe('violeta');
    });

    it('usa o tema por omissão sem valor, com valor antigo ou com erro da BD', async () => {
        query.mockResolvedValueOnce({ rows: [] });
        await expect(obterTemaCentro()).resolves.toBe(TEMA_POR_OMISSAO);

        query.mockResolvedValueOnce({ rows: [{ valor: 'dourado' }] });
        await expect(obterTemaCentro()).resolves.toBe(TEMA_POR_OMISSAO);

        query.mockRejectedValueOnce(new Error('sem ligação'));
        await expect(obterTemaCentro()).resolves.toBe(TEMA_POR_OMISSAO);
    });
});

describe('definirTemaCentro', () => {
    it('guarda um tema válido com quem o mudou', async () => {
        query.mockResolvedValue({ rows: [] });
        await expect(definirTemaCentro('verde', 7)).resolves.toBe('verde');
        expect(query).toHaveBeenCalledOnce();
        expect(query.mock.calls[0][1]).toEqual(['tema_cor', 'verde', 7]);
    });

    it('rejeita um tema desconhecido com 400, sem tocar na BD', async () => {
        await expect(definirTemaCentro('dourado', 7)).rejects.toMatchObject({
            status: 400,
        });
        expect(query).not.toHaveBeenCalled();
    });
});
