export default function AdminPageHeader({
    eyebrow,
    title,
    subtitle,
    icon: Icon,
    actions,
    className = '',
}) {
    return (
        <header
            className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className}`.trim()}
        >
            <div className="space-y-2">
                {eyebrow ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                        {eyebrow}
                    </p>
                ) : null}

                <div className="flex items-start gap-3">
                    {Icon ? (
                        <div className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-200">
                            <Icon size={22} />
                        </div>
                    ) : null}

                    <div className="space-y-1">
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="max-w-3xl text-sm text-slate-500 sm:text-base">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {actions ? (
                <div className="flex flex-wrap gap-2">{actions}</div>
            ) : null}
        </header>
    );
}
