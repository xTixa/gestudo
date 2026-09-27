import { Fragment, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Minus } from 'lucide-react';
import {
    ANNUAL_MONTHS_CHARGED,
    FEATURE_GROUPS,
    PLANS,
    planIncludes,
} from '../../pages/Infos/pricingPlans';

const priceFormatter = new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 0,
});

function monthlyPrice(plan, annual) {
    return annual
        ? Math.round((plan.price * ANNUAL_MONTHS_CHARGED) / 12)
        : plan.price;
}

function planMailto(contactEmail, plan, annual) {
    const subject = `Adesão ao pacote ${plan.name} (${annual ? 'anual' : 'mensal'})`;
    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
}

function CellValue({ value }) {
    if (value === true) {
        return (
            <Check size={18} className="mx-auto text-emerald-600" aria-label="Incluído" />
        );
    }
    if (value === false) {
        return (
            <Minus size={18} className="mx-auto text-slate-300" aria-label="Não incluído" />
        );
    }
    return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

function PlanCard({ plan, annual, contactEmail }) {
    const price = monthlyPrice(plan, annual);

    return (
        <article
            className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
                plan.featured
                    ? 'border-slate-800 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-800 xl:-my-3 xl:py-9'
                    : 'border-slate-200'
            }`}
        >
            {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-900">
                    Mais escolhido
                </span>
            )}

            <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-1 min-h-[2.5rem] text-sm leading-snug text-slate-500">
                {plan.tagline}
            </p>

            <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">
                    {priceFormatter.format(price)}€
                </span>
                <span className="text-sm text-slate-500">/mês</span>
            </div>
            <p className="mt-1 h-5 text-xs text-slate-500">
                {annual
                    ? `${priceFormatter.format(price * 12)}€ faturados por ano`
                    : 'Sem fidelização'}
            </p>

            <a
                href={planMailto(contactEmail, plan, annual)}
                className={`mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    plan.featured
                        ? 'bg-slate-800 text-white hover:bg-slate-700'
                        : 'border border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
            >
                Escolher {plan.name}
                <ArrowRight size={16} />
            </a>

            <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {plan.includesFrom
                        ? `Tudo do ${plan.includesFrom}, mais:`
                        : 'Inclui:'}
                </p>
                <ul className="mt-3 space-y-2.5">
                    {plan.highlights.map((item) => (
                        <li
                            key={item}
                            className="flex items-start gap-2.5 text-sm text-slate-700"
                        >
                            <Check
                                size={17}
                                className="mt-0.5 shrink-0 text-emerald-600"
                            />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
        </article>
    );
}

function ComparisonTable() {
    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="sticky left-0 bg-white px-5 py-4 text-sm font-semibold text-slate-500">
                            Funcionalidade
                        </th>
                        {PLANS.map((plan) => (
                            <th
                                key={plan.key}
                                className={`px-3 py-4 text-center text-sm font-semibold ${
                                    plan.featured
                                        ? 'text-emerald-700'
                                        : 'text-slate-900'
                                }`}
                            >
                                {plan.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {FEATURE_GROUPS.map((group) => (
                        <Fragment key={group.title}>
                            <tr>
                                <th
                                    colSpan={PLANS.length + 1}
                                    className="bg-slate-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                                >
                                    {group.title}
                                </th>
                            </tr>
                            {group.rows.map((row) => (
                                <tr
                                    key={row.label}
                                    className="border-t border-slate-100"
                                >
                                    <td className="sticky left-0 bg-white px-5 py-3 text-sm text-slate-700">
                                        {row.label}
                                    </td>
                                    {PLANS.map((plan, i) => (
                                        <td
                                            key={plan.key}
                                            className={`px-3 py-3 text-center ${
                                                plan.featured
                                                    ? 'bg-emerald-50/40'
                                                    : ''
                                            }`}
                                        >
                                            <CellValue
                                                value={planIncludes(row, i)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function PricingSection({ contactEmail }) {
    const [annual, setAnnual] = useState(true);
    const [showComparison, setShowComparison] = useState(false);
    const freeMonths = 12 - ANNUAL_MONTHS_CHARGED;

    return (
        <section id="precos" className="scroll-mt-20 bg-slate-50 py-20 lg:py-28">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
                        Pacotes e preços
                    </p>
                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        Um pacote para cada fase do seu centro
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-600">
                        Comece pelo essencial e acrescente módulos à medida que
                        cresce. Todos os pacotes incluem as áreas do gestor, do
                        professor e do aluno.
                    </p>
                </div>

                <div className="mt-10 flex justify-center">
                    <div
                        role="radiogroup"
                        aria-label="Periodicidade de faturação"
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1"
                    >
                        {[
                            { value: false, label: 'Mensal' },
                            { value: true, label: 'Anual' },
                        ].map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                role="radio"
                                aria-checked={annual === option.value}
                                onClick={() => setAnnual(option.value)}
                                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                    annual === option.value
                                        ? 'bg-slate-800 text-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {option.label}
                                {option.value && (
                                    <span
                                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                                            annual
                                                ? 'bg-emerald-400 text-slate-900'
                                                : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                    >
                                        {freeMonths} meses grátis
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4 xl:items-center">
                    {PLANS.map((plan) => (
                        <PlanCard
                            key={plan.key}
                            plan={plan}
                            annual={annual}
                            contactEmail={contactEmail}
                        />
                    ))}
                </div>

                <p className="mt-8 text-center text-sm text-slate-500">
                    Preços sem IVA. Precisa de algo à medida?{' '}
                    <a
                        href={`mailto:${contactEmail}?subject=${encodeURIComponent('Pedido de proposta personalizada')}`}
                        className="font-semibold text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                    >
                        Fale connosco
                    </a>
                    .
                </p>

                <div className="mt-12 text-center">
                    <button
                        type="button"
                        onClick={() => setShowComparison((v) => !v)}
                        aria-expanded={showComparison}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        {showComparison
                            ? 'Esconder comparação'
                            : 'Comparar todas as funcionalidades'}
                        <ChevronDown
                            size={16}
                            className={`transition ${showComparison ? 'rotate-180' : ''}`}
                        />
                    </button>
                </div>

                {showComparison && (
                    <div className="mt-8">
                        <ComparisonTable />
                    </div>
                )}
            </div>
        </section>
    );
}
