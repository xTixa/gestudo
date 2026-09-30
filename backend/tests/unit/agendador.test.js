import { beforeEach, describe, expect, it, vi } from 'vitest';

// Base de dados e alertas simulados: o teste verifica o que o agendador
// pede à BD, sem precisar de uma.
const query = vi.fn();
vi.mock('../../src/config/db.js', () => ({ db: { query: (...args) => query(...args) } }));

const dispatchAlert = vi.fn(async () => ({ success: true }));
vi.mock('../../src/services/alertasDispatchService.js', () => ({
    dispatchAlert: (...args) => dispatchAlert(...args),
}));

const { _limparRegisto, executarTarefa, registarTarefa } = await import(
    '../../src/scheduler/agendador.js'
);

function responderBd({ reclamar = { id_execucao: 1, tentativas: 1 }, gestores = [] } = {}) {
    query.mockImplementation(async (sql) => {
        if (sql.includes('INSERT INTO tarefas_agendadas_execucoes')) {
            return { rows: reclamar ? [reclamar] : [] };
        }
        if (sql.includes("role) = 'gestor'")) {
            return { rows: gestores.map((id_user) => ({ id_user })) };
        }
        return { rows: [] };
    });
}

function chamadasUpdate() {
    return query.mock.calls.filter(([sql]) => sql.includes('UPDATE tarefas_agendadas_execucoes'));
}

beforeEach(() => {
    _limparRegisto();
    query.mockReset();
    dispatchAlert.mockClear();
    process.env.GESTUDO_PLANO = 'completo';
});

describe('executarTarefa', () => {
    it('corre a tarefa e grava o resultado como concluída', async () => {
        responderBd();
        const executar = vi.fn(async () => ({ enviados: 3 }));
        registarTarefa({ nome: 't', titulo: 'T', agenda: { tipo: 'diaria', hora: '09:00' }, executar });

        const agora = new Date('2026-09-30T08:30:00Z');
        const resultado = await executarTarefa('t', { periodo: '2026-09-30', agora });

        expect(resultado).toEqual({ executada: true, resultado: { enviados: 3 } });
        expect(executar).toHaveBeenCalledWith(
            expect.objectContaining({ hoje: '2026-09-30', periodo: '2026-09-30', manual: false })
        );
        const [, params] = chamadasUpdate()[0];
        expect(params[1]).toBe('concluida');
        expect(JSON.parse(params[2])).toEqual({ enviados: 3 });
    });

    it('não corre se o período já foi reclamado', async () => {
        responderBd({ reclamar: null });
        const executar = vi.fn();
        registarTarefa({ nome: 't', titulo: 'T', agenda: { tipo: 'diaria', hora: '09:00' }, executar });

        const resultado = await executarTarefa('t', { periodo: '2026-09-30' });
        expect(resultado).toEqual({ executada: false, motivo: 'ja_executada' });
        expect(executar).not.toHaveBeenCalled();
    });

    it('respeita o pacote, mesmo em execução manual', async () => {
        process.env.GESTUDO_PLANO = 'basico';
        responderBd();
        const executar = vi.fn();
        registarTarefa({
            nome: 't',
            titulo: 'T',
            agenda: { tipo: 'diaria', hora: '09:00' },
            requerModulo: 'financeiro',
            executar,
        });

        const resultado = await executarTarefa('t', { manual: true });
        expect(resultado.motivo).toBe('modulo_indisponivel');
        expect(query).not.toHaveBeenCalled();
    });

    it('ativa() só bloqueia execuções automáticas', async () => {
        responderBd();
        const executar = vi.fn(async () => ({}));
        registarTarefa({
            nome: 't',
            titulo: 'T',
            agenda: { tipo: 'mensal', dia: 1, hora: '07:00' },
            ativa: async () => false,
            executar,
        });

        expect((await executarTarefa('t', { periodo: '2026-10' })).motivo).toBe('desativada');
        expect(executar).not.toHaveBeenCalled();

        await executarTarefa('t', { manual: true, agora: new Date('2026-10-02T10:00:00Z') });
        expect(executar).toHaveBeenCalledTimes(1);
        const [, params] = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO'));
        expect(params[1]).toBe('manual:2026-10-02T10:00:00.000Z');
    });

    it('marca a falha e só avisa os gestores na última tentativa', async () => {
        const falha = async () => {
            throw new Error('BD em baixo');
        };
        registarTarefa({ nome: 't', titulo: 'T', agenda: { tipo: 'diaria', hora: '09:00' }, executar: falha });

        responderBd({ reclamar: { id_execucao: 1, tentativas: 1 }, gestores: [5] });
        const primeira = await executarTarefa('t', { periodo: '2026-09-30' });
        expect(primeira).toMatchObject({ executada: false, motivo: 'falhou', erro: 'BD em baixo' });
        expect(chamadasUpdate()[0][1][1]).toBe('falhou');
        expect(dispatchAlert).not.toHaveBeenCalled();

        responderBd({ reclamar: { id_execucao: 1, tentativas: 3 }, gestores: [5] });
        await executarTarefa('t', { periodo: '2026-09-30' });
        expect(dispatchAlert).toHaveBeenCalledWith(
            expect.objectContaining({ codigo: 'tarefas-automaticas', for_user_ids: [5] })
        );
    });

    it('execução manual que falha propaga o erro', async () => {
        responderBd();
        registarTarefa({
            nome: 't',
            titulo: 'T',
            agenda: { tipo: 'diaria', hora: '09:00' },
            executar: async () => {
                throw new Error('x');
            },
        });
        await expect(executarTarefa('t', { manual: true })).rejects.toThrow('x');
    });

    it('tarefa desconhecida dá 404', async () => {
        await expect(executarTarefa('nao-existe')).rejects.toMatchObject({ status: 404 });
    });
});
