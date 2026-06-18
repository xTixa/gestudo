import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Login from '../Login';

function renderLogin(props = {}) {
    return render(
        <MemoryRouter>
            <Login {...props} />
        </MemoryRouter>
    );
}

describe('Login', () => {
    it('submete credenciais e chama onLogin quando a autenticacao tem sucesso', async () => {
        const onLogin = vi.fn();
        const authenticatedUser = {
            id_user: 1,
            email: 'gestor@example.com',
            role: 'gestor',
            primeiraLogin: false,
        };

        vi.spyOn(window, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                message: 'Login efetuado com sucesso.',
                token: 'jwt-token',
                csrfToken: 'csrf-token',
                user: authenticatedUser,
            }),
        });

        renderLogin({ onLogin });

        await userEvent.type(screen.getByLabelText(/^email$/i), authenticatedUser.email);
        await userEvent.type(screen.getByLabelText(/palavra-passe/i), 'secret123');
        await userEvent.click(screen.getByRole('button', { name: /entrar no bloco/i }));

        await waitFor(() => expect(onLogin).toHaveBeenCalledWith(authenticatedUser));
        expect(localStorage.getItem('mc_token')).toBe('jwt-token');
        expect(localStorage.getItem('mc_csrf_token')).toBe('csrf-token');
        expect(localStorage.getItem('mc_user')).toBe(JSON.stringify(authenticatedUser));
    });

    it('mostra erro quando a autenticacao falha', async () => {
        vi.spyOn(window, 'fetch').mockResolvedValueOnce({
            ok: false,
            json: async () => ({ message: 'Credenciais invalidas.' }),
        });

        renderLogin();

        await userEvent.type(screen.getByLabelText(/^email$/i), 'user@example.com');
        await userEvent.type(screen.getByLabelText(/palavra-passe/i), 'wrong');
        await userEvent.click(screen.getByRole('button', { name: /entrar no bloco/i }));

        expect(await screen.findByText('Credenciais invalidas.')).toBeInTheDocument();
    });
});
