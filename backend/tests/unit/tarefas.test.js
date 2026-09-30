import { afterEach, describe, expect, it } from 'vitest';
import {
    agruparPorDestinatario,
    aulasEfetivas,
    diaVencimentoConfigurado,
    formatarAula,
    mensagemAVencer,
    mensagemLembreteAulas,
    mensagemVencida,
} from '../../src/scheduler/tarefas.js';

const mensalidade = (overrides) => ({
    id_mensalidade: 1,
    mes_referencia: '2026-10-01',
    data_vencimento: '2026-10-08',
    valor_em_divida: '50.00',
    aluno_nome: 'Ana',
    id_user_aluno: 10,
    id_user_encarregado: null,
    ...overrides,
});

describe('agruparPorDestinatario', () => {
    it('o encarregado recebe os avisos de todos os educandos', () => {
        const grupos = agruparPorDestinatario([
            mensalidade({ id_mensalidade: 1, aluno_nome: 'Ana', id_user_encarregado: 99 }),
            mensalidade({ id_mensalidade: 2, aluno_nome: 'Rui', id_user_aluno: 11, id_user_encarregado: 99 }),
        ]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0]).toMatchObject({ idUser: 99, papel: 'encarregado' });
        expect(grupos[0].itens).toHaveLength(2);
    });

    it('aluno sem encarregado recebe o seu aviso; sem nenhum utilizador é ignorado', () => {
        const grupos = agruparPorDestinatario([
            mensalidade({ id_user_aluno: 10 }),
            mensalidade({ id_mensalidade: 3, id_user_aluno: null }),
        ]);
        expect(grupos).toEqual([
            expect.objectContaining({ idUser: 10, papel: 'aluno' }),
        ]);
    });
});

describe('mensagens de mensalidades', () => {
    it('a vencer, uma mensalidade, para o encarregado', () => {
        const msg = mensagemAVencer({
            papel: 'encarregado',
            itens: [mensalidade({ id_user_encarregado: 99 })],
        });
        expect(msg.titulo).toBe('Mensalidade a vencer');
        expect(msg.descricao).toBe(
            'A mensalidade de Ana de outubro de 2026 (50,00 €) vence a 08/10/2026.'
        );
    });

    it('a vencer, várias mensalidades', () => {
        const msg = mensagemAVencer({
            papel: 'encarregado',
            itens: [mensalidade({}), mensalidade({ aluno_nome: 'Rui', valor_em_divida: '30' })],
        });
        expect(msg.titulo).toBe('2 mensalidades a vencer');
        expect(msg.descricao).toContain('Rui: outubro de 2026, 30,00 € em dívida');
    });

    it('vencida, para o próprio aluno (sem nome do aluno)', () => {
        const msg = mensagemVencida({ papel: 'aluno', itens: [mensalidade({})] });
        expect(msg.descricao).toBe(
            'A mensalidade de outubro de 2026 venceu a 08/10/2026 e tem 50,00 € por pagar.'
        );
    });
});

describe('lembrete de aulas', () => {
    const aula = { hora: '14:00', horaFim: '15:00', titulo: 'Explicação - Matemática', local: 'Sala 2' };

    it('ignora sessões repostas noutro dia mas mantém a reposição', () => {
        const aulas = aulasEfetivas([
            { ...aula, estado: 'reposta', dataReposicao: '2026-10-05' },
            { ...aula, estado: 'reposta', dataOriginal: '2026-09-28' },
            { ...aula, estado: '' },
        ]);
        expect(aulas).toHaveLength(2);
    });

    it('formata horário, título e sala', () => {
        expect(formatarAula(aula)).toBe('14:00–15:00 Explicação - Matemática · Sala 2');
        expect(formatarAula({ ...aula, horaFim: '', local: 'Sem sala' })).toBe(
            '14:00 Explicação - Matemática'
        );
    });

    it('adapta o texto ao destinatário', () => {
        expect(mensagemLembreteAulas({ papel: 'aluno', aulas: [aula] }).titulo).toBe('Tens 1 aula amanhã');
        expect(mensagemLembreteAulas({ papel: 'professor', aulas: [aula, aula] }).titulo).toBe(
            'Tem 2 aulas amanhã'
        );
        const enc = mensagemLembreteAulas({ papel: 'encarregado', nomeAluno: 'Ana', aulas: [aula] });
        expect(enc.titulo).toBe('Aulas de amanhã: Ana');
        expect(enc.descricao).toContain('Ana tem 1 aula amanhã');
    });
});

describe('diaVencimentoConfigurado', () => {
    const original = process.env.MENSALIDADES_DIA_VENCIMENTO;
    afterEach(() => {
        process.env.MENSALIDADES_DIA_VENCIMENTO = original ?? '';
        if (original === undefined) delete process.env.MENSALIDADES_DIA_VENCIMENTO;
    });

    it('usa 8 por omissão e aceita 1 a 28', () => {
        delete process.env.MENSALIDADES_DIA_VENCIMENTO;
        expect(diaVencimentoConfigurado()).toBe(8);
        process.env.MENSALIDADES_DIA_VENCIMENTO = '15';
        expect(diaVencimentoConfigurado()).toBe(15);
        process.env.MENSALIDADES_DIA_VENCIMENTO = '31';
        expect(diaVencimentoConfigurado()).toBe(8);
    });
});
