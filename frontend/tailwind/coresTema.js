/**
 * Cores do tema (modo claro/escuro), geradas em tempo de build.
 *
 * As paletas do Tailwind usadas na app passam a apontar para variáveis CSS,
 * com duas escalas por paleta:
 *   --s-<paleta>-<tom>  superfícies: fundos, bordas, anéis, gradientes
 *   --t-<paleta>-<tom>  conteúdo: texto, placeholder, fill, stroke
 *
 * No modo claro as duas escalas têm as cores originais do Tailwind. No modo
 * escuro os tons claros das superfícies escurecem (bg-slate-50 passa a ser o
 * fundo da página) e os tons escuros do texto clareiam (text-slate-800 passa a
 * ser texto claro). Assim as classes existentes funcionam nos dois modos sem
 * variantes dark:.
 *
 * Elementos que já são escuros no modo claro (ex.: a barra lateral) usam a
 * classe .zona-escura, que repõe as cores originais dentro dela.
 */
import colors from 'tailwindcss/colors';
import {
    TEMA_CENTRO_POR_OMISSAO,
    TEMAS_CENTRO,
} from '../src/theme/temasCentro.js';

export const TONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Fundo dos cartões no modo escuro (bg-white). Serve de base às misturas.
const CARTAO_ESCURO = '#1c1c1c';

// Paleta de destaque de cada tema do centro (ver src/theme/temasCentro.js).
const PALETA_TEMA = Object.fromEntries(
    TEMAS_CENTRO.map((tema) => [tema.id, colors[tema.paleta]])
);

// Paletas com variáveis. "accent" é a cor do tema do centro (no código aparece
// como emerald, cyan, spindle e cruise); por omissão é o ciano da marca.
const PALETAS = {
    slate: colors.slate,
    gray: colors.slate,
    accent: PALETA_TEMA[TEMA_CENTRO_POR_OMISSAO],
    red: colors.red,
    rose: colors.rose,
    orange: colors.orange,
    amber: colors.amber,
    yellow: colors.yellow,
    lime: colors.lime,
    green: colors.green,
    sky: colors.sky,
    indigo: colors.indigo,
    violet: colors.violet,
    purple: colors.purple,
};

// Neutros do modo escuro: cinzentos sem tom azulado, escuros mas não pretos.
const SLATE_ESCURO_SUPERFICIE = {
    white: CARTAO_ESCURO,
    50: '#141414',
    100: '#252525',
    200: '#2e2e2e',
    300: '#3a3a3a',
    400: '#4f4f4f',
    500: '#5c5c5c',
    600: '#525252',
    // 700–900 são sobretudo botões escuros com texto branco: ficam um pouco
    // mais claros do que o cartão para se distinguirem.
    700: '#484848',
    800: '#3d3d3d',
    900: '#333333',
    950: '#0a0a0a',
};

const SLATE_ESCURO_CONTEUDO = {
    50: '#2e2e2e',
    100: '#3a3a3a',
    200: '#4f4f4f',
    300: '#6b6b6b',
    400: '#8a8a8a',
    500: '#a3a3a3',
    600: '#bdbdbd',
    700: '#d4d4d4',
    800: '#e5e5e5',
    900: '#f0f0f0',
    950: '#f7f7f7',
};

// Zonas escuras (ex.: barra lateral) no modo escuro: mantêm o desenho do modo
// claro, mas com cinzentos neutros em vez do azul-marinho.
const NEUTRO_ZONA_ESCURA = { ...colors.neutral, 900: '#101010' };

function hexParaRgb(hex) {
    const valor = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(valor.slice(i, i + 2), 16));
}

function canais(hex) {
    return hexParaRgb(hex).join(' ');
}

// Mistura "cor" com "base" na proporção indicada (0 = só base, 1 = só cor).
function misturar(cor, base, proporcao) {
    const a = hexParaRgb(cor);
    const b = hexParaRgb(base);
    const r = a.map((v, i) => Math.round(v * proporcao + b[i] * (1 - proporcao)));
    return `#${r.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function superficieEscura(paleta) {
    return {
        ...paleta,
        50: misturar(paleta[500], CARTAO_ESCURO, 0.14),
        100: misturar(paleta[500], CARTAO_ESCURO, 0.22),
        200: misturar(paleta[500], CARTAO_ESCURO, 0.35),
        300: misturar(paleta[400], CARTAO_ESCURO, 0.5),
    };
}

function conteudoEscuro(paleta) {
    return {
        ...paleta,
        500: paleta[400],
        600: paleta[300],
        700: paleta[300],
        800: paleta[200],
        900: paleta[100],
        950: paleta[50],
    };
}

function variaveis(prefixo, nome, escala) {
    return Object.fromEntries(
        TONS.map((tom) => [`--${prefixo}-${nome}-${tom}`, canais(escala[tom])])
    );
}

function variaveisClaras() {
    const resultado = { '--s-white': canais('#ffffff') };
    for (const [nome, paleta] of Object.entries(PALETAS)) {
        Object.assign(
            resultado,
            variaveis('s', nome, paleta),
            variaveis('t', nome, paleta)
        );
    }
    return resultado;
}

function variaveisEscuras() {
    const resultado = { '--s-white': canais(SLATE_ESCURO_SUPERFICIE.white) };
    for (const [nome, paleta] of Object.entries(PALETAS)) {
        const neutra = nome === 'slate' || nome === 'gray';
        Object.assign(
            resultado,
            variaveis(
                's',
                nome,
                neutra ? SLATE_ESCURO_SUPERFICIE : superficieEscura(paleta)
            ),
            variaveis(
                't',
                nome,
                neutra ? SLATE_ESCURO_CONTEUDO : conteudoEscuro(paleta)
            )
        );
    }
    return resultado;
}

// Cada tema só troca as variáveis "accent". Funciona no <html> (a app toda) e
// em qualquer elemento (pré-visualização nas Configurações). Vem depois de
// :root, e a versão escura (.dark[data-tema]) tem mais especificidade do que
// html.dark, por isso ganha nos dois modos.
function variaveisTemas() {
    const resultado = {};
    for (const [id, paleta] of Object.entries(PALETA_TEMA)) {
        resultado[`[data-tema='${id}']`] = {
            ...variaveis('s', 'accent', paleta),
            ...variaveis('t', 'accent', paleta),
        };
        resultado[`.dark[data-tema='${id}'], .dark [data-tema='${id}']`] = {
            ...variaveis('s', 'accent', superficieEscura(paleta)),
            ...variaveis('t', 'accent', conteudoEscuro(paleta)),
        };
        // Fundo da barra lateral (bg-slate-900 dentro de .zona-escura) num tom
        // escuro da cor do centro. O ciano mantém o azul-marinho da marca.
        if (id === TEMA_CENTRO_POR_OMISSAO) continue;
        resultado[`[data-tema='${id}'] .zona-escura`] = {
            '--s-slate-900': canais(misturar(paleta[900], '#0a0a0a', 0.5)),
        };
        resultado[
            `.dark[data-tema='${id}'] .zona-escura, .dark [data-tema='${id}'] .zona-escura`
        ] = {
            '--s-slate-900': canais(misturar(paleta[900], '#0a0a0a', 0.25)),
        };
    }
    return resultado;
}

/** CSS base com as variáveis dos dois modos (para addBase de um plugin). */
export function cssVariaveisTema() {
    return {
        ':root': variaveisClaras(),
        'html.dark': variaveisEscuras(),
        ...variaveisTemas(),
        // Só os neutros: as cores de destaque seguem o tema do centro.
        'html.dark .zona-escura': {
            '--s-white': canais('#ffffff'),
            ...variaveis('s', 'slate', NEUTRO_ZONA_ESCURA),
            ...variaveis('t', 'slate', NEUTRO_ZONA_ESCURA),
            ...variaveis('s', 'gray', NEUTRO_ZONA_ESCURA),
            ...variaveis('t', 'gray', NEUTRO_ZONA_ESCURA),
        },
    };
}

function escala(prefixo, nome) {
    return Object.fromEntries(
        TONS.map((tom) => [
            tom,
            `rgb(var(--${prefixo}-${nome}-${tom}) / <alpha-value>)`,
        ])
    );
}

function cor(prefixo, nome, tom) {
    return `rgb(var(--${prefixo}-${nome}-${tom}) / <alpha-value>)`;
}

/**
 * Cores para o tailwind.config. prefixo "s" para superfícies, "t" para texto.
 * Inclui os aliases históricos do projeto (blue/lavender = slate,
 * emerald = ciano, york = amber, malibu = sky).
 */
export function coresTema(prefixo) {
    const s = (nome) => escala(prefixo, nome);
    return {
        white: prefixo === 't' ? '#ffffff' : 'rgb(var(--s-white) / <alpha-value>)',
        brand: {
            primary: cor(prefixo, 'slate', 800),
            accent: cor(prefixo, 'accent', 500),
            warning: cor(prefixo, 'amber', 500),
            bg: cor(prefixo, 'slate', 50),
            text: cor(prefixo, 'slate', 700),
            white: prefixo === 't' ? '#ffffff' : 'rgb(var(--s-white) / <alpha-value>)',
            'blue-dark': cor(prefixo, 'slate', 900),
            navy: cor(prefixo, 'slate', 800),
            emerald: cor(prefixo, 'accent', 500),
            grey: cor(prefixo, 'slate', 500),
            cream: cor(prefixo, 'slate', 50),
        },
        spindle: cor(prefixo, 'accent', 200),
        cruise: cor(prefixo, 'accent', 100),
        pink: cor(prefixo, 'amber', 100),
        slate: s('slate'),
        gray: s('gray'),
        blue: s('slate'),
        lavender: s('slate'),
        emerald: s('accent'),
        cyan: s('accent'),
        red: s('red'),
        rose: s('rose'),
        orange: s('orange'),
        amber: s('amber'),
        york: s('amber'),
        yellow: s('yellow'),
        lime: s('lime'),
        green: s('green'),
        sky: s('sky'),
        malibu: s('sky'),
        indigo: s('indigo'),
        violet: s('violet'),
        purple: s('purple'),
    };
}
