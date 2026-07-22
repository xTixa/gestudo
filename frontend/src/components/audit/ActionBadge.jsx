export default function ActionBadge({ action }) {
    const labels = {
        CREATE: 'CREATE',
        INSERT: 'INSERT',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        LOGIN: 'LOGIN',
        READ: 'READ',
    };

    const styles = {
        CREATE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        INSERT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        UPDATE: 'border-blue-200 bg-blue-50 text-blue-700',
        DELETE: 'border-red-200 bg-red-50 text-red-700',
        LOGIN: 'border-slate-200 bg-slate-50 text-slate-700',
        READ: 'border-slate-200 bg-slate-50 text-slate-700',
    };

    return (
        <span
            className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${styles[action] || 'border-slate-200 bg-slate-50 text-slate-700'}`}
        >
            {labels[action] || action}
        </span>
    );
}
