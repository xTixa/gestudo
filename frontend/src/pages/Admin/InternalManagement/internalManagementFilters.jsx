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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label>
                    <span className="mb-2 block text-sm font-medium text-slate-600">
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
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-spindle"
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

                <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
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
