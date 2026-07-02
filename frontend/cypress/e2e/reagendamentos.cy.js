/* global cy, describe, it, beforeEach */

const SESSOES_MOCK = {
    atividadesPorDia: {
        '2026-08-15': [
            {
                id: 10,
                titulo: 'Matemática',
                hora: '09:00',
                horaFim: '10:00',
                local: 'Sala A1',
                professor: 'Prof. Ana Silva',
                alunos: ['João Costa', 'Maria Lopes'],
            },
        ],
        '2026-08-20': [
            {
                id: 11,
                titulo: 'Português',
                hora: '14:00',
                horaFim: '15:00',
                local: 'Sala B2',
                professor: 'Prof. Rui Santos',
                alunos: ['Pedro Ferreira'],
            },
        ],
    },
};

const PEDIDOS_MOCK = {
    pedidos: [
        {
            id: 1,
            title: 'Matemática',
            status: 'Pendente',
            statusKey: 'pendente',
            student: 'João Costa',
            professor: 'Prof. Ana Silva',
            newDate: '20/08/2026',
            newTime: '11:00',
        },
    ],
};

const SALAS_MOCK = {
    salas: [
        { id_sala: 1, nome: 'Sala A1', capacidade: 20, ativa: true },
        { id_sala: 2, nome: 'Sala B2', capacidade: 15, ativa: true },
    ],
};

function interceptBase() {
    cy.intercept('GET', '**/api/gestor/agenda*', { statusCode: 200, body: SESSOES_MOCK }).as('sessoes');
    cy.intercept('GET', '**/api/gestor/reagendamentos/pedidos*', { statusCode: 200, body: PEDIDOS_MOCK }).as('pedidos');
    cy.intercept('GET', '**/api/gestor/salas', { statusCode: 200, body: SALAS_MOCK }).as('salas');
}

describe('Gestor — Reagendamentos', () => {
    beforeEach(() => {
        cy.loginAs('gestor');
        interceptBase();
        cy.visit('/gestor/reagendar');
        cy.wait('@sessoes');
        cy.wait('@pedidos');
    });

    it('mostra o titulo da pagina e os cards de estatisticas', () => {
        cy.contains('Gestão de reagendamentos').should('be.visible');
        cy.contains('Sessões elegíveis').should('be.visible');
        cy.contains('Pedidos pendentes').should('be.visible');
    });

    it('lista as sessoes agendadas agrupadas por data', () => {
        cy.contains('Matemática').should('be.visible');
        cy.contains('Prof. Ana Silva').should('be.visible');
        cy.contains('Português').should('be.visible');
        cy.contains('Prof. Rui Santos').should('be.visible');
    });

    it('abre o modal de reagendamento ao clicar em "Reagendar"', () => {
        cy.contains('button', 'Reagendar').first().click();
        cy.contains('Reagendar aula').should('be.visible');
        cy.contains('Nova data pretendida').should('be.visible');
        cy.contains('Horário disponível').should('be.visible');
    });

    it('fecha o modal de reagendamento ao clicar em "Cancelar"', () => {
        cy.contains('button', 'Reagendar').first().click();
        cy.contains('Reagendar aula').should('be.visible');
        cy.contains('button', 'Cancelar').click();
        cy.contains('Reagendar aula').should('not.exist');
    });

    it('lista o pedido pendente no painel lateral', () => {
        cy.contains('Histórico de pedidos').should('be.visible');
        cy.contains('João Costa').should('be.visible');
        cy.contains('20/08/2026').should('be.visible');
        cy.contains('button', 'Aprovar').should('be.visible');
        cy.contains('button', 'Rejeitar').should('be.visible');
    });

    it('aprova um pedido pendente com sucesso', () => {
        cy.intercept('PATCH', '**/api/gestor/reagendamentos/pedidos/1/estado', {
            statusCode: 200,
            body: { message: 'Pedido aprovado.' },
        }).as('aprovacao');

        cy.contains('button', 'Aprovar').click();
        cy.wait('@aprovacao');
        cy.contains('Pedido aprovado e sessão reagendada com sucesso.').should('be.visible');
    });

    it('abre modal de rejeicao e exige motivo antes de confirmar', () => {
        cy.contains('button', 'Rejeitar').click();
        cy.contains('Rejeitar pedido').should('be.visible');

        cy.contains('button', 'Confirmar rejeição').should('be.disabled');

        cy.get('textarea[placeholder*="motivo da rejeição"]').type('Conflito de horário.');
        cy.contains('button', 'Confirmar rejeição').should('not.be.disabled');
    });

    it('rejeita um pedido pendente com motivo preenchido', () => {
        cy.intercept('PATCH', '**/api/gestor/reagendamentos/pedidos/1/estado', {
            statusCode: 200,
            body: { message: 'Pedido rejeitado.' },
        }).as('rejeicao');

        cy.contains('button', 'Rejeitar').click();
        cy.get('textarea[placeholder*="motivo da rejeição"]').type('Sala indisponível.');
        cy.contains('button', 'Confirmar rejeição').click();
        cy.wait('@rejeicao');
        cy.contains('Pedido rejeitado com sucesso.').should('be.visible');
    });

    it('filtra sessoes ao mudar o periodo para "Proximos 30 dias"', () => {
        cy.intercept('GET', '**/api/gestor/agenda*proximos30*', {
            statusCode: 200,
            body: { atividadesPorDia: {} },
        }).as('sessoes30');

        cy.get('select').first().select('proximos30');
        cy.wait('@sessoes30');
    });

    it('mostra estado vazio quando nao existem sessoes agendadas', () => {
        cy.intercept('GET', '**/api/gestor/agenda*', {
            statusCode: 200,
            body: { atividadesPorDia: {} },
        }).as('semSessoes');

        cy.intercept('GET', '**/api/gestor/reagendamentos/pedidos*', {
            statusCode: 200,
            body: { pedidos: [] },
        });

        cy.visit('/gestor/reagendar');
        cy.wait('@semSessoes');
        cy.contains('Sem sessões agendadas para este mês.').should('be.visible');
    });
});
