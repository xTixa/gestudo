import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Clock3, Users } from 'lucide-react';
import { apiGet } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

// função para formatar um valor de horas, arredondando para uma casa decimal e adicionando o sufixo "h", garantindo que valores inválidos ou negativos sejam tratados como "0h" e que valores inteiros sejam exibidos sem casas decimais
function formatHours(hoursValue) {
    const value = Number(hoursValue);
    if (!Number.isFinite(value) || value <= 0) {
        return '0h';
    }

    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

// função para obter as iniciais de um nome, dividindo o nome em partes, pegando a primeira letra de cada parte, limitando a duas letras e convertendo para maiúsculas, garantindo que nomes inválidos ou vazios sejam tratados como uma string vazia e que as iniciais sejam apresentadas de forma consistente
function getInitials(name) {
    return String(name || '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] || '')
        .join('')
        .toUpperCase();
}

// função para obter um subtítulo para um aluno, verificando as propriedades "turma" e "ano" do objeto aluno, retornando a turma se estiver presente, caso contrário retornando o ano, e se ambos estiverem ausentes retornando a string "Aluno", garantindo que os alunos sejam identificados de forma clara e consistente na interface
function getStudentSubtitle(student) {
    const turma = String(student?.turma || '').trim();
    const ano = String(student?.ano || '').trim();

    if (turma) {
        return turma;
    }

    if (ano) {
        return ano;
    }

    return 'Aluno';
}

// função para determinar o rótulo de sessões por mês para um aluno, utilizando o ID do serviço e o índice do aluno para alternar entre "2 sessões/mês" e "4 sessões/mês", garantindo que os alunos sejam atribuídos a um número de sessões de forma consistente e previsível
function getStudentSessionsLabel(serviceId, index) {
    const numericId = Number(serviceId) || 0;
    return (numericId + index) % 2 === 0 ? '2 sessões/mês' : '4 sessões/mês';
}

// componente para exibir um cartão de métrica com um ícone, um valor e um rótulo, estilizado com classes Tailwind CSS para garantir uma apresentação visualmente agradável e consistente, e que os valores sejam destacados de forma clara para facilitar a leitura e compreensão das métricas apresentadas
function MetricCard({ icon, value, label }) {
    return (
        <div className="rounded-2xl bg-[#f8fafc] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="flex justify-center text-slate-500">{icon}</div>
            <div className="mt-1 text-[26px] font-semibold leading-none text-slate-700">
                {value}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                {label}
            </div>
        </div>
    );
}

// componente para exibir um cartão de serviço, contendo informações sobre o serviço, métricas e uma lista de alunos associados, estilizado com classes Tailwind CSS para garantir uma apresentação visualmente agradável e consistente, e que as informações sejam organizadas de forma clara e acessível para facilitar a leitura e compreensão dos detalhes do serviço
function ServiceCard({ service }) {
    return (
        <article className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9b7ea] text-white shadow-sm">
                        <BookOpen size={18} />
                    </span>
                </div>
                <span className="rounded-lg bg-[#f3e8ff] px-2.5 py-1 text-xs font-semibold text-[#a855f7]">
                    {service.badge}
                </span>
            </div>

            <div className="mt-4">
                <h2 className="text-[28px] font-semibold leading-tight text-slate-700">
                    {service.titulo}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{service.ano}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
                <MetricCard
                    icon={<Users size={14} />}
                    value={service.alunosCount}
                    label="Alunos"
                />
                <MetricCard
                    icon={<CalendarDays size={14} />}
                    value={service.sessoesMes}
                    label="Sessões/mês"
                />
                <MetricCard
                    icon={<Clock3 size={14} />}
                    value={formatHours(service.horasMes)}
                    label="Horas/mês"
                />
            </div>

            <div className="mt-5">
                <h3 className="text-sm font-medium text-slate-500">
                    Lista de Alunos
                </h3>

                <div className="mt-2 space-y-2">
                    {service.alunos.length ? (
                        service.alunos.map((student, index) => (
                            <div
                                key={`${service.id}-${student.id || index}`}
                                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a8d5e2] text-xs font-semibold text-white">
                                        {getInitials(student.nome) || 'AA'}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-700">
                                            {student.nome}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {getStudentSubtitle(student)}
                                        </p>
                                    </div>
                                </div>

                                <span className="ml-3 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500">
                                    {getStudentSessionsLabel(service.id, index)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            Sem alunos associados a este serviço.
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

export default function ServicosProfessorPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadServicos() {
            setLoading(true);
            setError('');

            try {
                const response = await apiGet('/api/professor/servicos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar serviços.'
                    );
                }

                if (isMounted) {
                    setRows(Array.isArray(data?.servicos) ? data.servicos : []);
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(
                        requestError.message || 'Erro ao carregar serviços.'
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadServicos();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Serviços do professor"
                title="Os Meus Serviços"
                subtitle="Visualize os serviços associados à tua conta, incluindo detalhes sobre os alunos, sessões e horas mensais."
                icon={CalendarDays}
            />

            {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
                    A carregar serviços...
                </div>
            ) : null}

            {!loading && error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            {!loading && !error && rows.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {rows.map((service) => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500">
                    Sem serviços associados à tua conta neste período.
                </div>
            ) : null}
        </section>
    );
}
