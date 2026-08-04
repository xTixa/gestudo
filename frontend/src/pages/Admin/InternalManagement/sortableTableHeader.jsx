import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export function SortableTh({
    column,
    label,
    sortColumn,
    sortDirection,
    onSort,
    align = 'left',
}) {
    const isActive = sortColumn === column;
    const Icon = isActive
        ? sortDirection === 'asc'
            ? ArrowUp
            : ArrowDown
        : ArrowUpDown;

    return (
        <th
            className={`px-5 py-3.5 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`inline-flex items-center gap-1.5 transition hover:text-slate-900 ${
                    isActive ? 'text-slate-900' : 'text-slate-700'
                } ${align === 'right' ? 'flex-row-reverse' : ''}`}
            >
                {label}
                <Icon
                    size={13}
                    className={isActive ? 'text-slate-700' : 'text-slate-400'}
                />
            </button>
        </th>
    );
}
