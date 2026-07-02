import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ActionBadge from '../ActionBadge';

describe('ActionBadge', () => {
    it.each([
        ['CREATE', 'CREATE'],
        ['UPDATE', 'UPDATE'],
        ['DELETE', 'DELETE'],
        ['LOGIN', 'LOGIN'],
    ])('renderiza label "%s" para action "%s"', (action, expectedLabel) => {
        render(<ActionBadge action={action} />);
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });

    it('renderiza o proprio valor para actions desconhecidas', () => {
        render(<ActionBadge action="EXPORT" />);
        expect(screen.getByText('EXPORT')).toBeInTheDocument();
    });
});
