/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';
import { coresTema, cssVariaveisTema } from './tailwind/coresTema.js';

// As cores apontam para variáveis CSS que mudam com o modo escuro
// (ver tailwind/coresTema.js). "s" = superfícies, "t" = texto.
const superficies = coresTema('s');
const conteudo = coresTema('t');

export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'Inter',
                    'ui-sans-serif',
                    'system-ui',
                    '-apple-system',
                    'Segoe UI',
                    'sans-serif',
                ],
            },
            colors: {
                ...superficies,
                // Branco que não muda no modo escuro (ex.: botão de um interruptor).
                branco: '#ffffff',
            },
            textColor: conteudo,
            placeholderColor: conteudo,
            fill: conteudo,
            stroke: conteudo,
            caretColor: conteudo,
            textDecorationColor: conteudo,
        },
    },
    plugins: [
        plugin(({ addBase }) => {
            addBase(cssVariaveisTema());
        }),
    ],
};
