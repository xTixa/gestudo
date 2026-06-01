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
        CREATE: 'bg-green-100 text-green-700',
        INSERT: 'bg-green-100 text-green-700',
        UPDATE: 'bg-blue-100 text-blue-700',
        DELETE: 'bg-red-100 text-red-700',
        LOGIN: 'bg-yellow-100 text-yellow-700',
        READ: 'bg-purple-100 text-purple-700',
    };

    return (
        <span
            className={`px-2 py-1 text-xs rounded-full font-medium ${styles[action] || 'bg-slate-100 text-slate-700'}`}
        >
            {labels[action] || action}
        </span>
    );
}
