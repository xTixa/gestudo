import { Link, useParams } from 'react-router-dom';
import PublicNavbar from '../../components/infos/PublicNavbar';
import PublicFooter from '../../components/infos/PublicFooter';
import { SERVICE_BY_SLUG } from './servicesData';

export default function InfosServicoDetalhePage() {
    const { slug } = useParams();
    const service = SERVICE_BY_SLUG[slug || ''];

    if (!service) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800">
                <PublicNavbar />
                <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
                    <h1 className="text-3xl font-bold text-slate-800">
                        Serviço não encontrado
                    </h1>
                    <p className="mt-3 text-sm text-slate-600">
                        O serviço que procuras não existe ou foi removido.
                    </p>
                    <Link
                        to="/servicos"
                        className="mt-6 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Voltar a Serviços
                    </Link>
                </main>
                <PublicFooter />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <PublicNavbar />

            <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Serviços
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-800">
                    {service.title}
                </h1>

                {service.image ? (
                    <img
                        src={service.image}
                        alt={service.title}
                        className="mt-6 aspect-video w-full rounded-2xl border border-slate-200 object-cover"
                    />
                ) : null}

                <p className="mt-4 text-base leading-7 text-slate-600">
                    {service.description}
                </p>

                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="text-lg font-semibold text-slate-800">
                        Destaques
                    </h2>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {service.highlights.map((item) => (
                            <li key={item}>• {item}</li>
                        ))}
                    </ul>
                </section>

                <Link
                    to="/servicos"
                    className="mt-8 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    Ver todos os serviços
                </Link>
            </main>

            <PublicFooter />
        </div>
    );
}
