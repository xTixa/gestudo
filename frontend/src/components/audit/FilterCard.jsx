import { Search, X } from 'lucide-react';

const PERIOD_OPTIONS = [
    { key: 'all', label: 'Todos' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'last7', label: 'Últimos 7 dias' },
    { key: 'last30', label: 'Últimos 30 dias' },
];

function normalizeEntityKey(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');
}

function getActionLabel(value) {
    const action = String(value || '').toUpperCase();
    const map = {
        INSERT: 'INSERT',
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        LOGIN: 'LOGIN',
        READ: 'READ',
    };

    return map[action] || value;
}

function getEntityLabel(value) {
    const entity = normalizeEntityKey(value);
    const map = {
        users: 'Users',
        alunos: 'Students',
        professores: 'Teachers',
        inscricoes_publicas: 'Public Enrollments',
        inscricao_publica: 'Public Enrollments',
        inscricoes: 'Enrollments',
        notificacao_broadcast: 'Notification',
        servicos_curriculares: 'Curricular Services',
        servico_curricular: 'Curricular Services',
        servicos_extracurriculares: 'Extracurricular Services',
        servico_extra_curricular: 'Extracurricular Services',
        sistema: 'System',
    };

    return map[entity] || value;
}

export default function FilterCard({ filters, options, onChange }) {
    const actions = options?.actions ?? [];
    const entities = options?.entities ?? [];
    const users = options?.users ?? [];

    const hasActiveFilters =
        filters.search ||
        filters.action ||
        filters.entity ||
        filters.user ||
        (filters.period && filters.period !== 'all');

    function clearAllFilters() {
        onChange('search', '');
        onChange('action', '');
        onChange('entity', '');
        onChange('user', '');
        onChange('period', 'all');
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                        Filtros
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Pesquisa por ação, entidade, utilizador e período.
                    </p>
                </div>
                {hasActiveFilters ? (
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                        <X size={14} />
                        Limpar
                    </button>
                ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="lg:col-span-2">
                    <label className="text-xs text-slate-500">Pesquisar</label>
                    <div className="relative mt-1">
                        <Search
                            size={16}
                            className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(event) =>
                                onChange('search', event.target.value)
                            }
                            placeholder="Pesquisar em detalhes, utilizador ou evento"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-500">Ação</label>
                    <select
                        value={filters.action}
                        onChange={(event) =>
                            onChange('action', event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todas</option>
                        {actions.map((action) => (
                            <option key={action} value={action}>
                                {getActionLabel(action)}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-slate-500">Entidade</label>
                    <select
                        value={filters.entity}
                        onChange={(event) =>
                            onChange('entity', event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todas</option>
                        {entities.map((entity) => (
                            <option key={entity} value={entity}>
                                {getEntityLabel(entity)}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-slate-500">Utilizador</label>
                    <select
                        value={filters.user}
                        onChange={(event) =>
                            onChange('user', event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todos</option>
                        {users.map((user) => (
                            <option key={user} value={user}>
                                {user}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-4">
                <label className="text-xs text-slate-500">Período</label>
                <div className="mt-2 flex flex-wrap gap-2">
                    {PERIOD_OPTIONS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => onChange('period', item.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                filters.period === item.key
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
