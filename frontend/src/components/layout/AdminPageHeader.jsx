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
            className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${className}`.trim()}
        >
            <div className="space-y-1">
                {eyebrow ? (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {eyebrow}
                    </p>
                ) : null}

                <div className="flex items-center gap-2.5">
                    {Icon ? (
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                            <Icon size={18} />
                        </div>
                    ) : null}

                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-[28px]">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="max-w-3xl text-sm text-slate-500">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {actions ? (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}
