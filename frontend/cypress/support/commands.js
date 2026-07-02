/* global cy, Cypress */

Cypress.Commands.add('loginAs', (role = 'gestor') => {
    const users = {
        gestor: {
            id_user: 1,
            nome: 'Gestor Teste',
            email: 'gestor@example.com',
            role: 'gestor',
            primeiraLogin: false,
        },
        professor: {
            id_user: 2,
            nome: 'Prof. Teste',
            email: 'prof@example.com',
            role: 'professor',
            primeiraLogin: false,
        },
        aluno: {
            id_user: 3,
            nome: 'Aluno Teste',
            email: 'aluno@example.com',
            role: 'aluno',
            primeiraLogin: false,
        },
    };

    const user = users[role];

    cy.intercept('GET', '**/api/auth/csrf-token', {
        statusCode: 200,
        body: { csrfToken: 'csrf-token-teste' },
    });

    cy.window().then((win) => {
        win.localStorage.setItem('mc_token', 'jwt-token-teste');
        win.localStorage.setItem('mc_csrf_token', 'csrf-token-teste');
        win.localStorage.setItem('mc_user', JSON.stringify(user));
    });
});
