import PropTypes from 'prop-types';

export default function KpiCard({ label, value, hint, icon: Icon, onClick, loading }) {
    const Tag = onClick ? 'button' : 'article';

    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`group flex w-full flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-900/[0.03] transition ${
                onClick
                    ? 'hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40'
                    : ''
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                {Icon ? (
                    <Icon
                        size={18}
                        className="shrink-0 text-slate-400 transition group-hover:text-slate-600"
                        aria-hidden="true"
                    />
                ) : null}
            </div>

            {loading ? (
                <span className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : (
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {value}
                </p>
            )}

            {hint ? (
                <p className="mt-1 text-xs text-slate-500">{hint}</p>
            ) : null}
        </Tag>
    );
}

KpiCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hint: PropTypes.string,
    icon: PropTypes.elementType,
    onClick: PropTypes.func,
    loading: PropTypes.bool,
};
