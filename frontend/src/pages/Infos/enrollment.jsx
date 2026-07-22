import { useEffect, useRef, useState } from 'react';
import PublicNavbar from '../../components/infos/PublicNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASES = Array.from(
    new Set([API_URL, ''].map((base) => String(base || '').trim()))
).filter((base) => base !== '');

const PACOTE_OPTIONS = ['6h/mês', '8h/mês', '12h/mês'];

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

function buildApiUrl(base, path) {
    const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
    return `${String(base || '').replace(/\/$/, '')}${normalizedPath}`;
}

async function fetchWithFallback(path, options) {
    const candidates = [...API_BASES, ''];
    let lastError = null;
    for (const base of candidates) {
        const url = buildApiUrl(base, path);
        try {
            return await fetch(url, options);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('Não foi possível contactar o servidor.');
}

function Req() {
    return <span className="ml-0.5 text-red-500">*</span>;
}

const INPUT_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const SELECT_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const SELECT_DISABLED_CLS =
    'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
const LABEL_CLS = 'text-sm font-semibold text-slate-700';

function newPlanoItem(id) {
    return { id, disciplina: '', tipoServico: '', modalidade: '', pacote: '' };
}

export default function InfosInscricaoPage() {
    const [sent, setSent] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [disciplinasOptions, setDisciplinasOptions] = useState([]);
    const [niveisEnsinoOptions, setNiveisEnsinoOptions] = useState([]);
    const [modalidadesOptions, setModalidadesOptions] = useState([]);
    const [tipoServicoOptions, setTipoServicoOptions] = useState([]);
    const [selectedNivel, setSelectedNivel] = useState('');
    const [selectedAnoEscolar, setSelectedAnoEscolar] = useState('');
    const [loadingOpcoes, setLoadingOpcoes] = useState(true);
    const [erroOpcoes, setErroOpcoes] = useState('');
    const [liveErrors, setLiveErrors] = useState({});
    const [textos, setTextos] = useState({});

    // Multi-discipline plan
    const [planoItems, setPlanoItems] = useState([newPlanoItem(1)]);
    const [planoNextId, setPlanoNextId] = useState(2);

    // Refs for address copy
    const alunoMoradaRef = useRef(null);
    const alunoLocalidadeRef = useRef(null);
    const alunoCodigoPostalRef = useRef(null);
    const eeMoradaRef = useRef(null);
    const eeLocalidadeRef = useRef(null);
    const eeCodigoPostalRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        async function carregarOpcoes() {
            setLoadingOpcoes(true);
            setErroOpcoes('');
            try {
                const response = await fetchWithFallback('/api/public/inscricao-opcoes');
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
            } catch (error) {
                if (!isMounted) return;
                setErroOpcoes(
                    error?.message ||
                        'Não foi possível carregar disciplinas, níveis, modalidades e tipos de serviço da base de dados.'
                );
            } finally {
                if (isMounted) setLoadingOpcoes(false);
            }
        }
        carregarOpcoes();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        async function carregarTextos() {
            try {
                const response = await fetchWithFallback('/api/public/inscricao-textos');
                if (!response.ok) return;
                const data = await response.json();
                if (!isMounted) return;
                setTextos(data?.textos && typeof data.textos === 'object' ? data.textos : {});
            } catch {
                // Falha silenciosa: mantém os textos por omissão hardcoded no JSX.
            }
        }
        carregarTextos();
        return () => { isMounted = false; };
    }, []);

    function t(key, fallback) {
        return textos[key] ?? fallback;
    }

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

    // ── Plan helpers ─────────────────────────────────────────────────────────

    function isModalidadeIndividual(modalidadeId) {
        if (!modalidadeId) return false;
        const m = modalidadesOptions.find((opt) => String(opt.id) === modalidadeId);
        const n = normalizeText(m?.label || m?.value);
        return n.includes('individu') || n.includes('explicacao_individual');
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
        setPlanoItems((prev) => prev.filter((item) => item.id !== id));
    }

    function validarPlano() {
        if (planoItems.length === 0) return 'Adicione pelo menos uma disciplina ao plano.';
        for (let i = 0; i < planoItems.length; i++) {
            const item = planoItems[i];
            const n = i + 1;
            if (!item.disciplina) return `Selecione a disciplina no plano ${n}.`;
            if (!item.tipoServico) return `Selecione o tipo de serviço no plano ${n}.`;
            if (!item.modalidade) return `Selecione a modalidade no plano ${n}.`;
            if (!isModalidadeIndividual(item.modalidade) && !item.pacote) {
                return `Selecione um pacote no plano ${n}.`;
            }
        }
        return '';
    }

    // ── Form validation ───────────────────────────────────────────────────────

    function validarFormulario(formData) {
        const requiredFields = [
            'data_inicio', 'nome_completo', 'data_nascimento', 'email',
            'telemovel', 'cartao_cidadao', 'nif',
            'morada', 'localidade', 'codigo_postal', 'escola',
            ...(isEnsinoSuperior ? [] : ['ano_escolar']),
            'ee_nome', 'ee_email', 'ee_telemovel',
            'ee_morada', 'ee_localidade', 'ee_codigo_postal', 'ee_parentesco',
            'nivel_ensino',
        ];

        for (const field of requiredFields) {
            if (!String(formData.get(field) || '').trim()) {
                return 'Preencha todos os campos obrigatórios.';
            }
        }

        const postalCodeRegex = /^\d{4}-\d{3}$/;
        const phoneRegex = /^\d{9}$/;
        const nifRegex = /^\d{9}$/;

        const codAluno = String(formData.get('codigo_postal') || '').trim();
        const codEe = String(formData.get('ee_codigo_postal') || '').trim();
        if (!postalCodeRegex.test(codAluno) || !postalCodeRegex.test(codEe)) {
            return 'Código postal inválido. Use o formato 0000-000.';
        }

        const phones = [
            String(formData.get('telemovel') || '').trim(),
            String(formData.get('ee_telemovel') || '').trim(),
        ];
        if (phones.some((v) => !phoneRegex.test(v))) {
            return 'Telefone/telemóvel inválido. Deve conter 9 dígitos.';
        }

        const telefone = String(formData.get('telefone') || '').trim();
        if (telefone && !phoneRegex.test(telefone)) {
            return 'Telefone inválido. Deve conter 9 dígitos.';
        }

        const nifAluno = String(formData.get('nif') || '').trim();
        if (!nifRegex.test(nifAluno)) {
            return 'NIF inválido. Deve conter 9 dígitos.';
        }

        return '';
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitError('');
        setSent(false);

        const formElement = event.currentTarget;
        const formData = new FormData(formElement);

        const formError = validarFormulario(formData);
        if (formError) { setSubmitError(formError); return; }

        const planoError = validarPlano();
        if (planoError) { setSubmitError(planoError); return; }

        try {
            const payload = Object.fromEntries(formData.entries());

            // Attach multi-plan array
            payload.plano = planoItems.map((item) => ({
                disciplina: item.disciplina,
                tipo_servico: item.tipoServico,
                modalidade: item.modalidade,
                pacote: item.pacote,
            }));

            // Keep flat columns from first item for backward compat with existing DB columns
            const first = planoItems[0] || {};
            payload.disciplina = first.disciplina || '';
            payload.tipo_servico = first.tipoServico || '';
            payload.modalidade = first.modalidade || '';
            payload.pacote = first.pacote || '';

            const response = await fetchWithFallback('/api/public/inscricao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data?.detail
                        ? `${data?.message || 'Erro ao enviar inscrição.'} (${data.detail})`
                        : data?.message || 'Não foi possível enviar a inscrição.'
                );
            }

            setSent(true);
            if (formElement) formElement.reset();
            setSelectedNivel('');
            setSelectedAnoEscolar('');
            setPlanoItems([newPlanoItem(1)]);
            setPlanoNextId(2);
            setLiveErrors({});
        } catch (error) {
            setSubmitError(error?.message || 'Não foi possível enviar a inscrição.');
        }
    }

    // ── Live validation ───────────────────────────────────────────────────────

    function getLiveFieldError(name, value) {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';

        if (name === 'nif') {
            if (rawValue.replace(/\D/g, '').length !== 9) return 'NIF deve conter 9 dígitos.';
        }
        if (name === 'telemovel' || name === 'telefone' || name === 'ee_telemovel') {
            if (rawValue.replace(/\D/g, '').length !== 9) return 'Número deve conter 9 dígitos.';
        }
        if (name === 'codigo_postal' || name === 'ee_codigo_postal') {
            if (!/^\d{4}-\d{3}$/.test(rawValue)) return 'Formato inválido (0000-000).';
        }
        return '';
    }

    function handleLiveValidation(event) {
        const { name } = event.target;
        let { value } = event.target;

        if (name === 'nif') {
            value = value.replace(/\D/g, '').slice(0, 9);
        }
        if (name === 'telemovel' || name === 'telefone' || name === 'ee_telemovel') {
            value = value.replace(/\D/g, '').slice(0, 9);
        }
        if (name === 'codigo_postal' || name === 'ee_codigo_postal') {
            const digits = value.replace(/\D/g, '').slice(0, 7);
            value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
        }

        event.target.value = value;
        setLiveErrors((prev) => ({ ...prev, [name]: getLiveFieldError(name, value) }));
    }

    function copiarMoradaAluno() {
        const morada = alunoMoradaRef.current?.value || '';
        const localidade = alunoLocalidadeRef.current?.value || '';
        const cp = alunoCodigoPostalRef.current?.value || '';
        if (eeMoradaRef.current) eeMoradaRef.current.value = morada;
        if (eeLocalidadeRef.current) eeLocalidadeRef.current.value = localidade;
        if (eeCodigoPostalRef.current) eeCodigoPostalRef.current.value = cp;
        setLiveErrors((prev) => ({
            ...prev,
            ee_codigo_postal: cp && !/^\d{4}-\d{3}$/.test(cp) ? 'Formato inválido (0000-000).' : '',
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <PublicNavbar />

            <main>
                <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white">
                    <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                            {t('hero_eyebrow', 'Inscrições')}
                        </p>
                        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
                            {t('hero_title', 'Formulário de Inscrição 2025/2026')}
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm text-slate-200 sm:text-base">
                            {t('hero_subtitle', 'Preencha os dados do aluno e do encarregado de educação.')}
                        </p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {erroOpcoes ? (
                            <p role="alert" aria-live="assertive" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {erroOpcoes}
                            </p>
                        ) : null}
                        {submitError ? (
                            <p role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {submitError}
                            </p>
                        ) : null}

                        <p className="text-xs text-slate-500">
                            {t('required_fields_note', 'Os campos marcados com * são obrigatórios.')}
                        </p>

                        {/* ── Dados do Aluno ─────────────────────────────── */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                {t('section_aluno_heading', 'Dados do Aluno')}
                            </h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className={LABEL_CLS}>
                                    {t('label_data_inicio', 'Data de Início')} <Req />
                                    <input name="data_inicio" type="date" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_nome_completo', 'Nome Completo')} <Req />
                                    <input name="nome_completo" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_data_nascimento', 'Data de Nascimento')} <Req />
                                    <input name="data_nascimento" type="date" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_email_aluno', 'Email')} <Req />
                                    <input name="email" type="email" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_telemovel_aluno', 'Telemóvel')} <Req />
                                    <input
                                        id="field-telemovel"
                                        name="telemovel" type="tel" inputMode="numeric" required
                                        aria-required="true"
                                        aria-describedby={liveErrors.telemovel ? 'err-telemovel' : undefined}
                                        aria-invalid={Boolean(liveErrors.telemovel)}
                                        onChange={handleLiveValidation} onBlur={handleLiveValidation}
                                        className={INPUT_CLS}
                                    />
                                    {liveErrors.telemovel ? (
                                        <p id="err-telemovel" role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">{liveErrors.telemovel}</p>
                                    ) : null}
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_telefone_aluno', 'Telefone')}
                                    <input
                                        id="field-telefone"
                                        name="telefone" type="tel" inputMode="numeric"
                                        aria-describedby={liveErrors.telefone ? 'err-telefone' : undefined}
                                        aria-invalid={Boolean(liveErrors.telefone)}
                                        onChange={handleLiveValidation} onBlur={handleLiveValidation}
                                        className={INPUT_CLS}
                                    />
                                    {liveErrors.telefone ? (
                                        <p id="err-telefone" role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">{liveErrors.telefone}</p>
                                    ) : null}
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_cc', 'Cartão de Cidadão')} <Req />
                                    <input name="cartao_cidadao" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_nif', 'NIF')} <Req />
                                    <input
                                        id="field-nif"
                                        name="nif" type="text" inputMode="numeric" required
                                        aria-required="true"
                                        aria-describedby={liveErrors.nif ? 'err-nif' : undefined}
                                        aria-invalid={Boolean(liveErrors.nif)}
                                        onChange={handleLiveValidation} onBlur={handleLiveValidation}
                                        className={INPUT_CLS}
                                    />
                                    {liveErrors.nif ? (
                                        <p id="err-nif" role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">{liveErrors.nif}</p>
                                    ) : null}
                                </label>
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_morada_aluno', 'Morada')} <Req />
                                    <input ref={alunoMoradaRef} name="morada" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_localidade_aluno', 'Localidade')} <Req />
                                    <input ref={alunoLocalidadeRef} name="localidade" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_codigo_postal_aluno', 'Código Postal')} <Req />
                                    <input
                                        id="field-codigo-postal"
                                        ref={alunoCodigoPostalRef}
                                        name="codigo_postal" type="text" inputMode="numeric" required
                                        aria-required="true"
                                        aria-describedby={liveErrors.codigo_postal ? 'err-codigo-postal' : undefined}
                                        aria-invalid={Boolean(liveErrors.codigo_postal)}
                                        onChange={handleLiveValidation} onBlur={handleLiveValidation}
                                        placeholder="3510-085" className={INPUT_CLS}
                                    />
                                    {liveErrors.codigo_postal ? (
                                        <p id="err-codigo-postal" role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">{liveErrors.codigo_postal}</p>
                                    ) : null}
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_escola', 'Escola')} <Req />
                                    <input name="escola" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_nivel_ensino', 'Nível de Ensino')} <Req />
                                    <select
                                        required name="nivel_ensino" value={selectedNivel}
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
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_ano_escolar', 'Ano Escolar')} {!isEnsinoSuperior && <Req />}
                                    <select
                                        required name="ano_escolar" value={selectedAnoEscolar}
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
                                    {selectedNivel && !loadingOpcoes ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                            {isEnsinoSuperior
                                                ? t('help_ensino_superior', 'Ensino superior não usa ano escolar neste formulário.')
                                                : t('help_anos_nivel', 'Anos apresentados conforme o nível selecionado.')}
                                        </p>
                                    ) : null}
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_turma', 'Turma')}
                                    <input name="turma" type="text" placeholder={t('placeholder_turma', 'Ex: B')} className={INPUT_CLS} />
                                </label>
                            </div>
                        </section>

                        {/* ── Encarregado de Educação ────────────────────── */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                {t('section_encarregado_heading', 'Encarregado de Educação')}
                            </h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_ee_nome', 'Nome')} <Req />
                                    <input name="ee_nome" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_ee_email', 'Email')} <Req />
                                    <input name="ee_email" type="email" required className={INPUT_CLS} />
                                </label>
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_ee_telemovel', 'Telemóvel')} <Req />
                                    <input
                                        id="field-ee-telemovel"
                                        name="ee_telemovel" type="tel" inputMode="numeric" required
                                        aria-required="true"
                                        aria-describedby={liveErrors.ee_telemovel ? 'err-ee-telemovel' : undefined}
                                        aria-invalid={Boolean(liveErrors.ee_telemovel)}
                                        onChange={handleLiveValidation} onBlur={handleLiveValidation}
                                        className={INPUT_CLS}
                                    />
                                    {liveErrors.ee_telemovel ? (
                                        <p id="err-ee-telemovel" role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">{liveErrors.ee_telemovel}</p>
                                    ) : null}
                                </label>

                                <div className="flex items-center justify-between sm:col-span-2">
                                    <span className={LABEL_CLS}>
                                        {t('label_ee_morada', 'Morada')} <Req />
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copiarMoradaAluno}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                    >
                                        {t('button_copiar_morada', 'Copiar morada do aluno')}
                                    </button>
                                </div>
                                <div className="sm:col-span-2">
                                    <input ref={eeMoradaRef} name="ee_morada" type="text" required className={INPUT_CLS} />
                                </div>
                                <label className={LABEL_CLS}>
                                    {t('label_ee_localidade', 'Localidade')} <Req />
                                    <input ref={eeLocalidadeRef} name="ee_localidade" type="text" required className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_ee_codigo_postal', 'Código Postal')} <Req />
                                    <input
                                        id="field-ee-codigo-postal"
                                        ref={eeCodigoPostalRef}
                                        name="ee_codigo_postal" type="text" inputMode="numeric" required
                                        aria-required="true"
                                        aria-describedby={liveErrors.ee_codigo_postal ? 'err-ee-codigo-postal' : undefined}
                                        aria-invalid={Boolean(liveErrors.ee_codigo_postal)}
                                        onChange={handleLiveValidation} onBlur={handleLiveValidation}
                                        className={INPUT_CLS}
                                    />
                                    {liveErrors.ee_codigo_postal ? (
                                        <p id="err-ee-codigo-postal" role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">{liveErrors.ee_codigo_postal}</p>
                                    ) : null}
                                </label>
                                <label className={`${LABEL_CLS} sm:col-span-2`}>
                                    {t('label_ee_parentesco', 'Parentesco')} <Req />
                                    <input
                                        name="ee_parentesco" type="text" required
                                        placeholder={t('placeholder_ee_parentesco', 'Ex: Mãe, Pai, Tio, Avô')}
                                        className={INPUT_CLS}
                                    />
                                </label>
                            </div>
                        </section>

                        {/* ── Plano ─────────────────────────────────────── */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">{t('section_plano_heading', 'Plano')}</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {t('section_plano_descricao', 'Pode inscrever-se em mais do que uma disciplina. Cada disciplina tem o seu próprio tipo de serviço, modalidade e pacote.')}
                            </p>

                            <div className="mt-5 space-y-4">
                                {planoItems.map((item, index) => {
                                    const podeModalidade = Boolean(item.tipoServico) && !loadingOpcoes;
                                    const isIndividual = isModalidadeIndividual(item.modalidade);
                                    const podePacote = Boolean(item.modalidade) && !isIndividual;

                                    return (
                                        <div
                                            key={item.id}
                                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-700">
                                                    {t('label_disciplina', 'Disciplina')} {index + 1}
                                                </span>
                                                {planoItems.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => removePlanoItem(item.id)}
                                                        className="text-xs font-semibold text-red-600 transition hover:text-red-800"
                                                    >
                                                        {t('button_remover', 'Remover')}
                                                    </button>
                                                ) : null}
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <label className={LABEL_CLS}>
                                                    {t('label_disciplina', 'Disciplina')} <Req />
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
                                                            {t('help_sem_disciplinas', 'Sem disciplinas para este nível.')}
                                                        </p>
                                                    ) : null}
                                                </label>

                                                <label className={LABEL_CLS}>
                                                    {t('label_tipo_servico', 'Tipo de Serviço')} <Req />
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
                                                    {t('label_modalidade', 'Modalidade')} <Req />
                                                    <select
                                                        value={item.modalidade}
                                                        onChange={(e) => updatePlanoItem(item.id, 'modalidade', e.target.value)}
                                                        disabled={!podeModalidade}
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
                                                            {t('label_pacote', 'Pacote')} {podePacote && <Req />}
                                                        </legend>
                                                        <div className="mt-2 grid gap-2">
                                                            {PACOTE_OPTIONS.map((p) => (
                                                                <label
                                                                    key={p}
                                                                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${!podePacote ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name={`pacote_${item.id}`}
                                                                        value={p}
                                                                        checked={item.pacote === p}
                                                                        onChange={() => updatePlanoItem(item.id, 'pacote', p)}
                                                                        disabled={!podePacote}
                                                                        className="h-4 w-4 border-slate-300 text-slate-700 focus:ring-slate-500"
                                                                    />
                                                                    <span>{p}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {!item.modalidade ? (
                                                            <p className="mt-2 text-xs text-slate-500">
                                                                {t('help_pacote_sem_modalidade', 'Selecione primeiro a modalidade para escolher um pacote.')}
                                                            </p>
                                                        ) : null}
                                                    </fieldset>
                                                ) : (
                                                    <p className="text-xs text-slate-500 sm:col-span-2">
                                                        {t('text_pacotes_individual', 'Pacotes não disponíveis para explicação individual.')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={addPlanoItem}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                                >
                                    {t('button_adicionar_disciplina', '+ Adicionar outra disciplina')}
                                </button>
                            </div>

                            <label className={`${LABEL_CLS} mt-5 block`}>
                                {t('label_observacoes', 'Observações')}
                                <textarea
                                    name="obs"
                                    rows={4}
                                    className={`${INPUT_CLS} resize-none`}
                                    placeholder={t('placeholder_observacoes', 'Informações relevantes sobre o aluno, objetivos ou disponibilidade.')}
                                />
                            </label>
                        </section>

                        {/* ── Autorização de Saída ───────────────────────── */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                {t('section_autorizacao_heading', 'Autorização de Saída')}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {t('section_autorizacao_descricao', 'Indique as pessoas autorizadas com que o aluno pode sair no final das atividades.')}
                            </p>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className={LABEL_CLS}>
                                    {t('label_aut_nome_1', 'Nome (1)')}
                                    <input name="aut_saida_nome_1" type="text" className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_aut_parentesco_1', 'Parentesco (1)')}
                                    <input name="aut_saida_parentesco_1" type="text" className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_aut_nome_2', 'Nome (2)')}
                                    <input name="aut_saida_nome_2" type="text" className={INPUT_CLS} />
                                </label>
                                <label className={LABEL_CLS}>
                                    {t('label_aut_parentesco_2', 'Parentesco (2)')}
                                    <input name="aut_saida_parentesco_2" type="text" className={INPUT_CLS} />
                                </label>
                            </div>

                            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <label className="flex items-start gap-3 text-sm text-slate-700">
                                    <input
                                        type="checkbox" required
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                                    />
                                    <span>
                                        {t('consent_dados_texto', 'Consinto a utilização dos dados para procedimentos de gestão e comunicação interna, incluindo contacto telefónico, SMS, email e correspondência postal.')}
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 text-sm text-slate-700">
                                    <input
                                        type="checkbox" required
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                                    />
                                    <span>
                                        Aceito e concordo com as condições de prestação de serviços e{' '}
                                        <a
                                            href="https://blocodenotas.pt/regulamento/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-800 underline hover:text-slate-600"
                                        >
                                            regulamento interno
                                        </a>
                                        .
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="mt-5 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                            >
                                {t('button_enviar', 'Enviar Inscrição')}
                            </button>

                            {sent ? (
                                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    {t('mensagem_sucesso', 'Inscrição enviada com sucesso. Aguarde a confirmação por parte do administrador.')}
                                </p>
                            ) : null}
                        </section>
                    </form>
                </section>
            </main>
        </div>
    );
}
