import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EnrollmentStatusBadge from '../EnrollmentStatusBadge';

describe('EnrollmentStatusBadge', () => {
    it('mostra "Aprovada" para status aprovada', () => {
        render(<EnrollmentStatusBadge status="aprovada" />);
        expect(screen.getByText('Aprovada')).toBeInTheDocument();
    });

    it('mostra "Rejeitada" para status rejeitada', () => {
        render(<EnrollmentStatusBadge status="rejeitada" />);
        expect(screen.getByText('Rejeitada')).toBeInTheDocument();
    });

    it('mostra "Pendente" para status pendente', () => {
        render(<EnrollmentStatusBadge status="pendente" />);
        expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('usa pendente como fallback para status desconhecido', () => {
        render(<EnrollmentStatusBadge status="desconhecido" />);
        expect(screen.getByText('Pendente')).toBeInTheDocument();
    });
});
