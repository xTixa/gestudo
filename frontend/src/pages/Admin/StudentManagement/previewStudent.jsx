import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserRound, School } from 'lucide-react';
import AdminPageHeader from '../../../components/layout/AdminPageHeader';
import { apiGet } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// função para formatar uma data em formato ISO ou português para o formato de data local, retornando um hífen caso o valor seja inválido ou ausente, garantindo que as datas sejam apresentadas de forma legível e consistente na interface
function formatDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleDateString('pt-PT');
}

// função para formatar um valor numérico como moeda em euros, usando a formatação local de Portugal, e retornando um hífen caso o valor seja inválido ou ausente, garantindo que os valores monetários sejam apresentados de forma legível e consistente na interface
function formatCurrency(value) {
    if (value == null || value === '') {
        return '-';
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
        return String(value);
    }

    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(numeric);
}

// função para parsear um valor de tempo no formato "HH:MM" para o total de minutos, retornando null caso o formato seja inválido ou ausente, garantindo que os valores de tempo sejam processados corretamente na interface
function parseTimeToMinutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) {
        return null;
    }

    return Number(match[1]) * 60 + Number(match[2]);
}

// função para formatar a duração entre um horário de início e um horário de fim, calculando a diferença em horas e minutos, e retornando uma string formatada como "XhYY" ou "Xh" caso os minutos sejam zero, ou um hífen caso os valores sejam inválidos ou o horário de fim seja anterior ao horário de início, garantindo que as durações sejam apresentadas de forma legível e consistente na interface
function formatDurationLabel(horaInicio, horaFim) {
    const inicio = parseTimeToMinutes(horaInicio);
    const fim = parseTimeToMinutes(horaFim);

    if (inicio == null || fim == null || fim <= inicio) {
        return '-';
    }

    const totalMinutes = fim - inicio;
    const horas = Math.floor(totalMinutes / 60);
    const minutos = totalMinutes % 60;

    if (minutos === 0) {
        return `${horas}h`;
    }

    return `${horas}h${String(minutos).padStart(2, '0')}`;
}

// função para obter a URL da imagem de perfil de um aluno, verificando diferentes campos onde a imagem pode estar armazenada, e construindo a URL completa usando a variável de ambiente API_URL caso o valor seja um caminho relativo, garantindo que a imagem de perfil seja exibida corretamente na interface mesmo que os dados do aluno tenham variações na estrutura ou formato da URL
function getAlunoProfileImage(aluno) {
    const raw =
        aluno?.imagem_perfil_url ||
        aluno?.pessoa?.imagem_perfil_url ||
        aluno?.pessoa?.user?.imagem_perfil_url ||
        '';

    const value = String(raw || '').trim();
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${API_URL}${value}`;
    }

    return `${API_URL}/${value}`;
}

export default function PreviewAluno() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function loadAlunos() {
            try {
                const response = await apiGet('/api/gestor/alunos');
                const data = await response.json();

                if (response.ok && isMounted) {
                    setAlunos(Array.isArray(data.alunos) ? data.alunos : []);
                }
            } catch {
                if (isMounted) {
                    setAlunos([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadAlunos();

        return () => {
            isMounted = false;
        };
    }, []);

    const aluno = useMemo(() => {
        if (location.state?.aluno) {
            return location.state.aluno;
        }

        return alunos.find(
            (item) => String(item.id_aluno || item.id) === String(id)
        );
    }, [alunos, id, location.state]);

    if (loading) {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">
                    A carregar aluno da base de dados...
                </p>
            </section>
        );
    }

    if (!aluno) {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
                <p className="text-lg font-semibold text-slate-800">
                    Ficha do Aluno
                </p>
                <p className="text-sm text-slate-500">Aluno não encontrado.</p>
                <button
                    type="button"
                    onClick={() => navigate('/gestor/alunos')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                    Voltar à gestão de alunos
                </button>
            </section>
        );
    }

    const servicosSubscritos = Array.isArray(aluno.servicosSubscritos)
        ? aluno.servicosSubscritos
        : [];
    const alunoImage = getAlunoProfileImage(aluno);

    return (
        <section className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.12)] sm:p-6 lg:p-8">
                <AdminPageHeader
                    eyebrow="Alunos"
                    title="Ficha do Aluno"
                    subtitle="Preview da ficha completa do aluno."
                    icon={UserRound}
                    actions={
                        <button
                            type="button"
                            onClick={() => navigate('/gestor/alunos')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft size={16} />
                            Voltar
                        </button>
                    }
                />

                <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
                    <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
                        <div className="flex items-center justify-center">
                            <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-400 shadow-inner sm:h-40 sm:w-40">
                                {alunoImage ? (
                                    <img
                                        src={alunoImage}
                                        alt="Foto de perfil do aluno"
                                        className="h-full w-full object-cover"
                                        onError={(event) => {
                                            const img = event.currentTarget;
                                            img.style.display = 'none';
                                            const fallback =
                                                img.parentElement?.querySelector(
                                                    '[data-profile-fallback="1"]'
                                                );
                                            if (fallback) {
                                                fallback.classList.remove(
                                                    'hidden'
                                                );
                                            }
                                        }}
                                    />
                                ) : null}
                                <div
                                    data-profile-fallback="1"
                                    className={alunoImage ? 'hidden' : ''}
                                >
                                    <UserRound size={72} strokeWidth={1.7} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                                <p className="text-sm text-slate-500">
                                    Nome Completo
                                </p>
                                <p className="mt-2 text-base font-medium text-slate-700">
                                    {aluno.nome || aluno?.pessoa?.nome || '-'}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-slate-500">Email</p>
                                <div className="mt-2 flex items-center gap-2 text-base font-medium text-slate-700">
                                    <span className="break-all">
                                        {aluno.email ||
                                            aluno?.pessoa?.user?.email ||
                                            '-'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-slate-500">Escola</p>
                                <p className="mt-2 text-base font-medium text-slate-700">
                                    {aluno.escola || '-'}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-slate-500">Ano</p>
                                <p className="mt-2 text-base font-medium text-slate-700">
                                    {aluno.ano != null
                                        ? `${aluno.ano}º ano`
                                        : '-'}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-slate-500">Turma</p>
                                <p className="mt-2 text-base font-medium text-slate-700">
                                    {aluno.turma || '-'}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-slate-500">
                                    Encarregado
                                </p>
                                <p className="mt-2 text-base font-medium text-slate-700">
                                    {aluno.encarregado?.pessoa?.nome ||
                                        aluno.encarregado ||
                                        '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                        <School size={18} className="text-slate-700" />
                        <h2 className="text-xl font-semibold text-slate-800">
                            Serviços Subscritos
                        </h2>
                    </div>

                    {servicosSubscritos.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Não existem serviços subscritos para este aluno.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {servicosSubscritos.map((servico) => (
                                <article
                                    key={servico.id_servico}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                                >
                                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800">
                                                {servico.tipoServico ||
                                                    servico.modalidade ||
                                                    'Serviço'}
                                            </h3>

                                            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500">
                                                        Modalidade
                                                    </p>
                                                    <p className="mt-1 font-medium text-slate-700">
                                                        {servico.modalidade ||
                                                            '-'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500">
                                                        Preço
                                                    </p>
                                                    <p className="mt-1 font-medium text-slate-700">
                                                        {formatCurrency(
                                                            servico.valor
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500">
                                                        Disciplinas
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                                            {servico.disciplina ||
                                                                '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500">
                                                        Data de Inscrição
                                                    </p>
                                                    <p className="mt-1 font-medium text-slate-700">
                                                        {formatDate(
                                                            servico.dataInscricao
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 lg:min-w-56">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    Nº Horas/Mês
                                                </p>
                                                <p className="mt-1 text-base font-semibold text-slate-800">
                                                    {formatDurationLabel(
                                                        servico.horaInicio,
                                                        servico.horaFim
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    Data Início
                                                </p>
                                                <p className="mt-1 font-medium text-slate-700">
                                                    {formatDate(
                                                        servico.dataInicio
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
