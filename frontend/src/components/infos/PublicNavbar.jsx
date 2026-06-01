import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import logo from '../../assets/img/logo.png';

const navItems = [
    { to: '/', label: 'Home' },
    { to: '/sobre', label: 'Sobre Nós' },
    { to: '/servicos', label: 'Serviços' },
    { to: '/inscricao', label: 'Inscrição' },
    { to: '/contactos', label: 'Contactos' },
];

export default function PublicNavbar() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
                <Link
                    to="/"
                    className="flex items-center gap-3"
                    onClick={() => setMobileOpen(false)}
                >
                    <img
                        src={logo}
                        alt="Bloco de Notas"
                        className="h-10 w-auto object-contain"
                    />
                    <div className="hidden sm:block"></div>
                </Link>

                <nav className="hidden items-center gap-5 md:flex">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `text-sm font-medium transition ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <Link
                        to="/login"
                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 sm:px-4"
                        onClick={() => setMobileOpen(false)}
                    >
                        Login
                    </Link>

                    <button
                        type="button"
                        className="inline-flex rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"
                        aria-label="Abrir menu"
                        onClick={() => setMobileOpen((prev) => !prev)}
                    >
                        {mobileOpen ? '✕' : '☰'}
                    </button>
                </div>
            </div>

            {mobileOpen ? (
                <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
                    <div className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) =>
                                    `rounded-md px-2 py-2 text-sm font-medium transition ${
                                        isActive
                                            ? 'bg-slate-100 text-slate-900'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
                </nav>
            ) : null}
        </header>
    );
}
