/**
 * Cabeçalho padrão das páginas do painel: título, descrição e ações.
 *
 * `eyebrow` e `icon` continuam a ser aceites por compatibilidade, mas não são
 * mostrados — a secção atual já aparece no breadcrumb da navbar.
 */
export default function AdminPageHeader({
    title,
    subtitle,
    actions,
    className = '',
}) {
    return (
        <header
            className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className}`.trim()}
        >
            <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="mt-1 max-w-3xl text-sm text-slate-500">
                        {subtitle}
                    </p>
                ) : null}
            </div>

            {actions ? (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}
