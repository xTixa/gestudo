import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

/**
 * Cabeçalho de tabela com colunas ordenáveis e a coluna "Ações" no fim.
 * colunas: [{ label, field }]; field null = coluna sem ordenação.
 * sort: { field, dir: 'asc' | 'desc' }.
 */
export default function SortableTableHead({ colunas, sort, onSort }) {
    return (
        <thead className="text-gray-500 border-b">
            <tr>
                {colunas.map(({ label, field }) =>
                    field ? (
                        <th
                            key={label}
                            className="py-3 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                            onClick={() => onSort(field)}
                        >
                            <span className="flex items-center gap-1">
                                {label}
                                {sort.field === field ? (
                                    sort.dir === 'asc' ? (
                                        <ChevronUp
                                            size={13}
                                            className="text-indigo-500 shrink-0"
                                        />
                                    ) : (
                                        <ChevronDown
                                            size={13}
                                            className="text-indigo-500 shrink-0"
                                        />
                                    )
                                ) : (
                                    <ChevronsUpDown
                                        size={13}
                                        className="opacity-30 shrink-0"
                                    />
                                )}
                            </span>
                        </th>
                    ) : (
                        <th key={label} className="py-3">
                            {label}
                        </th>
                    )
                )}
                <th className="text-center py-3">Ações</th>
            </tr>
        </thead>
    );
}
