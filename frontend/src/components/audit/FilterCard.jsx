import { Search, X } from 'lucide-react';

const PERIOD_OPTIONS = [
    { key: 'all', label: 'Todos' },
    { key: 'today', label: 'Hoje' },
    { key: 'yesterday', label: 'Ontem' },
    { key: 'last7', label: '7 dias' },
    { key: 'last30', label: '30 dias' },
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
        users: 'Utilizadores',
        alunos: 'Alunos',
        professores: 'Professores',
        inscricoes_publicas: 'Inscricoes publicas',
        inscricao_publica: 'Inscricoes publicas',
        inscricoes: 'Inscricoes',
        notificacao_broadcast: 'Notificacao',
        servicos_curriculares: 'Servicos curriculares',
        servico_curricular: 'Servicos curriculares',
        servicos_extracurriculares: 'Servicos extra-curriculares',
        servico_extra_curricular: 'Servicos extra-curriculares',
        sistema: 'Sistema',
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
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_160px_190px_220px_auto] lg:items-end">
                <label>
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Pesquisa
                    </span>
                    <div className="relative">
                        <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(event) =>
                                onChange('search', event.target.value)
                            }
                            placeholder="Detalhes, utilizador ou evento"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#06b6d4] focus:bg-white focus:ring-2 focus:ring-emerald-100"
                        />
                    </div>
                </label>

                <label>
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Acao
                    </span>
                    <select
                        value={filters.action}
                        onChange={(event) =>
                            onChange('action', event.target.value)
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-[#06b6d4] focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    >
                        <option value="">Todas</option>
                        {actions.map((action) => (
                            <option key={action} value={action}>
                                {getActionLabel(action)}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Entidade
                    </span>
                    <select
                        value={filters.entity}
                        onChange={(event) =>
                            onChange('entity', event.target.value)
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-[#06b6d4] focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    >
                        <option value="">Todas</option>
                        {entities.map((entity) => (
                            <option key={entity} value={entity}>
                                {getEntityLabel(entity)}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Utilizador
                    </span>
                    <select
                        value={filters.user}
                        onChange={(event) =>
                            onChange('user', event.target.value)
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-[#06b6d4] focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    >
                        <option value="">Todos</option>
                        {users.map((user) => (
                            <option key={user} value={user}>
                                {user}
                            </option>
                        ))}
                    </select>
                </label>

                {hasActiveFilters ? (
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                        <X size={14} />
                        Limpar
                    </button>
                ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                {PERIOD_OPTIONS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => onChange('period', item.key)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                            filters.period === item.key
                                ? 'bg-[#1e293b] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
