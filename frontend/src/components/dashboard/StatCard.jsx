import PropTypes from 'prop-types';

export default function StatCard({ title, value, icon: Icon, bgColor, onClick }) {
    return (
        <article
            className={`flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm${onClick ? ' cursor-pointer transition hover:border-slate-300 hover:shadow-md' : ''}`}
            onClick={onClick}
        >
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="mt-2 text-4xl font-semibold text-slate-700">
                    {value}
                </p>
            </div>

            {Icon && (
                <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${bgColor}`}
                >
                    <Icon className="h-6 w-6 text-white" />
                </div>
            )}
        </article>
    );
}

StatCard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    icon: PropTypes.elementType,
    bgColor: PropTypes.string,
    onClick: PropTypes.func,
};
