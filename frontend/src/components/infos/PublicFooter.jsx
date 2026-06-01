import { Link } from 'react-router-dom';
import { SERVICES } from '../../pages/Infos/servicesData';

export default function PublicFooter() {
    return (
        <footer className="mt-16 border-t border-slate-200 bg-white">
            <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:grid-cols-3 sm:px-6">
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                        Serviços
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {SERVICES.map((item) => (
                            <li key={item.slug}>
                                <Link
                                    to={`/servicos/${item.slug}`}
                                    className="hover:text-slate-800 hover:underline"
                                >
                                    {item.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                        Informação
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        <li>Política de Privacidade</li>
                        <li>Política de Cookies</li>
                        <li>Livro de Reclamações Online</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                        Contactos
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        <li>
                            Rua Moinho de Vento, Lote 4, Loja B, 3510-085 Viseu
                        </li>
                        <li>232 185 212</li>
                        <li>geral@blocodenotas.pt</li>
                        <li>
                            <Link
                                to="/contactos"
                                className="font-semibold text-slate-700 hover:underline"
                            >
                                Ver contactos completos
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} Bloco de Notas · Desenvolvido por
                MEDIACENTER
            </div>
        </footer>
    );
}
