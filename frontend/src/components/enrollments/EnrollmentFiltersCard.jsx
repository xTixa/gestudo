import { Funnel, Search, Trash2 } from 'lucide-react';

export default function EnrollmentFiltersCard({
    statusFilter,
    onStatusChange,
    retentionDays,
    onRetentionChange,
    onDeleteOldRequests,
    loading,
    cleaning,
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-slate-700">
                <Funnel size={15} className="text-slate-500" />
                <h2 className="text-sm font-medium">Filtros</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="md:col-span-2">
                    <span className="mb-1 block text-xs text-slate-500">
                        Pesquisar
                    </span>
                    <div className="relative">
                        <Search
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Pesquisar por nome, email, escola..."
                            className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                            disabled={loading || cleaning}
                        />
                    </div>
                </label>

                <div>
                    <span className="mb-1 block text-xs text-slate-500">
                        Estado
                    </span>
                    <select
                        value={statusFilter}
                        onChange={(e) => onStatusChange(e.target.value)}
                        disabled={loading || cleaning}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                        <option value="todos">Todos os estados</option>
                        <option value="pendente">Pendente</option>
                        <option value="aprovada">Aprovada</option>
                        <option value="rejeitada">Rejeitada</option>
                    </select>
                </div>

                <div>
                    <span className="mb-1 block text-xs text-slate-500">
                        Data
                    </span>
                    <select
                        value={retentionDays}
                        onChange={(e) => onRetentionChange(e.target.value)}
                        disabled={cleaning || loading}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                        <option value="30">Últimos 30 dias</option>
                        <option value="60">Últimos 60 dias</option>
                        <option value="90">Últimos 90 dias</option>
                        <option value="180">Últimos 180 dias</option>
                    </select>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    onClick={onDeleteOldRequests}
                    disabled={cleaning || loading}
                    className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Trash2 size={14} />
                    {cleaning ? 'A eliminar…' : 'Eliminar antigos'}
                </button>
            </div>
        </div>
    );
}
