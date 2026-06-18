import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatCard from '../StatCard';

function TestIcon(props) {
    return <svg aria-label="icone" {...props} />;
}

describe('StatCard', () => {
    it('renderiza titulo, valor e icone quando fornecido', () => {
        render(
            <StatCard
                title="Alunos ativos"
                value="42"
                icon={TestIcon}
                bgColor="bg-lime-500"
            />
        );

        expect(screen.getByText('Alunos ativos')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByLabelText('icone')).toBeInTheDocument();
    });

    it('nao renderiza icone quando nao e fornecido', () => {
        render(<StatCard title="Servicos" value="8" />);

        expect(screen.queryByLabelText('icone')).not.toBeInTheDocument();
    });
});
