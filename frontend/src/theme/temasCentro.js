// Cores de tema que o gestor pode escolher para o centro.
// Só dados: é importado pela app, pelo tailwind.config (que gera as paletas a
// partir de "paleta", um nome de tailwindcss/colors) e pelo teste do backend
// que confirma que a lista coincide com backend/src/config/temas.js.
export const TEMAS_CENTRO = [
    { id: 'ciano', nome: 'Ciano', paleta: 'cyan', amostra: '#06b6d4' },
    { id: 'azul', nome: 'Azul', paleta: 'blue', amostra: '#3b82f6' },
    { id: 'indigo', nome: 'Índigo', paleta: 'indigo', amostra: '#6366f1' },
    { id: 'violeta', nome: 'Violeta', paleta: 'violet', amostra: '#8b5cf6' },
    { id: 'rosa', nome: 'Rosa', paleta: 'pink', amostra: '#ec4899' },
    { id: 'laranja', nome: 'Laranja', paleta: 'orange', amostra: '#f97316' },
    { id: 'verde', nome: 'Verde', paleta: 'emerald', amostra: '#10b981' },
];

export const TEMA_CENTRO_POR_OMISSAO = 'ciano';
