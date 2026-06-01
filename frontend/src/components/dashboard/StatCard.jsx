import React from 'react';

export default function StatCard({ title, value, icon: Icon, bgColor }) {
    return (
        <article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
