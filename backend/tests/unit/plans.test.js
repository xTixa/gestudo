import { afterEach, describe, expect, it } from 'vitest';
import {
    getCurrentPlanKey,
    getPlanSummary,
    hasModule,
    MODULES,
    PLAN_ORDER,
    requireModule,
} from '../../src/config/plans.js';
import { fakeRes } from '../helpers.js';

const originalPlan = process.env.GESTUDO_PLANO;

afterEach(() => {
    process.env.GESTUDO_PLANO = originalPlan;
});

describe('getCurrentPlanKey', () => {
    it('usa completo quando a variável está vazia ou é inválida', () => {
        process.env.GESTUDO_PLANO = '';
        expect(getCurrentPlanKey()).toBe('completo');
        process.env.GESTUDO_PLANO = 'premium';
        expect(getCurrentPlanKey()).toBe('completo');
    });

    it('normaliza maiúsculas e espaços', () => {
        process.env.GESTUDO_PLANO = '  PLUS ';
        expect(getCurrentPlanKey()).toBe('plus');
    });
});

describe('hasModule', () => {
    it('cada módulo fica disponível a partir do pacote mínimo', () => {
        for (const [key, def] of Object.entries(MODULES)) {
            const minIndex = PLAN_ORDER.indexOf(def.desde);
            PLAN_ORDER.forEach((plan, index) => {
                expect(hasModule(key, plan), `${key} em ${plan}`).toBe(index >= minIndex);
            });
        }
    });

    it('módulo desconhecido nunca está disponível', () => {
        expect(hasModule('nao_existe', 'completo')).toBe(false);
    });
});

describe('getPlanSummary', () => {
    it('reflete o pacote atual', () => {
        process.env.GESTUDO_PLANO = 'basico';
        const summary = getPlanSummary();
        expect(summary.plano).toBe('basico');
        expect(summary.limites.alunos).toBe(40);
        expect(summary.modulos.financeiro).toBe(false);
        expect(summary.catalogo.financeiro.desdeNome).toBe('Profissional');
    });
});

describe('requireModule', () => {
    it('deixa passar quando o módulo está incluído', () => {
        process.env.GESTUDO_PLANO = 'profissional';
        let called = false;
        requireModule('financeiro')({}, fakeRes(), () => {
            called = true;
        });
        expect(called).toBe(true);
    });

    it('responde 403 PLAN_MODULE_UNAVAILABLE quando não está', () => {
        process.env.GESTUDO_PLANO = 'plus';
        const res = fakeRes();
        let called = false;
        requireModule('financeiro')({}, res, () => {
            called = true;
        });
        expect(called).toBe(false);
        expect(res.statusCode).toBe(403);
        expect(res.body).toMatchObject({
            code: 'PLAN_MODULE_UNAVAILABLE',
            modulo: 'financeiro',
            planoAtual: 'plus',
            planoNecessario: 'profissional',
        });
    });
});
