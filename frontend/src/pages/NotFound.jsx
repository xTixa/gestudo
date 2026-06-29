import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
                <FileQuestion size={40} className="text-slate-400" />
            </div>
            <div>
                <p className="text-6xl font-bold text-slate-200">404</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-800">
                    Página não encontrada
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    O endereço que tentou aceder não existe ou foi removido.
                </p>
            </div>
            <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
                <ArrowLeft size={16} />
                Voltar ao início
            </Link>
        </div>
    );
}
