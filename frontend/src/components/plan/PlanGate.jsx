import { Lock, Mail } from 'lucide-react';
import { SALES_EMAIL, usePlan } from '../../utils/plan';

function ModuleUnavailable({ moduleKey, isManager }) {
    const { nome, moduleInfo } = usePlan();
    const info = moduleInfo(moduleKey);
    const moduleName = info?.nome || '';
    const subject = `Upgrade para o pacote ${info?.desdeNome || ''}`.trim();

    return (
        <section className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Lock size={26} />
            </span>
            <p className="mt-5 text-sm font-medium text-slate-500">{moduleName}</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
                Funcionalidade não incluída no seu pacote
            </h1>

            {isManager ? (
                <>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        O centro tem o pacote{' '}
                        <span className="font-semibold text-slate-700">{nome}</span>.
                        {info?.desdeNome && (
                            <>
                                {' '}Esta funcionalidade está disponível a partir do
                                pacote{' '}
                                <span className="font-semibold text-slate-700">
                                    {info.desdeNome}
                                </span>
                                .
                            </>
                        )}
                    </p>
                    <a
                        href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}`}
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                        <Mail size={16} />
                        Pedir mudança de pacote
                    </a>
                </>
            ) : (
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Esta funcionalidade não está disponível no seu centro. Se
                    precisar dela, fale com a direção do centro.
                </p>
            )}
        </section>
    );
}

/**
 * Mostra `children` só se o módulo estiver incluído no pacote contratado;
 * caso contrário mostra uma página a explicar como o obter.
 */
export default function PlanGate({ module, isManager = false, children }) {
    const { loading, hasModule } = usePlan();

    if (loading) return null;
    if (hasModule(module)) return children;
    return <ModuleUnavailable moduleKey={module} isManager={isManager} />;
}
