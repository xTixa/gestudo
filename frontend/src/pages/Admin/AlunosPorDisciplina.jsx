import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    BookOpen,
    Clock,
    GraduationCap,
    Loader2,
    Search,
    Users,
} from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { apiGet } from '../../utils/api';

const ESTADO_BADGE = {
    pendente: 'bg-amber-100 text-amber-700',
    aprovada: 'bg-emerald-100 text-emerald-700',
};

function groupByDisciplina(matriculados, interesse) {
    const map = new Map();

    function getEntry(disciplina) {
        const key = disciplina || 'Sem disciplina';
        if (!map.has(key)) {
            map.set(key, { disciplina: key, matriculados: [], interesse: [] });
        }
        return map.get(key);
    }

    matriculados.forEach((row) => {
        getEntry(row.disciplina).matriculados.push(row);
    });

    interesse.forEach((row) => {
        getEntry(row.disciplina).interesse.push(row);
    });

    return Array.from(map.values()).sort((a, b) =>
        a.disciplina.localeCompare(b.disciplina, 'pt-PT')
    );
}

export default function AlunosPorDisciplinaPage() {
    const [matriculados, setMatriculados] = useState([]);
    const [interesse, setInteresse] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            setLoading(true);
            setError('');
            try {
                const [matriculadosRes, interesseRes] = await Promise.all([
                    apiGet('/api/gestor/relatorios/alunos-por-disciplina?limit=500'),
                    apiGet('/api/gestor/relatorios/interesse-disciplinas?limit=500'),
                ]);

                const matriculadosData = await matriculadosRes.json();
                const interesseData = await interesseRes.json();

                if (!matriculadosRes.ok) {
                    throw new Error(
                        matriculadosData.message ||
                            'Erro ao carregar alunos matriculados.'
                    );
                }
                if (!interesseRes.ok) {
                    throw new Error(
                        interesseData.message ||
                            'Erro ao carregar candidatos interessados.'
                    );
                }

                if (isMounted) {
                    setMatriculados(
                        Array.isArray(matriculadosData.items)
                            ? matriculadosData.items
                            : []
                    );
                    setInteresse(
                        Array.isArray(interesseData.items)
                            ? interesseData.items
                            : []
                    );
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message || 'Erro ao carregar dados.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();
        return () => {
            isMounted = false;
        };
    }, []);

    const grupos = useMemo(
        () => groupByDisciplina(matriculados, interesse),
        [matriculados, interesse]
    );

    const filteredGrupos = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return grupos;

        return grupos
            .map((grupo) => {
                if (grupo.disciplina.toLowerCase().includes(term)) {
                    return grupo;
                }

                const matriculadosFiltrados = grupo.matriculados.filter((m) =>
                    (m.aluno || '').toLowerCase().includes(term)
                );
                const interesseFiltrado = grupo.interesse.filter((i) =>
                    (i.nome_completo || '').toLowerCase().includes(term)
                );

                if (!matriculadosFiltrados.length && !interesseFiltrado.length) {
                    return null;
                }

                return {
                    ...grupo,
                    matriculados: matriculadosFiltrados,
                    interesse: interesseFiltrado,
                };
            })
            .filter(Boolean);
    }, [grupos, search]);

    const totais = useMemo(
        () => ({
            disciplinas: grupos.length,
            matriculados: matriculados.length,
            interesse: interesse.length,
        }),
        [grupos, matriculados, interesse]
    );

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Alunos"
                title="Alunos por Disciplina"
                subtitle="Quem está matriculado e quem demonstrou interesse em cada disciplina."
                icon={BookOpen}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">
                        Disciplinas com dados
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                        {totais.disciplinas}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">
                        Alunos matriculados
                    </p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">
                        {totais.matriculados}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">
                        Candidatos interessados
                    </p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">
                        {totais.interesse}
                    </p>
                </div>
            </div>

            <div className="relative">
                <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar disciplina ou nome de aluno..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
            </div>

            {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 shadow-sm">
                    <Loader2 size={22} className="animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">
                        A carregar disciplinas...
                    </span>
                </div>
            ) : filteredGrupos.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
                    <BookOpen size={32} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm text-slate-400">
                        Nenhuma disciplina encontrada.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredGrupos.map((grupo) => (
                        <article
                            key={grupo.disciplina}
                            className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                                <h3 className="truncate text-sm font-bold text-slate-900">
                                    {grupo.disciplina}
                                </h3>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        <GraduationCap size={11} />
                                        {grupo.matriculados.length}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                        <Clock size={11} />
                                        {grupo.interesse.length}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 space-y-3 p-4">
                                <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        <Users size={12} />
                                        Matriculados
                                    </p>
                                    {grupo.matriculados.length === 0 ? (
                                        <p className="text-xs text-slate-400">
                                            Ninguém matriculado ainda.
                                        </p>
                                    ) : (
                                        <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                                            {grupo.matriculados.map((m, idx) => (
                                                <li
                                                    key={`${m.aluno}-${idx}`}
                                                    className="rounded-lg bg-slate-50 px-2.5 py-1.5"
                                                >
                                                    <p className="truncate text-xs font-semibold text-slate-700">
                                                        {m.aluno}
                                                    </p>
                                                    <p className="truncate text-[11px] text-slate-500">
                                                        {[
                                                            m.ano
                                                                ? `${m.ano}º ano`
                                                                : null,
                                                            m.turma
                                                                ? `Turma ${m.turma}`
                                                                : null,
                                                            m.modalidade,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ') || '-'}
                                                    </p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div>
                                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        <Clock size={12} />
                                        Interesse / candidatos
                                    </p>
                                    {grupo.interesse.length === 0 ? (
                                        <p className="text-xs text-slate-400">
                                            Sem candidatos pendentes.
                                        </p>
                                    ) : (
                                        <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                                            {grupo.interesse.map((c, idx) => (
                                                <li
                                                    key={`${c.id_inscricao_publica}-${idx}`}
                                                    className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-xs font-semibold text-slate-700">
                                                            {c.nome_completo}
                                                        </p>
                                                        <p className="truncate text-[11px] text-slate-500">
                                                            {[
                                                                c.modalidade,
                                                                c.pacote
                                                                    ? `${c.pacote}h`
                                                                    : '',
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ') || '-'}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                            ESTADO_BADGE[
                                                                String(
                                                                    c.estado || ''
                                                                ).toLowerCase()
                                                            ] ||
                                                            'bg-slate-100 text-slate-600'
                                                        }`}
                                                    >
                                                        {c.estado}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
