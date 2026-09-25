import { NavLink } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';

const tabs = [
    { label: 'Disciplinas', path: '/gestor/disciplinas' },
    { label: 'Modalidades', path: '/gestor/modalidade' },
    { label: 'Tipos de serviço', path: '/gestor/tipos-servico' },
    { label: 'Pacotes', path: '/gestor/pacotes' },
    { label: 'Salas', path: '/gestor/salas' },
];

export default function GestaoInternaTabs() {
    return (
        <div className="space-y-5">
            <AdminPageHeader
                title="Catálogo"
                subtitle="Disciplinas, modalidades, tipos de serviço, pacotes e salas usados nos serviços e nas inscrições."
                actions={
                    <a
                        href="/inscricao"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        Ver formulário público
                        <ExternalLink size={14} aria-hidden="true" />
                    </a>
                }
            />

            <nav
                aria-label="Secções do catálogo"
                className="flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]"
            >
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={tab.path}
                        className={({ isActive }) =>
                            `-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                                isActive
                                    ? 'border-cyan-600 text-slate-900'
                                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                            }`
                        }
                    >
                        {tab.label}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
