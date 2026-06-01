import { NavLink } from 'react-router-dom';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { Settings } from 'lucide-react';

const tabs = [
    { label: 'Modalidades', path: '/gestor/modalidade' },
    { label: 'Salas', path: '/gestor/salas' },
    { label: 'Disciplinas', path: '/gestor/disciplinas' },
    { label: 'Pacotes', path: '/gestor/pacotes' },
];

export default function GestaoInternaTabs() {
    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Administração"
                title="Gestão Interna"
                subtitle="Gerir modalidades, salas e disciplinas"
                icon={Settings}
            />

            <nav className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-4">
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={tab.path}
                        className={({ isActive }) =>
                            `rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
                                isActive
                                    ? 'bg-york-200 text-slate-800 shadow-sm'
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
