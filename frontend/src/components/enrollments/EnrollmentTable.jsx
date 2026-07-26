import PropTypes from 'prop-types';
import { ChevronRight, FileSearch } from 'lucide-react';
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

EnrollmentTable.propTypes = {
    items: PropTypes.array.isRequired,
    loading: PropTypes.bool,
    selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onRowClick: PropTypes.func.isRequired,
};

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
                                <td colSpan={7} className="px-4 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                                            <FileSearch size={22} className="text-slate-400" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-600">
                                            Nenhuma inscrição encontrada
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            Tente ajustar o filtro ou o período selecionado.
                                        </p>
                                    </div>
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
                                        onClick={() => onRowClick(item.id_inscricao_publica)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onRowClick(item.id_inscricao_publica);
                                            }
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-pressed={isSelected}
                                        aria-label={`Ver inscrição de ${item.nome_completo || 'aluno'}`}
                                        className={`cursor-pointer border-t border-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
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
                                                {Array.isArray(item.dados?.plano) &&
                                                item.dados.plano.length > 1
                                                    ? ` +${item.dados.plano.length - 1}`
                                                    : ''}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {item.modalidade || '-'}
                                                {item.pacote
                                                    ? ` · ${item.pacote}h`
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
