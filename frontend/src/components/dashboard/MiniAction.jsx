import React from 'react';

export default function MiniAction({
    title,
    subtitle,
    icon: Icon,
    bgColor,
    onClick,
}) {
    return (
        <article
            className={`flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            onKeyDown={(event) => {
                if (!onClick) {
                    return;
                }

                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            }}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {Icon && (
                <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${bgColor}`}
                >
                    <Icon className="h-5 w-5 text-white" />
                </div>
            )}

            <div>
                <p className="text-sm font-medium text-slate-700">{title}</p>
                <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
        </article>
    );
}
