// Cores de tema que o gestor pode escolher para o centro.
// Alinhado com frontend/src/theme/temasCentro.js (onde estão as paletas).
export const TEMAS_CENTRO = [
    'ciano',
    'azul',
    'indigo',
    'violeta',
    'rosa',
    'laranja',
    'verde',
];

export const TEMA_POR_OMISSAO = 'ciano';

export function isTemaValido(tema) {
    return TEMAS_CENTRO.includes(tema);
}
