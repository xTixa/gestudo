import { ChevronRight } from 'lucide-react';
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

export default function EnrollmentTable({
    items,
    loading,
    selectedId,
    onRowClick,
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            {[
                                'Data',
                                'Aluno',
                                'Contacto',
                                'Plano',
                                'Encarregado',
                                'Estado',
                                '',
                            ].map((header) => (
                                <th
                                    key={header}
                                    className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center"
                                >
                                    <div className="inline-flex gap-1">
                                        {[0, 1, 2].map((i) => (
                                            <div
                                                key={i}
                                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300"
                                                style={{
                                                    animationDelay: `${i * 200}ms`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!loading && items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-12 text-center text-sm text-slate-500"
                                >
                                    Sem inscrições para o filtro selecionado.
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            items.map((item) => {
                                const isSelected =
                                    selectedId === item.id_inscricao_publica;
                                return (
                                    <tr
                                        key={item.id_inscricao_publica}
                                        onClick={() =>
                                            onRowClick(
                                                item.id_inscricao_publica
                                            )
                                        }
                                        className={`cursor-pointer border-t border-slate-100 transition-colors ${
                                            isSelected
                                                ? 'bg-blue-50'
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                            {formatDateTime(item.created_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">
                                                {item.nome_completo || '-'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {item.escola || '-'}
                                                {' · '}
                                                {item.turma || '-'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-700">
                                                {item.email || '-'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {item.telemovel || '-'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-700">
                                                {item.disciplina || '-'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {item.modalidade || '-'}
                                                {item.pacote
                                                    ? ` · ${item.pacote}`
                                                    : ''}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {item.ee_nome || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <EnrollmentStatusBadge
                                                status={item.estado}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-slate-400">
                                            <ChevronRight size={16} />
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
