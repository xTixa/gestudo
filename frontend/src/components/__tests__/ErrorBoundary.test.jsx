import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function ComponenteQueRebenta() {
    throw new Error('Erro de teste');
}

describe('ErrorBoundary', () => {
    it('renderiza filhos quando nao ha erro', () => {
        render(
            <ErrorBoundary>
                <p>Conteudo normal</p>
            </ErrorBoundary>
        );

        expect(screen.getByText('Conteudo normal')).toBeInTheDocument();
    });

    it('mostra UI de erro quando um filho lanca excepcao', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ComponenteQueRebenta />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo correu mal')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('recupera e volta a mostrar filhos ao clicar em "Tentar novamente"', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        let deveRebentar = true;

        function ComponenteCondicional() {
            if (deveRebentar) throw new Error('Erro de teste');
            return <p>Recuperado</p>;
        }

        const { rerender } = render(
            <ErrorBoundary>
                <ComponenteCondicional />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo correu mal')).toBeInTheDocument();

        deveRebentar = false;
        fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

        rerender(
            <ErrorBoundary>
                <ComponenteCondicional />
            </ErrorBoundary>
        );

        expect(screen.getByText('Recuperado')).toBeInTheDocument();
        consoleSpy.mockRestore();
    });
});
