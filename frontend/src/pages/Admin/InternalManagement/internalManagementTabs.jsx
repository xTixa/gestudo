import { NavLink } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { Settings } from 'lucide-react';

const tabs = [
    { label: 'Modalidades', path: '/gestor/modalidade' },
    { label: 'Salas', path: '/gestor/salas' },
    { label: 'Disciplinas', path: '/gestor/disciplinas' },
    { label: 'Pacotes', path: '/gestor/pacotes' },
    { label: 'Tipos de Serviço', path: '/gestor/tipos-servico' },
];

export default function GestaoInternaTabs() {
    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Administração"
                title="Gestão Interna"
                subtitle="Gerir modalidades, salas e disciplinas"
                icon={Settings}
                actions={
                    <a
                        href="/inscricao"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                    >
                        Ver formulário público
                    </a>
                }
            />

            <nav className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-5">
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={tab.path}
                        className={({ isActive }) =>
                            `rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
                                isActive
                                    ? 'bg-[#14ad81] text-[#1c293d] shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
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
