import { useEffect, useState } from 'react';
import { Book, Info, School, User, Users, X } from 'lucide-react';
import EnrollmentStatusBadge from './EnrollmentStatusBadge';

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function DetailRow({ label, value }) {
    return (
        <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {label}
            </p>
            <p className="text-sm font-medium text-slate-900">{value || '-'}</p>
        </div>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={14} className="text-slate-600" />}
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {title}
                </p>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                {children}
            </div>
        </div>
    );
}

export default function EnrollmentDrawer({
    item,
    onClose,
    onStatusChange,
    saving,
}) {
    const [localStatus, setLocalStatus] = useState(item?.estado || 'pendente');

    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (!item) return null;

    async function handleApply() {
        await onStatusChange(item.id_inscricao_publica, localStatus);
    }

    return (
        <>
            <div
                onClick={onClose}
                className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm transition-opacity"
            />

            <aside className="fixed bottom-3 left-3 right-3 top-3 z-50 flex max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl bg-white shadow-2xl sm:left-auto sm:w-full sm:max-w-[460px]">
                <div className="flex min-h-0 w-full flex-col">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Inscrição #{item.id_inscricao_publica}
                        </p>
                        <h2 className="text-lg font-bold text-slate-900">
                            {item.nome_completo || '-'}
                        </h2>
                        <div className="mt-2">
                            <EnrollmentStatusBadge status={item.estado} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    <Section title="Dados pessoais" icon={User}>
                        <DetailRow
                            label="Nome completo"
                            value={item.nome_completo}
                        />
                        <DetailRow label="Email" value={item.email} />
                        <DetailRow label="Telemóvel" value={item.telemovel} />
                    </Section>

                    <Section title="Escola" icon={School}>
                        <DetailRow label="Escola" value={item.escola} />
                        <DetailRow label="Turma" value={item.turma} />
                    </Section>

                    <Section title="Plano de estudo" icon={Book}>
                        <DetailRow label="Disciplina" value={item.disciplina} />
                        <DetailRow label="Modalidade" value={item.modalidade} />
                        <DetailRow label="Pacote" value={item.pacote} />
                    </Section>

                    <Section title="Encarregado de educação" icon={Users}>
                        <DetailRow label="Nome" value={item.ee_nome} />
                    </Section>

                    <Section title="Informação" icon={Info}>
                        <DetailRow
                            label="Data de submissão"
                            value={formatDateTime(item.created_at)}
                        />
                    </Section>
                </div>

                <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <select
                        value={localStatus}
                        onChange={(e) => setLocalStatus(e.target.value)}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                        <option value="pendente">Pendente</option>
                        <option value="aprovada">Aprovada</option>
                        <option value="rejeitada">Rejeitada</option>
                    </select>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={saving || localStatus === item.estado}
                        className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    >
                        {saving ? 'A guardar...' : 'Aplicar'}
                    </button>
                </div>
                </div>
            </aside>
        </>
    );
}
