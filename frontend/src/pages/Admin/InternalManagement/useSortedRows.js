import { useMemo, useState } from 'react';

export function useSortedRows(
    rows,
    initialColumn = null,
    initialDirection = 'asc',
    comparators = {}
) {
    const [sortColumn, setSortColumn] = useState(initialColumn);
    const [sortDirection, setSortDirection] = useState(initialDirection);

    function toggleSort(column) {
        if (sortColumn !== column) {
            setSortColumn(column);
            setSortDirection('asc');
            return;
        }

        if (sortDirection === 'asc') {
            setSortDirection('desc');
            return;
        }

        setSortColumn(null);
        setSortDirection('asc');
    }

    const sortedRows = useMemo(() => {
        if (!sortColumn) {
            return rows;
        }

        const withIndex = rows.map((row, index) => ({ row, index }));

        const customComparator = comparators[sortColumn];

        withIndex.sort((a, b) => {
            const rawA = a.row?.[sortColumn];
            const rawB = b.row?.[sortColumn];

            let comparison;
            if (customComparator) {
                comparison = customComparator(rawA, rawB);
            } else {
                const numA = Number(rawA);
                const numB = Number(rawB);
                const bothNumeric =
                    rawA !== '' &&
                    rawA != null &&
                    rawB !== '' &&
                    rawB != null &&
                    !Number.isNaN(numA) &&
                    !Number.isNaN(numB);

                if (bothNumeric) {
                    comparison = numA - numB;
                } else {
                    comparison = String(rawA ?? '').localeCompare(
                        String(rawB ?? ''),
                        'pt-PT',
                        { sensitivity: 'base' }
                    );
                }
            }

            if (comparison !== 0) {
                return sortDirection === 'asc' ? comparison : -comparison;
            }

            return a.index - b.index;
        });

        return withIndex.map(({ row }) => row);
    }, [rows, sortColumn, sortDirection, comparators]);

    return { sortedRows, sortColumn, sortDirection, toggleSort };
}
