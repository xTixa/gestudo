import { useEffect, useState } from 'react';
import PublicNavbar from '../../components/infos/PublicNavbar';
import PublicFooter from '../../components/infos/PublicFooter';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASES = Array.from(
    new Set([API_URL, ''].map((base) => String(base || '').trim()))
).filter((base) => base !== '');

const PACOTE_OPTIONS = ['6h/mês', '8h/mês', '12h/mês'];

const ANO_ESCOLAR_OPTIONS = [
    '1º Ano',
    '2º Ano',
    '3º Ano',
    '4º Ano',
    '5º Ano',
    '6º Ano',
    '7º Ano',
    '8º Ano',
    '9º Ano',
    '10º Ano',
    '11º Ano',
    '12º Ano',
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
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getAnosEscolaresPorNivel(nivel) {
    const nivelNormalizado = normalizeText(
        nivel?.key || nivel?.label || nivel?.value
    );

    if (!nivelNormalizado) {
        return [];
    }

    if (nivelNormalizado.includes('superior')) {
        return [];
    }

    for (const [key, anos] of Object.entries(ANOS_ESCOLARES_POR_NIVEL)) {
        if (nivelNormalizado.includes(key)) {
            return anos;
        }
    }

    return ANO_ESCOLAR_OPTIONS;
}

function buildApiUrl(base, path) {
    const normalizedPath = String(path || '').startsWith('/')
        ? path
        : `/${path}`;
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

export default function InfosInscricaoPage() {
    const [sent, setSent] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [disciplinasOptions, setDisciplinasOptions] = useState([]);
    const [niveisEnsinoOptions, setNiveisEnsinoOptions] = useState([]);
    const [modalidadesOptions, setModalidadesOptions] = useState([]);
    const [tipoServicoSelecionadoOptions, setTipoServicoSelecionadoOptions] =
        useState([]);
    const [selectedNivel, setSelectedNivel] = useState('');
    const [selectedAnoEscolar, setSelectedAnoEscolar] = useState('');
    const [selectedModalidade, setSelectedModalidade] = useState('');
    const [selectedPacote, setSelectedPacote] = useState('');
    const [selectedTipoServico, setSelectedTipoServico] = useState('');
    const [loadingOpcoes, setLoadingOpcoes] = useState(true);
    const [erroOpcoes, setErroOpcoes] = useState('');
    const [liveErrors, setLiveErrors] = useState({});

    useEffect(() => {
        let isMounted = true;

        async function carregarOpcoes() {
            setLoadingOpcoes(true);
            setErroOpcoes('');

            try {
                const response = await fetchWithFallback(
                    '/api/public/inscricao-opcoes'
                );

                if (!response.ok) {
                    throw new Error('Falha ao carregar opções.');
                }

                const data = await response.json();

                if (!isMounted) {
                    return;
                }

                setDisciplinasOptions(
                    Array.isArray(data?.disciplinas)
                        ? data.disciplinas.filter((item) => item?.label)
                        : []
                );
                setNiveisEnsinoOptions(
                    Array.isArray(data?.niveisEnsino)
                        ? data.niveisEnsino.filter((item) => item?.label)
                        : []
                );
                setModalidadesOptions(
                    Array.isArray(data?.modalidades)
                        ? data.modalidades.filter((item) => item?.label)
                        : []
                );
                setTipoServicoSelecionadoOptions(
                    Array.isArray(data?.tiposServico)
                        ? data.tiposServico.filter((item) => item?.label)
                        : Array.isArray(data?.tipoServico)
                          ? data.tipoServico.filter((item) => item?.label)
                          : []
                );
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setErroOpcoes(
                    error?.message ||
                        'Não foi possível carregar disciplinas, níveis, modalidades e tipos de serviço da base de dados.'
                );
            } finally {
                if (isMounted) {
                    setLoadingOpcoes(false);
                }
            }
        }

        carregarOpcoes();

        return () => {
            isMounted = false;
        };
    }, []);

    const disciplinasFiltradas = disciplinasOptions.filter((item) => {
        if (!selectedNivel) {
            return false;
        }

        const nivelSelecionado = niveisEnsinoOptions.find(
            (nivel) => String(nivel.id) === selectedNivel
        );
        const selectedKey =
            nivelSelecionado?.key || normalizeText(nivelSelecionado?.label);
        const matchesId =
            item.nivelRef && String(item.nivelRef) === String(selectedNivel);
        const matchesKey = item.nivelRefKey && item.nivelRefKey === selectedKey;

        return matchesId || matchesKey;
    });

    const nivelSelecionado = niveisEnsinoOptions.find(
        (nivel) => String(nivel.id) === selectedNivel
    );
    const anosEscolaresOptions = getAnosEscolaresPorNivel(nivelSelecionado);
    const isEnsinoSuperior = normalizeText(
        nivelSelecionado?.key ||
            nivelSelecionado?.label ||
            nivelSelecionado?.value
    ).includes('superior');

    const tipoServicoSelecionado =
        tipoServicoSelecionadoOptions.find(
            (item) => String(item.id) === selectedTipoServico
        )?.label ||
        tipoServicoSelecionadoOptions.find(
            (item) => String(item.id) === selectedTipoServico
        )?.value ||
        '';

    const modalidadeSelecionada = modalidadesOptions.find(
        (item) => String(item.id) === selectedModalidade
    );
    const modalidadeSelecionadaNormalizada = normalizeText(
        modalidadeSelecionada?.label || modalidadeSelecionada?.value
    );
    const podeEscolherModalidade =
        Boolean(selectedTipoServico) && !loadingOpcoes;
    const isExplicacoesIndividuais =
        modalidadeSelecionadaNormalizada.includes('individu') ||
        modalidadeSelecionadaNormalizada.includes('explicacao_individual');
    const podeEscolherPacote =
        Boolean(selectedModalidade) && !isExplicacoesIndividuais;

    useEffect(() => {
        if (
            selectedAnoEscolar &&
            (!anosEscolaresOptions.includes(selectedAnoEscolar) ||
                isEnsinoSuperior)
        ) {
            setSelectedAnoEscolar('');
        }
    }, [anosEscolaresOptions, isEnsinoSuperior, selectedAnoEscolar]);

    useEffect(() => {
        if (isExplicacoesIndividuais && selectedPacote) {
            setSelectedPacote('');
        }
    }, [isExplicacoesIndividuais, selectedPacote]);

    function validarFormulario(formData) {
        const requiredFields = [
            'data_inicio',
            'nome_completo',
            'data_nascimento',
            'email',
            'telemovel',
            'telefone',
            'cartao_cidadao',
            'nif',
            'morada',
            'localidade',
            'codigo_postal',
            'escola',
            ...(isEnsinoSuperior ? [] : ['ano_escolar']),
            'turma',
            'ee_nome',
            'ee_nif',
            'ee_email',
            'ee_telemovel',
            'ee_telefone',
            'ee_morada',
            'ee_localidade',
            'ee_codigo_postal',
            'ee_parentesco',
            'nivel_ensino',
            'tipo_servico',
            'disciplina',
            'modalidade',
        ];

        for (const field of requiredFields) {
            if (!String(formData.get(field) || '').trim()) {
                return 'Preencha todos os campos obrigatórios.';
            }
        }

        if (
            !isExplicacoesIndividuais &&
            !String(formData.get('pacote') || '').trim()
        ) {
            return 'Selecione um pacote para a modalidade escolhida.';
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
            String(formData.get('telefone') || '').trim(),
            String(formData.get('ee_telemovel') || '').trim(),
            String(formData.get('ee_telefone') || '').trim(),
        ];
        if (phones.some((value) => !phoneRegex.test(value))) {
            return 'Telefone/telemovel inválido. Deve conter 9 digitos.';
        }

        const nifAluno = String(formData.get('nif') || '').trim();
        const nifEe = String(formData.get('ee_nif') || '').trim();
        if (!nifRegex.test(nifAluno) || !nifRegex.test(nifEe)) {
            return 'NIF inválido. Deve conter 9 digitos.';
        }

        return '';
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitError('');
        setSent(false);

        const formElement = event.currentTarget;
        const formData = new FormData(formElement);
        const validationError = validarFormulario(formData);

        if (validationError) {
            setSent(false);
            setSubmitError(validationError);
            return;
        }

        try {
            const payload = Object.fromEntries(formData.entries());
            const response = await fetchWithFallback('/api/public/inscricao', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data?.detail
                        ? `${data?.message || 'Erro ao enviar inscrição.'} (${data.detail})`
                        : data?.message ||
                              'Não foi possível enviar a inscrição.'
                );
            }

            setSent(true);
            if (formElement) {
                formElement.reset();
            }
            setSelectedNivel('');
            setSelectedAnoEscolar('');
            setSelectedModalidade('');
            setSelectedPacote('');
            setSelectedTipoServico('');
            setLiveErrors({});
        } catch (error) {
            setSubmitError(
                error?.message || 'Não foi possível enviar a inscrição.'
            );
        }
    }

    function getLiveFieldError(name, value) {
        const rawValue = String(value || '').trim();

        if (!rawValue) {
            return '';
        }

        if (name === 'nif' || name === 'ee_nif') {
            const digits = rawValue.replace(/\D/g, '');
            if (digits.length !== 9) {
                return 'NIF deve conter 9 digitos.';
            }
        }

        if (
            name === 'telemovel' ||
            name === 'telefone' ||
            name === 'ee_telemovel' ||
            name === 'ee_telefone'
        ) {
            const digits = rawValue.replace(/\D/g, '');
            if (digits.length !== 9) {
                return 'Número deve conter 9 digitos.';
            }
        }

        if (name === 'codigo_postal' || name === 'ee_codigo_postal') {
            if (!/^\d{4}-\d{3}$/.test(rawValue)) {
                return 'Formato inválido (0000-000).';
            }
        }

        return '';
    }

    function handleLiveValidation(event) {
        const { name } = event.target;
        let { value } = event.target;

        if (name === 'nif' || name === 'ee_nif') {
            value = value.replace(/\D/g, '').slice(0, 9);
        }

        if (
            name === 'telemovel' ||
            name === 'telefone' ||
            name === 'ee_telemovel' ||
            name === 'ee_telefone'
        ) {
            value = value.replace(/\D/g, '').slice(0, 9);
        }

        if (name === 'codigo_postal' || name === 'ee_codigo_postal') {
            const digits = value.replace(/\D/g, '').slice(0, 7);
            value =
                digits.length > 4
                    ? `${digits.slice(0, 4)}-${digits.slice(4)}`
                    : digits;
        }

        event.target.value = value;
        const errorMessage = getLiveFieldError(name, value);

        setLiveErrors((prev) => ({
            ...prev,
            [name]: errorMessage,
        }));
    }

    function handleModalidadeChange(event) {
        const modalidadeId = event.target.value;
        setSelectedModalidade(modalidadeId);

        const modalidade = modalidadesOptions.find(
            (item) => String(item.id) === modalidadeId
        );
        const modalidadeNormalizada = normalizeText(
            modalidade?.label || modalidade?.value
        );
        const modalidadeIndividual =
            modalidadeNormalizada.includes('individu') ||
            modalidadeNormalizada.includes('explicacao_individual');

        if (modalidadeIndividual) {
            setSelectedPacote('');
        }
    }

    function handleTipoServicoChange(event) {
        setSelectedTipoServico(event.target.value);
        setSelectedModalidade('');
        setSelectedPacote('');
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <PublicNavbar />

            <main>
                <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white">
                    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
                            Inscrições
                        </p>
                        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
                            Formulário de Inscrição 2025/2026
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm text-slate-200 sm:text-base">
                            Preencha os dados do aluno e do encarregado de
                            educação.
                        </p>
                    </div>
                </section>

                <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-5"
                        noValidate
                    >
                        {erroOpcoes ? (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {erroOpcoes}
                            </p>
                        ) : null}
                        {submitError ? (
                            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {submitError}
                            </p>
                        ) : null}

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                Dados do Aluno
                            </h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Data de Início
                                    <input
                                        name="data_inicio"
                                        type="date"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Nome Completo
                                    <input
                                        name="nome_completo"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Data de Nascimento
                                    <input
                                        name="data_nascimento"
                                        type="date"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Email
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Telemóvel
                                    <input
                                        name="telemovel"
                                        type="tel"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.telemovel ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.telemovel}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Telefone
                                    <input
                                        name="telefone"
                                        type="tel"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.telefone ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.telefone}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Cartão de Cidadão
                                    <input
                                        name="cartao_cidadao"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    NIF
                                    <input
                                        name="nif"
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.nif ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.nif}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Morada
                                    <input
                                        name="morada"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Localidade
                                    <input
                                        name="localidade"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Código Postal
                                    <input
                                        name="codigo_postal"
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                        placeholder="3510-085"
                                    />
                                    {liveErrors.codigo_postal ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.codigo_postal}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Escola
                                    <input
                                        name="escola"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Nível de Ensino
                                    <select
                                        required
                                        name="nivel_ensino"
                                        value={selectedNivel}
                                        onChange={(event) =>
                                            setSelectedNivel(event.target.value)
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    >
                                        <option value="">Selecionar</option>
                                        {loadingOpcoes ? (
                                            <option value="">
                                                A carregar...
                                            </option>
                                        ) : null}
                                        {niveisEnsinoOptions.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Ano Escolar
                                    <select
                                        required
                                        name="ano_escolar"
                                        value={selectedAnoEscolar}
                                        onChange={(event) =>
                                            setSelectedAnoEscolar(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            !selectedNivel ||
                                            loadingOpcoes ||
                                            isEnsinoSuperior
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    >
                                        <option value="">
                                            {!selectedNivel
                                                ? 'Selecione primeiro o nível'
                                                : isEnsinoSuperior
                                                  ? 'Não aplicável'
                                                  : 'Selecionar'}
                                        </option>
                                        {!isEnsinoSuperior
                                            ? anosEscolaresOptions.map(
                                                  (ano) => (
                                                      <option
                                                          key={ano}
                                                          value={ano}
                                                      >
                                                          {ano}
                                                      </option>
                                                  )
                                              )
                                            : null}
                                    </select>
                                    {selectedNivel && !loadingOpcoes ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                            {isEnsinoSuperior
                                                ? 'Ensino superior não usa ano escolar neste formulário.'
                                                : 'Anos apresentados conforme o nível selecionado.'}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Turma
                                    <input
                                        name="turma"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                        placeholder="Ex: B"
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                Encarregado de Educação
                            </h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Nome
                                    <input
                                        name="ee_nome"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    NIF
                                    <input
                                        name="ee_nif"
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.ee_nif ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.ee_nif}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Email
                                    <input
                                        name="ee_email"
                                        type="email"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Telemóvel
                                    <input
                                        name="ee_telemovel"
                                        type="tel"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.ee_telemovel ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.ee_telemovel}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Telefone
                                    <input
                                        name="ee_telefone"
                                        type="tel"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.ee_telefone ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.ee_telefone}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Morada
                                    <input
                                        name="ee_morada"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Localidade
                                    <input
                                        name="ee_localidade"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Código Postal
                                    <input
                                        name="ee_codigo_postal"
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        onChange={handleLiveValidation}
                                        onBlur={handleLiveValidation}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                    {liveErrors.ee_codigo_postal ? (
                                        <p className="mt-1 text-xs text-red-600">
                                            {liveErrors.ee_codigo_postal}
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Parentesco
                                    <input
                                        name="ee_parentesco"
                                        type="text"
                                        required
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                        placeholder="Ex: Mae, Pai, Tio, Avô"
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                Plano
                            </h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Disciplina Pretendida
                                    <select
                                        required
                                        name="disciplina"
                                        disabled={
                                            !selectedNivel || loadingOpcoes
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    >
                                        <option value="">
                                            {!selectedNivel
                                                ? 'Selecione primeiro o nível'
                                                : 'Selecionar'}
                                        </option>
                                        {disciplinasFiltradas.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedNivel &&
                                    !loadingOpcoes &&
                                    disciplinasFiltradas.length === 0 ? (
                                        <p className="mt-1 text-xs text-amber-600">
                                            Sem disciplinas associadas para este
                                            nível.
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Tipo de Serviço
                                    <select
                                        required
                                        name="tipo_servico"
                                        value={selectedTipoServico}
                                        onChange={handleTipoServicoChange}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    >
                                        <option value="">Selecionar</option>
                                        {loadingOpcoes ? (
                                            <option value="">
                                                A carregar...
                                            </option>
                                        ) : null}
                                        {tipoServicoSelecionadoOptions.map(
                                            (item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.label || item.value}
                                                </option>
                                            )
                                        )}
                                    </select>
                                    {tipoServicoSelecionado ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                            Tipo de serviço selecionado:{' '}
                                            {tipoServicoSelecionado}.
                                        </p>
                                    ) : null}
                                </label>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Modalidade
                                    <select
                                        required
                                        name="modalidade"
                                        value={selectedModalidade}
                                        onChange={handleModalidadeChange}
                                        disabled={!podeEscolherModalidade}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    >
                                        <option value="">
                                            {!selectedTipoServico
                                                ? 'Selecione primeiro o tipo de serviço'
                                                : 'Selecionar'}
                                        </option>
                                        {loadingOpcoes ? (
                                            <option value="">
                                                A carregar...
                                            </option>
                                        ) : null}
                                        {modalidadesOptions.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                    {!selectedTipoServico ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                            Escolha primeiro o tipo de serviço
                                            para avançar para a modalidade.
                                        </p>
                                    ) : null}
                                    {isExplicacoesIndividuais ? (
                                        <p className="mt-1 text-xs text-blue-700">
                                            Modalidade individual selecionada:
                                            preco fixo de 20EUR/h.
                                        </p>
                                    ) : null}
                                </label>
                                <fieldset
                                    className="sm:col-span-2"
                                    disabled={!podeEscolherPacote}
                                >
                                    <legend className="text-sm font-semibold text-slate-700">
                                        Pacote Pretendido
                                    </legend>
                                    <div className="mt-2 grid gap-2">
                                        {PACOTE_OPTIONS.map((item) => (
                                            <label
                                                key={item}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${!podeEscolherPacote ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="pacote"
                                                    value={item}
                                                    checked={
                                                        selectedPacote === item
                                                    }
                                                    onChange={(event) => {
                                                        if (
                                                            !podeEscolherPacote
                                                        ) {
                                                            return;
                                                        }

                                                        setSelectedPacote(
                                                            event.target.value
                                                        );
                                                    }}
                                                    required={
                                                        podeEscolherPacote
                                                    }
                                                    disabled={
                                                        !podeEscolherPacote
                                                    }
                                                    className="h-4 w-4 border-slate-300 text-slate-700 focus:ring-slate-500"
                                                />
                                                <span>{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {isExplicacoesIndividuais ? (
                                        <p className="mt-2 text-xs text-slate-500">
                                            Pacotes indisponiveis para
                                            explicacao individual.
                                        </p>
                                    ) : !selectedModalidade ? (
                                        <p className="mt-2 text-xs text-slate-500">
                                            Selecione primeiro a modalidade para
                                            escolher um pacote.
                                        </p>
                                    ) : null}
                                </fieldset>
                                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                                    Observações
                                    <textarea
                                        name="obs"
                                        rows={4}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                        placeholder="Informacoes relevantes sobre o aluno, objetivos ou disponibilidade."
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                                Autorização de Saída
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Indique as pessoas autorizadas com que o aluno
                                pode sair no final das atividades.
                            </p>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Nome (1)
                                    <input
                                        name="aut_saida_nome_1"
                                        type="text"
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Parentesco (1)
                                    <input
                                        name="aut_saida_parentesco_1"
                                        type="text"
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Nome (2)
                                    <input
                                        name="aut_saida_nome_2"
                                        type="text"
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                    Parentesco (2)
                                    <input
                                        name="aut_saida_parentesco_2"
                                        type="text"
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                    />
                                </label>
                            </div>

                            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <label className="flex items-start gap-3 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        required
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                                    />
                                    <span>
                                        Consinto a utilização dos dados para
                                        procedimentos de gestão e comunicação
                                        interna, incluindo contacto telefónico,
                                        SMS, email e correspondência postal.
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        required
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                                    />
                                    <span>
                                        Aceito e concordo com as condições de
                                        prestação de serviços e regulamento
                                        interno.
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="mt-5 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                            >
                                Enviar Inscrição
                            </button>

                            {sent ? (
                                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    Inscrição enviada com sucesso. Aguarde a
                                    confirmação por parte do administrador.
                                </p>
                            ) : null}
                        </section>
                    </form>
                </section>
            </main>

            <PublicFooter />
        </div>
    );
}
