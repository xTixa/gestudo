import { useEffect, useState } from 'react';
import {
    BookOpen,
    CheckCircle2,
    ClipboardList,
    GraduationCap,
    Layers,
    Plus,
    RefreshCcw,
    Trash2,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import UsersPageHeader from '../../components/layout/UsersPageHeader';

const ANO_ESCOLAR_OPTIONS = [
    '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano',
    '7º Ano', '8º Ano', '9º Ano', '10º Ano', '11º Ano', '12º Ano',
];

const ANOS_ESCOLARES_POR_NIVEL = {
    '1_ciclo': ['1º Ano', '2º Ano', '3º Ano', '4º Ano'],
    '2_ciclo': ['5º Ano', '6º Ano'],
    '3_ciclo': ['7º Ano', '8º Ano', '9º Ano'],
    secundario: ['10º Ano', '11º Ano', '12º Ano'],
};

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getAnosEscolaresPorNivel(nivel) {
    const nivelNormalizado = normalizeText(nivel?.key || nivel?.label || nivel?.value);
    if (!nivelNormalizado) return [];
    if (nivelNormalizado.includes('superior')) return [];
    for (const [key, anos] of Object.entries(ANOS_ESCOLARES_POR_NIVEL)) {
        if (nivelNormalizado.includes(key)) return anos;
    }
    return ANO_ESCOLAR_OPTIONS;
}

function newPlanoItem(id) {
    return { id, disciplina: '', tipoServico: '', modalidade: '', pacote: '' };
}

const SELECT_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const SELECT_DISABLED_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const INPUT_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const LABEL_CLS = 'text-sm font-semibold text-slate-700';

function Req() {
    return <span className="ml-0.5 text-red-500">*</span>;
}

export default function ReinscricaoAlunoPage() {
    const [sent, setSent] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [disciplinasOptions, setDisciplinasOptions] = useState([]);
    const [niveisEnsinoOptions, setNiveisEnsinoOptions] = useState([]);
    const [modalidadesOptions, setModalidadesOptions] = useState([]);
    const [tipoServicoOptions, setTipoServicoOptions] = useState([]);
    const [pacotesOptions, setPacotesOptions] = useState([]);
    const [selectedNivel, setSelectedNivel] = useState('');
    const [selectedAnoEscolar, setSelectedAnoEscolar] = useState('');
    const [turma, setTurma] = useState('');
    const [obs, setObs] = useState('');
    const [loadingOpcoes, setLoadingOpcoes] = useState(true);
    const [erroOpcoes, setErroOpcoes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [planoItems, setPlanoItems] = useState([newPlanoItem(1)]);
    const [planoNextId, setPlanoNextId] = useState(2);

    useEffect(() => {
        let isMounted = true;
        async function carregarOpcoes() {
            setLoadingOpcoes(true);
            setErroOpcoes('');
            try {
                const response = await apiGet('/api/aluno/reinscricao/opcoes');
                if (!response.ok) throw new Error('Falha ao carregar opções.');
                const data = await response.json();
                if (!isMounted) return;
                setDisciplinasOptions(
                    Array.isArray(data?.disciplinas) ? data.disciplinas.filter((i) => i?.label) : []
                );
                setNiveisEnsinoOptions(
                    Array.isArray(data?.niveisEnsino) ? data.niveisEnsino.filter((i) => i?.label) : []
                );
                setModalidadesOptions(
                    Array.isArray(data?.modalidades) ? data.modalidades.filter((i) => i?.label) : []
                );
                setTipoServicoOptions(
                    Array.isArray(data?.tiposServico)
                        ? data.tiposServico.filter((i) => i?.label)
                        : Array.isArray(data?.tipoServico)
                          ? data.tipoServico.filter((i) => i?.label)
                          : []
                );
                setPacotesOptions(
                    Array.isArray(data?.pacotes)
                        ? data.pacotes.filter((p) => p?.horas != null)
                        : []
                );
            } catch (error) {
                if (!isMounted) return;
                setErroOpcoes(
                    error?.message ||
                        'Não foi possível carregar disciplinas, níveis, modalidades e tipos de serviço.'
                );
            } finally {
                if (isMounted) setLoadingOpcoes(false);
            }
        }
        carregarOpcoes();
        return () => { isMounted = false; };
    }, []);

    const nivelSelecionado = niveisEnsinoOptions.find((n) => String(n.id) === selectedNivel);
    const anosEscolaresOptions = getAnosEscolaresPorNivel(nivelSelecionado);
    const isEnsinoSuperior = normalizeText(
        nivelSelecionado?.key || nivelSelecionado?.label || nivelSelecionado?.value
    ).includes('superior');

    const disciplinasFiltradas = disciplinasOptions.filter((item) => {
        if (!selectedNivel) return false;
        const selectedKey = nivelSelecionado?.key || normalizeText(nivelSelecionado?.label);
        return (
            (item.nivelRef && String(item.nivelRef) === String(selectedNivel)) ||
            (item.nivelRefKey && item.nivelRefKey === selectedKey)
        );
    });

    useEffect(() => {
        if (selectedAnoEscolar && (!anosEscolaresOptions.includes(selectedAnoEscolar) || isEnsinoSuperior)) {
            setSelectedAnoEscolar('');
        }
    }, [anosEscolaresOptions, isEnsinoSuperior, selectedAnoEscolar]);

    function isModalidadeIndividual(modalidadeId) {
        if (!modalidadeId) return false;
        const m = modalidadesOptions.find((opt) => String(opt.id) === modalidadeId);
        const n = normalizeText(m?.label || m?.value);
        return n.includes('individu') || n.includes('explicacao_individual');
    }

    function getHorasDisponiveis(item) {
        const disciplinaOption = disciplinasOptions.find(
            (opt) => opt.value === item.disciplina
        );
        const idDisciplina = disciplinaOption ? String(disciplinaOption.id) : '';
        const idModalidade = item.modalidade ? String(item.modalidade) : '';

        const compativel = pacotesOptions.filter((p) => {
            const disciplinaOk = !p.idDisciplina || p.idDisciplina === idDisciplina;
            const modalidadeOk = !p.idModalidade || p.idModalidade === idModalidade;
            return disciplinaOk && modalidadeOk;
        });

        return Array.from(new Set(compativel.map((p) => p.horas))).sort(
            (a, b) => a - b
        );
    }

    function updatePlanoItem(id, field, value) {
        setPlanoItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const updated = { ...item, [field]: value };
                if (field === 'tipoServico') { updated.modalidade = ''; updated.pacote = ''; }
                if (field === 'modalidade') { updated.pacote = ''; }
                return updated;
            })
        );
    }

    function addPlanoItem() {
        setPlanoItems((prev) => [...prev, newPlanoItem(planoNextId)]);
        setPlanoNextId((n) => n + 1);
    }

    function removePlanoItem(id) {
        setPlanoItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
    }

    function validarPlano() {
        if (!selectedNivel) return 'Selecione o nível de ensino.';
        if (!isEnsinoSuperior && !selectedAnoEscolar) return 'Selecione o ano escolar.';
        if (planoItems.length === 0) return 'Adicione pelo menos uma disciplina ao plano.';
        for (let i = 0; i < planoItems.length; i++) {
            const item = planoItems[i];
            const n = i + 1;
            if (!item.disciplina) return `Selecione a disciplina no plano ${n}.`;
            if (!item.tipoServico) return `Selecione o tipo de serviço no plano ${n}.`;
            if (!isModalidadeIndividual(item.modalidade) && !item.pacote) {
                return `Selecione as horas pretendidas no plano ${n}.`;
            }
        }
        return '';
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitError('');
        setSent(false);

        const planoError = validarPlano();
        if (planoError) { setSubmitError(planoError); return; }

        setSubmitting(true);
        try {
            const payload = {
                nivel_ensino: selectedNivel,
                ano_escolar: isEnsinoSuperior ? '' : selectedAnoEscolar,
                turma,
                obs,
                plano: planoItems.map((item) => ({
                    disciplina: item.disciplina,
                    tipo_servico: item.tipoServico,
                    modalidade: item.modalidade,
                    pacote: item.pacote,
                })),
            };

            const response = await apiPost('/api/aluno/reinscricao', payload);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.message || 'Não foi possível enviar a reinscrição.');
            }

            setSent(true);
            setSelectedNivel('');
            setSelectedAnoEscolar('');
            setTurma('');
            setObs('');
            setPlanoItems([newPlanoItem(1)]);
            setPlanoNextId(2);
        } catch (error) {
            setSubmitError(error?.message || 'Não foi possível enviar a reinscrição.');
        } finally {
            setSubmitting(false);
        }
    }

    const disciplinasPreenchidas = planoItems.filter((item) => item.disciplina).length;
    const nivelLabel = nivelSelecionado?.label || '';

    return (
        <section className="space-y-5">
            <UsersPageHeader
                eyebrow="Painel do Aluno"
                title="Reinscrição"
                subtitle="Atualize o nível de ensino, ano, turma e as disciplinas pretendidas para o novo ano letivo."
                icon={RefreshCcw}
            />

            {sent ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                    <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div>
                        <p className="font-medium text-emerald-800">Reinscrição enviada com sucesso!</p>
                        <p className="mt-0.5 text-sm text-emerald-700">
                            Aguarde a confirmação por parte do gestor. Pode acompanhar o estado a partir do dashboard.
                        </p>
                    </div>
                </div>
            ) : null}

            {erroOpcoes ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 shadow-sm">
                    {erroOpcoes}
                </div>
            ) : null}

            <form onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-6">
                        {submitError ? (
                            <p role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {submitError}
                            </p>
                        ) : null}

                        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                    <GraduationCap size={20} />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Nível e Turma</h2>
                                    <p className="text-sm text-slate-500">Em que nível/ano vai continuar os estudos.</p>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className={LABEL_CLS}>
                                    Nível de Ensino <Req />
                                    <select
                                        required value={selectedNivel}
                                        onChange={(e) => setSelectedNivel(e.target.value)}
                                        className={SELECT_CLS}
                                    >
                                        <option value="">Selecionar</option>
                                        {loadingOpcoes ? <option value="">A carregar...</option> : null}
                                        {niveisEnsinoOptions.map((item) => (
                                            <option key={item.id} value={item.id}>{item.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={LABEL_CLS}>
                                    Ano Escolar {!isEnsinoSuperior && <Req />}
                                    <select
                                        required value={selectedAnoEscolar}
                                        onChange={(e) => setSelectedAnoEscolar(e.target.value)}
                                        disabled={!selectedNivel || loadingOpcoes || isEnsinoSuperior}
                                        className={SELECT_DISABLED_CLS}
                                    >
                                        <option value="">
                                            {!selectedNivel ? 'Selecione primeiro o nível' : isEnsinoSuperior ? 'Não aplicável' : 'Selecionar'}
                                        </option>
                                        {!isEnsinoSuperior
                                            ? anosEscolaresOptions.map((ano) => (
                                                  <option key={ano} value={ano}>{ano}</option>
                                              ))
                                            : null}
                                    </select>
                                </label>
                                <label className={LABEL_CLS}>
                                    Turma
                                    <input
                                        type="text" value={turma}
                                        onChange={(e) => setTurma(e.target.value)}
                                        placeholder="Ex: B" className={INPUT_CLS}
                                    />
                                </label>
                            </div>
                        </article>

                        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                    <BookOpen size={20} />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Plano de Disciplinas</h2>
                                    <p className="text-sm text-slate-500">
                                        Pode inscrever-se em mais do que uma disciplina, cada uma com o seu tipo de serviço, modalidade e horas.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4">
                                {planoItems.map((item, index) => {
                                    const isIndividual = isModalidadeIndividual(item.modalidade);
                                    const podePacote = Boolean(item.tipoServico) && !isIndividual;
                                    const horasDisponiveis = podePacote ? getHorasDisponiveis(item) : [];

                                    return (
                                        <div
                                            key={item.id}
                                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                                                        {index + 1}
                                                    </span>
                                                    Disciplina {index + 1}
                                                </span>
                                                {planoItems.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => removePlanoItem(item.id)}
                                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        <Trash2 size={14} />
                                                        Remover
                                                    </button>
                                                ) : null}
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <label className={LABEL_CLS}>
                                                    Disciplina <Req />
                                                    <select
                                                        value={item.disciplina}
                                                        onChange={(e) => updatePlanoItem(item.id, 'disciplina', e.target.value)}
                                                        disabled={!selectedNivel || loadingOpcoes}
                                                        className={SELECT_DISABLED_CLS}
                                                    >
                                                        <option value="">
                                                            {!selectedNivel ? 'Selecione primeiro o nível' : 'Selecionar'}
                                                        </option>
                                                        {disciplinasFiltradas.map((d) => (
                                                            <option key={d.id} value={d.value}>{d.label}</option>
                                                        ))}
                                                    </select>
                                                    {selectedNivel && !loadingOpcoes && disciplinasFiltradas.length === 0 ? (
                                                        <p className="mt-1 text-xs text-amber-600">
                                                            Sem disciplinas para este nível.
                                                        </p>
                                                    ) : null}
                                                </label>

                                                <label className={LABEL_CLS}>
                                                    Tipo de Serviço <Req />
                                                    <select
                                                        value={item.tipoServico}
                                                        onChange={(e) => updatePlanoItem(item.id, 'tipoServico', e.target.value)}
                                                        className={SELECT_CLS}
                                                    >
                                                        <option value="">Selecionar</option>
                                                        {loadingOpcoes ? <option value="">A carregar...</option> : null}
                                                        {tipoServicoOptions.map((o) => (
                                                            <option key={o.id} value={o.id}>{o.label || o.value}</option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                                    Modalidade
                                                    <select
                                                        value={item.modalidade}
                                                        onChange={(e) => updatePlanoItem(item.id, 'modalidade', e.target.value)}
                                                        disabled={!item.tipoServico || loadingOpcoes}
                                                        className={SELECT_DISABLED_CLS}
                                                    >
                                                        <option value="">
                                                            {!item.tipoServico ? 'Selecione primeiro o tipo de serviço' : 'Selecionar'}
                                                        </option>
                                                        {modalidadesOptions.map((o) => (
                                                            <option key={o.id} value={o.id}>{o.label}</option>
                                                        ))}
                                                    </select>
                                                </label>

                                                {!isIndividual ? (
                                                    <fieldset className="sm:col-span-2" disabled={!podePacote}>
                                                        <legend className={LABEL_CLS}>
                                                            Horas Pretendidas {podePacote && <Req />}
                                                        </legend>
                                                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                                                            {horasDisponiveis.map((horas) => (
                                                                <label
                                                                    key={horas}
                                                                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${!podePacote ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : Number(item.pacote) === horas ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name={`pacote_${item.id}`}
                                                                        value={horas}
                                                                        checked={Number(item.pacote) === horas}
                                                                        onChange={() => updatePlanoItem(item.id, 'pacote', String(horas))}
                                                                        disabled={!podePacote}
                                                                        className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                                    />
                                                                    <span>{horas}h</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {podePacote && horasDisponiveis.length === 0 ? (
                                                            <p className="mt-2 text-xs text-amber-600">
                                                                Sem pacotes de horas disponíveis para esta disciplina/modalidade.
                                                            </p>
                                                        ) : null}
                                                    </fieldset>
                                                ) : (
                                                    <p className="text-xs text-slate-500 sm:col-span-2">
                                                        Horas pretendidas não aplicáveis para explicação individual.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={addPlanoItem}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                    <Plus size={16} />
                                    Adicionar outra disciplina
                                </button>
                            </div>

                            <label className={`${LABEL_CLS} mt-5 block`}>
                                Observações
                                <textarea
                                    rows={4}
                                    value={obs}
                                    onChange={(e) => setObs(e.target.value)}
                                    className={`${INPUT_CLS} resize-none`}
                                    placeholder="Informações relevantes sobre objetivos ou disponibilidade."
                                />
                            </label>
                        </article>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? (
                                'A enviar...'
                            ) : (
                                <>
                                    <RefreshCcw size={16} />
                                    Enviar Reinscrição
                                </>
                            )}
                        </button>
                    </div>

                    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
                        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                                    <ClipboardList size={20} />
                                </span>
                                <h2 className="text-base font-bold text-slate-800">Resumo</h2>
                            </div>

                            <dl className="mt-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <dt className="text-slate-500">Nível de ensino</dt>
                                    <dd className="font-semibold text-slate-800">
                                        {nivelLabel || '—'}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <dt className="text-slate-500">Ano escolar</dt>
                                    <dd className="font-semibold text-slate-800">
                                        {isEnsinoSuperior ? 'Não aplicável' : selectedAnoEscolar || '—'}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <dt className="text-slate-500">Turma</dt>
                                    <dd className="font-semibold text-slate-800">{turma || '—'}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="flex items-center gap-1.5 text-slate-500">
                                        <Layers size={14} />
                                        Disciplinas no plano
                                    </dt>
                                    <dd className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-bold text-emerald-700">
                                        {disciplinasPreenchidas}
                                    </dd>
                                </div>
                            </dl>
                        </article>

                        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-emerald-800">Como funciona</h3>
                            <ul className="mt-3 space-y-2 text-sm text-emerald-700">
                                <li className="flex gap-2">
                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                    Os seus dados pessoais e do encarregado de educação já estão guardados e não precisam de ser repetidos.
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                    Depois de enviar, o pedido fica pendente até o gestor o aprovar.
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                    Pode acompanhar o estado do pedido a partir do dashboard.
                                </li>
                            </ul>
                        </article>
                    </aside>
                </div>
            </form>
        </section>
    );
}
