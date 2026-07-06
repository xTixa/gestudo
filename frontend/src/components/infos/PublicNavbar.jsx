import { Link } from 'react-router-dom';
import logo from '../../assets/img/Asset-31.svg';

export default function PublicNavbar() {
    return (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
                <Link to="/" className="flex items-center gap-3">
                    <img
                        src={logo}
                        alt="Bloco de Notas"
                        className="h-10 w-auto object-contain"
                    />
                </Link>

                <div className="flex items-center gap-2">
                    <Link
                        to="/login"
                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 sm:px-4"
                    >
                        Login
                    </Link>
                </div>
            </div>
        </header>
    );
}
