import { useState } from 'react';
import { Shield } from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import FilterCard from '../../components/audit/FilterCard';
import LogsTable from '../../components/audit/LogsTable';

export default function AuditLogs() {
    const [filters, setFilters] = useState({
        search: '',
        action: '',
        entity: '',
        user: '',
        period: 'all',
    });

    const [filterOptions, setFilterOptions] = useState({
        actions: [],
        entities: [],
        users: [],
    });

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Auditoria"
                title="Logs de atividade"
                subtitle="Histórico de ações no sistema com pesquisa por período, utilizador, entidade e tipo de evento."
                icon={Shield}
            />
            <div className="flex w-full max-w-none flex-col gap-6">
                <FilterCard
                    filters={filters}
                    options={filterOptions}
                    onChange={handleFilterChange}
                />

                <LogsTable
                    filters={filters}
                    onOptionsChange={setFilterOptions}
                />
            </div>
        </section>
    );
}
