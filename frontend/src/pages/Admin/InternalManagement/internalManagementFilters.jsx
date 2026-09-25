import { Search, X } from 'lucide-react';

export default function GestaoInternaFilters({
    searchTerm,
    onSearchChange,
    totalCount,
    filteredCount,
    placeholder,
    children,
}) {
    const hasFilter = searchTerm.trim().length > 0;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label>
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">
                        Filtrar
                    </span>
                    <div className="relative">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) =>
                                onSearchChange(event.target.value)
                            }
                            placeholder={placeholder}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                        />
                        {hasFilter ? (
                            <button
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                aria-label="Limpar filtro"
                            >
                                <X size={14} />
                            </button>
                        ) : null}
                    </div>
                </label>

                <div className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg bg-slate-50 px-3 text-sm text-slate-500">
                    A mostrar{' '}
                    <span className="font-semibold text-slate-800">
                        {filteredCount}
                    </span>{' '}
                    de{' '}
                    <span className="font-semibold text-slate-800">
                        {totalCount}
                    </span>
                </div>
            </div>

            {children ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
