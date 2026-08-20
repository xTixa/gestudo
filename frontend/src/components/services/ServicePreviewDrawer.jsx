import { createElement, useEffect } from 'react';
import {
    BookOpen,
    CalendarDays,
    GraduationCap,
    MapPin,
    Users,
    X,
} from 'lucide-react';

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pt-PT');
}

const weekDayLabels = {
    segunda: 'Segunda-feira',
    terca: 'Terca-feira',
    quarta: 'Quarta-feira',
    quinta: 'Quinta-feira',
    sexta: 'Sexta-feira',
    sabado: 'Sabado',
    domingo: 'Domingo',
};

function formatWeekDays(days) {
    if (!Array.isArray(days) || !days.length) return '-';
    return days.map((day) => weekDayLabels[day] || day).join(', ');
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

function Section({ title, icon, children }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                {createElement(icon, {
                    size: 14,
                    className: 'text-slate-600',
                })}
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

export default function ServicePreviewDrawer({ service, kind, onClose }) {
    useEffect(() => {
        function handleKey(event) {
            if (event.key === 'Escape') onClose();
        }

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (!service) return null;

    const periodicidadeClass =
        service.periodicidade === 'Periodico' ||
        service.periodicidade === 'Periódico'
            ? 'bg-green-100 text-green-700'
            : 'bg-violet-100 text-violet-700';

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
                                {kind === 'extra'
                                    ? 'Servico extra-curricular'
                                    : 'Servico curricular'}{' '}
                                #{service.id}
                            </p>
                            <h2 className="text-lg font-bold text-slate-900">
                                {service.tipoServico || '-'}
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${periodicidadeClass}`}
                                >
                                    {service.periodicidade || '-'}
                                </span>
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    {service.nAlunos || 0} alunos
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
                            aria-label="Fechar preview"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <Section title="Servico" icon={BookOpen}>
                            <DetailRow
                                label="Tipo de servico"
                                value={service.tipoServico}
                            />
                            <DetailRow
                                label="Modalidade"
                                value={service.modalidade}
                            />
                            <DetailRow label="Area" value={service.area} />
                        </Section>

                        <Section title="Ensino" icon={GraduationCap}>
                            <DetailRow
                                label={
                                    kind === 'extra'
                                        ? 'Nivel de proficiencia'
                                        : 'Nivel de ensino'
                                }
                                value={service.nivelEnsino}
                            />
                        </Section>

                        <Section title="Horario" icon={CalendarDays}>
                            <DetailRow
                                label="Data de inicio"
                                value={formatDate(service.dataInicio)}
                            />
                            {kind === 'extra' ? (
                                <DetailRow
                                    label="Data de fim"
                                    value={formatDate(service.dataFim)}
                                />
                            ) : null}
                            {Array.isArray(service.sessoes) &&
                            service.sessoes.length > 1 ? (
                                <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Sessoes
                                    </p>
                                    <ul className="space-y-1.5">
                                        {service.sessoes.map(
                                            (sessao, index) => (
                                                <li
                                                    key={`${sessao.dia}-${index}`}
                                                    className="text-sm font-medium text-slate-900"
                                                >
                                                    {weekDayLabels[
                                                        sessao.dia
                                                    ] || sessao.dia}
                                                    {': '}
                                                    {sessao.horaInicio || '-'}
                                                    {sessao.horaFim
                                                        ? ` - ${sessao.horaFim}`
                                                        : ''}
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            ) : (
                                <>
                                    <DetailRow
                                        label="Dias da semana"
                                        value={formatWeekDays(
                                            service.diasSemana
                                        )}
                                    />
                                    <DetailRow
                                        label="Hora de inicio"
                                        value={service.horaInicio}
                                    />
                                    <DetailRow
                                        label="Duracao"
                                        value={
                                            service.duracao
                                                ? `${service.duracao} min`
                                                : '-'
                                        }
                                    />
                                </>
                            )}
                        </Section>

                        <Section title="Recursos" icon={MapPin}>
                            <DetailRow
                                label="Professor"
                                value={service.professor}
                            />
                            <DetailRow label="Sala" value={service.sala} />
                        </Section>

                        <Section title="Alunos" icon={Users}>
                            {Array.isArray(service.alunosNomes) &&
                            service.alunosNomes.length > 0 ? (
                                <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Alunos associados (
                                        {service.alunosNomes.length})
                                    </p>
                                    <ul className="space-y-1">
                                        {service.alunosNomes.map((nome, index) => (
                                            <li
                                                key={`${nome}-${index}`}
                                                className="text-sm font-medium text-slate-900"
                                            >
                                                {nome}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <DetailRow
                                    label="Alunos associados"
                                    value={String(service.nAlunos || 0)}
                                />
                            )}
                        </Section>
                    </div>
                </div>
            </aside>
        </>
    );
}
