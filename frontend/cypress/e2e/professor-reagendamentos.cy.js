/* global cy, describe, it, beforeEach */

const SERVICOS_MOCK = {
    servicos: [
        {
            id: 5,
            titulo: 'Matemática',
            horaInicio: '09:00',
            horaFim: '10:00',
            sala: 'Sala A1',
            dataInicio: '2026-08-15',
            dataFim: '2026-12-15',
            diasSemana: ['sexta'],
            nextSessionDate: '2026-08-15',
            alunos: [{ nome: 'João Costa', ano: '10' }],
        },
    ],
};

const PEDIDOS_MOCK = {
    pedidos: [
        {
            id: 21,
            title: 'Matemática',
            status: 'Pendente',
            statusKey: 'pendente',
            student: 'João Costa',
            yearLabel: '10º Ano',
            originalDate: '15/08/2026',
            originalTime: '09:00',
            newDate: '22/08/2026',
            newTime: '11:00',
            newRoom: 'Sala B2',
            reason: 'Formação interna.',
        },
    ],
};

describe('Professor — Reagendamentos', () => {
    beforeEach(() => {
        cy.loginAs('professor');

        cy.intercept('GET', '**/api/professor/servicos', {
            statusCode: 200,
            body: SERVICOS_MOCK,
        }).as('servicos');

        cy.intercept('GET', '**/api/professor/reagendamentos', {
            statusCode: 200,
            body: PEDIDOS_MOCK,
        }).as('pedidos');

        cy.visit('/professor/reagendamentos');
        cy.wait('@servicos');
        cy.wait('@pedidos');
    });

    it('mostra o titulo da pagina e a seccao de sessoes', () => {
        cy.contains('Reagendamento').should('be.visible');
        cy.contains('As Minhas Sessões').should('be.visible');
    });

    it('lista a sessao do professor com os dados corretos', () => {
        cy.contains('Matemática').should('be.visible');
        cy.contains('João Costa').should('be.visible');
        cy.contains('Sala A1').should('be.visible');
    });

    it('mostra o botao "Pedir Reagendamento" para sessoes elegiveis', () => {
        cy.contains('button', 'Pedir Reagendamento').should('be.visible');
    });

    it('abre o modal ao clicar em "Pedir Reagendamento"', () => {
        cy.contains('button', 'Pedir Reagendamento').click();
        cy.contains('Solicitar Reagendamento').should('be.visible');
        cy.contains('Nova Data Pretendida').should('be.visible');
        cy.contains('Motivo do Reagendamento').should('be.visible');
    });

    it('fecha o modal ao clicar em "Cancelar"', () => {
        cy.contains('button', 'Pedir Reagendamento').click();
        cy.contains('Solicitar Reagendamento').should('be.visible');
        cy.contains('button', 'Cancelar').click();
        cy.contains('Solicitar Reagendamento').should('not.exist');
    });

    it('submete o pedido de reagendamento com sucesso', () => {
        cy.intercept('POST', '**/api/professor/reagendamentos', {
            statusCode: 201,
            body: {
                pedido: {
                    id: 99,
                    title: 'Matemática',
                    status: 'Pendente',
                    statusKey: 'pendente',
                    student: 'João Costa',
                    yearLabel: '10º Ano',
                    originalDate: '15/08/2026',
                    originalTime: '09:00',
                    newDate: '22/08/2026',
                    newTime: '11:00',
                    newRoom: 'Sala B3',
                    reason: 'Motivo de teste.',
                },
            },
        }).as('criarPedido');

        cy.contains('button', 'Pedir Reagendamento').click();
        cy.get('input[type="date"]').clear().type('2026-08-22');
        cy.get('input[type="time"]').clear().type('11:00');
        cy.get('input[type="text"]').clear().type('Sala B3');
        cy.get('textarea').type('Motivo de teste.');
        cy.contains('button', 'Enviar Pedido').click();

        cy.wait('@criarPedido');
        cy.contains('Solicitar Reagendamento').should('not.exist');
    });

    it('lista os pedidos de reagendamento existentes', () => {
        cy.contains('Meus Pedidos de Reagendamento').should('be.visible');
        cy.contains('Formação interna.').should('be.visible');
        cy.contains('22/08/2026').should('be.visible');
    });

    it('mostra estado vazio quando o professor nao tem servicos', () => {
        cy.intercept('GET', '**/api/professor/servicos', {
            statusCode: 200,
            body: { servicos: [] },
        }).as('semServicos');

        cy.visit('/professor/reagendamentos');
        cy.wait('@semServicos');
        cy.contains('Sem serviços associados a esta conta.').should('be.visible');
    });
});
