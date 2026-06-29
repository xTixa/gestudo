import { useEffect, useState } from 'react';
import {
    GraduationCap,
    Calendar,
    Loader2,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    RefreshCcw,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';

const CONFIRMACAO_TEXTO = 'ENCERRAR ANO';

export default function AcademicYearSettings() {
    const [anoLetivo, setAnoLetivo] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [encerrarOpcoes, setEncerrarOpcoes] = useState({ inscricoes: true, servicos: false });
    const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

    const confirmacaoValida = confirmacaoTexto.trim() === CONFIRMACAO_TEXTO;

    useEffect(() => {
        let isMounted = true;
        async function carregar() {
            setLoading(true);
            try {
                const response = await apiGet('/api/gestor/ano-letivo');
                const data = await response.json();
                if (response.ok && isMounted) {
                    setAnoLetivo(data.anoLetivo);
                    setStats(data.stats);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        carregar();
        return () => { isMounted = false; };
    }, [resultado]);

    async function handleEncerrar() {
        if (!confirmacaoValida || submitting) return;
        setSubmitting(true);
        setResultado(null);
        try {
            const response = await apiPost('/api/gestor/ano-letivo/encerrar', {
                confirmacao: CONFIRMACAO_TEXTO,
                opcoes: encerrarOpcoes,
            });
            const data = await response.json();
            if (!response.ok) {
                setResultado({ tipo: 'erro', mensagem: data.message || 'Erro ao encerrar ano lectivo.' });
                return;
            }
            setResultado({ tipo: 'sucesso', mensagem: data.message, contagens: data.contagens });
            setConfirmacaoTexto('');
        } catch {
            setResultado({ tipo: 'erro', mensagem: 'Não foi possível comunicar com o servidor.' });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">Gestão do Ano Lectivo</h2>
                <p className="text-base text-slate-600">
                    Consulte o ano lectivo actual e efectue o encerramento no final do ano.
                </p>
            </div>

            {/* Ano actual */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 rounded-xl bg-blue-100">
                        <Calendar size={22} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Ano Lectivo Actual</p>
                        {loading ? (
                            <div className="h-8 w-32 animate-pulse rounded bg-slate-200 mt-1" />
                        ) : (
                            <p className="text-3xl font-bold text-slate-800">{anoLetivo || '---/---'}</p>
                        )}
                    </div>
                </div>

                {stats && !loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Alunos activos', value: stats.alunosAtivos },
                            { label: 'Professores activos', value: stats.professoresAtivos },
                            { label: 'Inscrições activas', value: stats.inscricoesAtivas },
                            { label: 'Serviços curriculares', value: stats.servicosCurricularesAtivos },
                            { label: 'Serviços extra-curriculares', value: stats.servicosExtraAtivos },
                            { label: 'Matrículas por renovar', value: stats.matriculasPorRenovar, alert: stats.matriculasPorRenovar > 0 },
                        ].map(({ label, value, alert }) => (
                            <div
                                key={label}
                                className={`rounded-xl border p-4 ${alert ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}
                            >
                                <p className="text-xs text-slate-500 font-medium">{label}</p>
                                <p className={`text-2xl font-bold mt-1 ${alert ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Loader2 size={16} className="animate-spin" /> A carregar estatísticas...
                    </div>
                )}
            </div>

            {/* Resultado */}
            {resultado && (
                <div className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${resultado.tipo === 'sucesso' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    {resultado.tipo === 'sucesso'
                        ? <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                        : <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                        <p className={`font-semibold text-sm ${resultado.tipo === 'sucesso' ? 'text-green-800' : 'text-red-800'}`}>
                            {resultado.mensagem}
                        </p>
                        {resultado.contagens && (
                            <div className="mt-2">
                                <button
                                    onClick={() => setMostrarDetalhes((v) => !v)}
                                    className="flex items-center gap-1 text-xs text-green-700 hover:underline"
                                >
                                    {mostrarDetalhes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    {mostrarDetalhes ? 'Ocultar' : 'Ver detalhes'}
                                </button>
                                {mostrarDetalhes && (
                                    <ul className="mt-1.5 space-y-1">
                                        {Object.entries(resultado.contagens).map(([k, v]) => (
                                            <li key={k} className="text-xs text-green-700">
                                                <span className="font-medium capitalize">{k.replace(/_/g, ' ')}</span>: {v}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Encerrar ano */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <RefreshCcw size={18} className="text-amber-500" />
                        Encerrar Ano Lectivo
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                        Arquiva os dados do ano actual para preparar o início do próximo ano lectivo.
                    </p>
                </div>

                <div className="flex gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        Esta operação encerra inscrições e/ou desactiva serviços. Poderá reverter manualmente mais tarde se necessário.
                    </p>
                </div>

                {/* Opções */}
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-700">Selecione o que pretende encerrar:</p>
                    {[
                        { key: 'inscricoes', label: 'Encerrar todas as inscrições activas', desc: 'Muda o estado de todas as inscrições de "ativa" para "encerrada".' },
                        { key: 'servicos', label: 'Desactivar todos os serviços activos', desc: 'Marca todos os serviços curriculares e extra-curriculares como inactivos.' },
                    ].map(({ key, label, desc }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setEncerrarOpcoes((p) => ({ ...p, [key]: !p[key] }))}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                encerrarOpcoes[key] ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${encerrarOpcoes[key] ? 'border-amber-400 bg-amber-400' : 'border-slate-300'}`}>
                                    {encerrarOpcoes[key] && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Confirmação */}
                {(encerrarOpcoes.inscricoes || encerrarOpcoes.servicos) && (
                    <div className="space-y-3 border-t border-slate-100 pt-5">
                        <p className="text-sm text-slate-700">
                            Para confirmar, escreva exactamente o seguinte:
                        </p>
                        <p className="font-mono font-bold text-amber-700 text-sm bg-amber-50 px-3 py-2 rounded border border-amber-200 inline-block">
                            {CONFIRMACAO_TEXTO}
                        </p>
                        <input
                            type="text"
                            value={confirmacaoTexto}
                            onChange={(e) => setConfirmacaoTexto(e.target.value)}
                            placeholder={`Escreva "${CONFIRMACAO_TEXTO}"`}
                            autoComplete="off"
                            spellCheck={false}
                            className={`w-full px-4 py-3 text-base rounded-lg border font-mono transition focus:outline-none focus:ring-2 ${
                                confirmacaoTexto.length > 0 && !confirmacaoValida
                                    ? 'border-red-300 focus:ring-red-400/40'
                                    : confirmacaoValida
                                    ? 'border-green-400 focus:ring-green-400/40'
                                    : 'border-slate-300 focus:ring-amber-400/40'
                            }`}
                        />
                        <button
                            onClick={handleEncerrar}
                            disabled={!confirmacaoValida || submitting}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-base transition ${
                                confirmacaoValida && !submitting
                                    ? 'bg-amber-500 hover:bg-amber-600 cursor-pointer'
                                    : 'bg-slate-300 cursor-not-allowed'
                            }`}
                        >
                            <GraduationCap size={20} />
                            {submitting ? 'A processar...' : 'Encerrar Ano Lectivo'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
