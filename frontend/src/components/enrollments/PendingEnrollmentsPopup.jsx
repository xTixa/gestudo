import { ClipboardList, X } from 'lucide-react';

export default function PendingEnrollmentsPopup({ count, onClose, onNavigate }) {
    function handleViewClick() {
        onNavigate('/gestor/inscricoes-publicas');
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="bg-lime-500 px-6 py-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                        <ClipboardList size={20} className="text-white" />
                    </div>
                    <h2 className="text-base font-bold text-white">
                        Inscrições pendentes
                    </h2>
                    <button
                        onClick={onClose}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/20 transition"
                        aria-label="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5">
                    <p className="text-slate-700 text-sm leading-relaxed">
                        {count === 1
                            ? 'Tens 1 nova inscrição pública pendente de análise.'
                            : `Tens ${count} inscrições públicas pendentes de análise.`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Consulta e aprova ou rejeita as inscrições recebidas.
                    </p>
                </div>

                <div className="px-6 pb-5 flex gap-3">
                    <button
                        onClick={handleViewClick}
                        className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
                    >
                        Ver inscrições
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                        Mais tarde
                    </button>
                </div>
            </div>
        </div>
    );
}
