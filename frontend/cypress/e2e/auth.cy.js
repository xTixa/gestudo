/* global cy, describe, it, beforeEach */

describe('Autenticacao — cenarios de erro e protecao de rotas', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/auth/csrf-token', {
            statusCode: 200,
            body: { csrfToken: 'csrf-token' },
        });
    });

    it('mostra mensagem de erro quando as credenciais sao invalidas', () => {
        cy.intercept('POST', '**/api/auth/login', {
            statusCode: 401,
            body: { message: 'Credenciais inválidas.' },
        }).as('loginFalhado');

        cy.visit('/login');
        cy.get('input[type="email"]').type('invalido@example.com');
        cy.get('input[type="password"]').type('passworderrada');
        cy.contains('button', /entrar no bloco/i).click();

        cy.wait('@loginFalhado');
        cy.contains('Credenciais inválidas.').should('be.visible');
        cy.location('pathname').should('eq', '/login');
    });

    it('redireciona para /login ao aceder a rota protegida sem autenticacao', () => {
        cy.visit('/gestor/dashboard');
        cy.location('pathname').should('eq', '/login');
    });
});
