import { Clock3, MapPin, UserRound, Users, X } from 'lucide-react';
import {
    getAgendaCardTitle,
    getAlunosList,
    getAtividadeCategoria,
    getCoresAtividade,
    isAtividadeReposta,
} from './agendaUtils';

// Modal de Detalhes da Atividade
export default function AgendaActivityModal({ atividade, modo, onClose }) {
    const categoria = getAtividadeCategoria(atividade);
    const reposta = isAtividadeReposta(atividade);
    const cor = getCoresAtividade(atividade, modo);
    // A lista de alunos só aparece a quem gere a sessão.
    const alunos = modo === 'equipa' ? getAlunosList(atividade) : [];
    const badgeLabel = reposta
        ? 'Reposta'
        : categoria === 'extra'
          ? 'Extra-Curricular'
          : 'Curricular';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <article className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {/* Header com cor */}
                    <div
                        className={`border-b-2 px-6 py-4 ${cor.bg} ${cor.border}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2
                                    className={`text-2xl font-bold ${cor.text}`}
                                >
                                    {getAgendaCardTitle(atividade)}
                                </h2>
                                <span
                                    className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white ${cor.badge}`}
                                >
                                    {badgeLabel}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/70 text-slate-600 transition hover:bg-white"
                                aria-label="Fechar modal"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="px-6 py-4 space-y-4">
                        {/* Hora */}
                        <div className="flex items-center gap-3">
                            <Clock3 size={18} className="text-slate-500" />
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">
                                    Horário
                                </p>
                                <p className="text-base font-semibold text-slate-800">
                                    {atividade.hora}
                                    {atividade.horaFim
                                        ? ` - ${atividade.horaFim}`
                                        : ''}
                                </p>
                            </div>
                        </div>

                        {/* Professor */}
                        {(atividade.professor || atividade.responsavel) && (
                            <div className="flex items-center gap-3">
                                <UserRound
                                    size={18}
                                    className="text-slate-500"
                                />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                        Professor/Responsável
                                    </p>
                                    <p className="text-base font-semibold text-slate-800">
                                        {atividade.professor ||
                                            atividade.responsavel}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Alunos */}
                        {alunos.length > 0 && (
                            <div className="flex items-start gap-3">
                                <Users
                                    size={18}
                                    className="mt-0.5 text-slate-500"
                                />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                        Alunos
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {alunos.map((aluno) => (
                                            <span
                                                key={aluno}
                                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                            >
                                                {aluno}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Local */}
                        {atividade.local && (
                            <div className="flex items-center gap-3">
                                <MapPin size={18} className="text-slate-500" />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                        Local
                                    </p>
                                    <p className="text-base font-semibold text-slate-800">
                                        {atividade.local}
                                    </p>
                                </div>
                            </div>
                        )}

                        {reposta && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                                Aula marcada como reposta
                                {atividade.dataReposicao
                                    ? ` em ${atividade.dataReposicao}`
                                    : ''}
                            </div>
                        )}

                        {/* Descrição */}
                        {atividade.descricao && (
                            <div className="pt-2 border-t border-slate-200">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                                    Descrição
                                </p>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {atividade.descricao}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition"
                        >
                            Fechar
                        </button>
                    </div>
                </article>
            </div>
        </>
    );
}
