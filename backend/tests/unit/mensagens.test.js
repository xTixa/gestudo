import { describe, expect, it } from 'vitest';
import {
    LIMITE_CORPO,
    LIMITE_PARTICIPANTES,
    MensagensError,
    normalizarAssunto,
    normalizarCorpo,
    normalizarParticipantes,
    preview,
} from '../../src/services/mensagensService.js';
import { mensagemResumoMensagens } from '../../src/scheduler/tarefas.js';

describe('normalizarCorpo', () => {
    it('apara espaços e normaliza quebras de linha', () => {
        expect(normalizarCorpo('  olá\r\nmundo  ')).toBe('olá\nmundo');
    });

    it('rejeita mensagens vazias ou longas demais com 400', () => {
        expect(() => normalizarCorpo('   ')).toThrow(MensagensError);
        expect(() => normalizarCorpo(null)).toThrow('vazia');
        try {
            normalizarCorpo('x'.repeat(LIMITE_CORPO + 1));
        } catch (error) {
            expect(error.status).toBe(400);
        }
        expect(normalizarCorpo('x'.repeat(LIMITE_CORPO))).toHaveLength(LIMITE_CORPO);
    });
});

describe('normalizarAssunto', () => {
    it('assunto vazio fica null', () => {
        expect(normalizarAssunto('  ')).toBeNull();
        expect(normalizarAssunto(undefined)).toBeNull();
        expect(normalizarAssunto(' Faltas ')).toBe('Faltas');
    });

    it('rejeita assuntos com mais de 150 caracteres', () => {
        expect(() => normalizarAssunto('a'.repeat(151))).toThrow(MensagensError);
    });
});

describe('normalizarParticipantes', () => {
    it('remove duplicados, o próprio autor e ids inválidos', () => {
        expect(normalizarParticipantes([3, '3', 7, 1, 'x', -2, 0], 1)).toEqual([3, 7]);
    });

    it('exige pelo menos um destinatário', () => {
        expect(() => normalizarParticipantes([], 1)).toThrow('destinatário');
        expect(() => normalizarParticipantes([1], 1)).toThrow('destinatário');
        expect(() => normalizarParticipantes('3', 1)).toThrow('destinatário');
    });

    it('limita o tamanho dos grupos', () => {
        const muitos = Array.from({ length: LIMITE_PARTICIPANTES + 1 }, (_, i) => i + 2);
        expect(() => normalizarParticipantes(muitos, 1)).toThrow('máximo');
    });
});

describe('preview', () => {
    it('junta linhas e corta com reticências', () => {
        expect(preview('a\n\nb   c')).toBe('a b c');
        expect(preview('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
    });
});

describe('mensagemResumoMensagens', () => {
    it('lista até três autores', () => {
        expect(mensagemResumoMensagens({ total: 1, autores: ['Ana'] })).toEqual({
            titulo: 'Tem 1 mensagem por ler',
            descricao: 'De: Ana.',
        });
        expect(
            mensagemResumoMensagens({ total: 9, autores: ['A', 'B', 'C', 'D', 'E'] }).descricao
        ).toBe('De: A, B, C e mais 2.');
    });
});
