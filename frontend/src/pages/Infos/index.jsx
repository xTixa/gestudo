import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/infos/PublicNavbar';
import PublicFooter from '../../components/infos/PublicFooter';
import { SERVICES } from './servicesData';

export default function InfosHomePage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <PublicNavbar />

            <main>
                <section className="bg-gradient-to-br from-slate-900 to-slate-700 text-white">
                    <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
                        <p className="text-sm uppercase tracking-[0.2em] text-lime-300">
                            Bloco de Notas
                        </p>
                        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
                            Competência, Dedicação, Rigor
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm text-slate-200 sm:text-base">
                            O nosso objetivo é o vosso sucesso. Centro de
                            estudos e explicações com soluções para alunos de
                            diferentes níveis.
                        </p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                        Os Nossos Serviços
                    </h2>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {SERVICES.map((service) => (
                            <article
                                key={service.slug}
                                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg"
                            >
                                {service.image ? (
                                    <img
                                        src={service.image}
                                        alt={service.title}
                                        className="mb-4 aspect-video w-full rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="mb-4 flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-xs font-medium uppercase tracking-wider text-slate-500">
                                        Imagem do serviço
                                    </div>
                                )}
                                <h3 className="text-lg font-semibold text-slate-800">
                                    {service.title}
                                </h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    {service.shortDescription}
                                </p>
                                <Link
                                    to={`/servicos/${service.slug}`}
                                    className="mt-4 inline-block text-sm font-semibold text-slate-700 underline-offset-4 transition group-hover:text-slate-900 hover:underline"
                                >
                                    Ver detalhe
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    );
}
