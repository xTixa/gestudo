/* global cy, describe, it */

describe('Login', () => {
    it('permite autenticar um gestor e navegar para o dashboard', () => {
        cy.intercept('POST', 'https://api.alunos.blocodenotas.pt/api/auth/login', {
            statusCode: 200,
            body: {
                message: 'Login efetuado com sucesso.',
                token: 'jwt-token',
                csrfToken: 'csrf-token',
                user: {
                    id_user: 1,
                    nome: 'Gestor Teste',
                    email: 'gestor@example.com',
                    role: 'gestor',
                    primeiraLogin: false,
                },
            },
        }).as('login');

        cy.intercept('GET', 'https://api.alunos.blocodenotas.pt/api/auth/csrf-token', {
            statusCode: 200,
            body: { csrfToken: 'csrf-token' },
        });

        cy.visit('/login');
        cy.get('input[type="email"]').type('gestor@example.com');
        cy.get('input[type="password"]').type('secret123');
        cy.contains('button', /entrar no bloco/i).click();

        cy.wait('@login');
        cy.location('pathname').should('eq', '/gestor/dashboard');
        cy.window().its('localStorage.mc_token').should('eq', 'jwt-token');
    });
});
