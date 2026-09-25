// Classes partilhadas pelos ecrãs do módulo financeiro (mesmo estilo da
// estrutura do painel: botões h-9, inputs com anel de foco ciano).

export const btnPrimary =
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondary =
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export const btnDanger =
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800';

export const inputClass =
    'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50 disabled:text-slate-500';

export const labelClass = 'mb-1.5 block text-xs font-medium text-slate-600';

export const cardClass =
    'rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]';
