import { useState } from 'react';
import {
    AlertTriangle,
    Users,
    GraduationCap,
    BookOpen,
    ClipboardList,
    FileText,
    Trash2,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { apiPost } from '../../utils/api';

const CONFIRMACAO_TEXTO = 'ELIMINAR DADOS';

const CATEGORIAS = [
    {
        id: 'alunos',
        label: 'Alunos',
        descricao:
            'Elimina todos os alunos, as suas contas de utilizador, encarregados de educação e dados pessoais. As presenças e inscrições desses alunos são também eliminadas.',
        icon: GraduationCap,
        cor: 'red',
        aviso: 'Irreversível — todos os dados dos alunos serão perdidos permanentemente.',
    },
    {
        id: 'professores',
        label: 'Professores',
        descricao:
            'Elimina todos os professores e as suas contas de utilizador e dados pessoais.',
        icon: Users,
        cor: 'red',
        aviso: 'Irreversível — todos os dados dos professores serão perdidos permanentemente.',
    },
    {
        id: 'servicos',
        label: 'Serviços',
        descricao:
            'Elimina todos os serviços curriculares e extracurriculares. As presenças e inscrições relacionadas são também eliminadas.',
        icon: BookOpen,
        cor: 'orange',
        aviso: 'Inclui todas as inscrições ativas e histórico de presenças.',
    },
    {
        id: 'inscricoes_publicas',
        label: 'Inscrições Públicas',
        descricao:
            'Elimina todos os pedidos de inscrição pública, incluindo os pendentes, aprovados e rejeitados.',
        icon: ClipboardList,
        cor: 'orange',
        aviso: 'Os pedidos de inscrição pública ainda não processados também serão eliminados.',
    },
    {
        id: 'logs',
        label: 'Registos de Auditoria',
        descricao:
            'Elimina o histórico completo de atividades e ações registadas no sistema.',
        icon: FileText,
        cor: 'yellow',
        aviso: 'O histórico de auditoria não pode ser recuperado após eliminação.',
    },
];

const COR_CLASSES = {
    red: {
        border: 'border-red-200',
        bg: 'bg-red-50',
        check: 'border-red-400 bg-red-400',
        icon: 'text-red-500',
        badge: 'bg-red-100 text-red-700',
    },
    orange: {
        border: 'border-orange-200',
        bg: 'bg-orange-50',
        check: 'border-orange-400 bg-orange-400',
        icon: 'text-orange-500',
        badge: 'bg-orange-100 text-orange-700',
    },
    yellow: {
        border: 'border-yellow-200',
        bg: 'bg-yellow-50',
        check: 'border-yellow-500 bg-yellow-500',
        icon: 'text-yellow-600',
        badge: 'bg-yellow-100 text-yellow-800',
    },
};

export default function DataCleanupSettings() {
    const [selecionadas, setSelecionadas] = useState({});
    const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

    const totalSelecionadas = Object.values(selecionadas).filter(Boolean).length;
    const confirmacaoValida = confirmacaoTexto.trim() === CONFIRMACAO_TEXTO;
    const podeEliminar = totalSelecionadas > 0 && confirmacaoValida && !loading;

    function toggleCategoria(id) {
        setSelecionadas((prev) => ({ ...prev, [id]: !prev[id] }));
        setResultado(null);
    }

    async function handleEliminar() {
        if (!podeEliminar) return;

        setLoading(true);
        setResultado(null);

        try {
            const response = await apiPost('/api/gestor/dados/limpar', {
                confirmacao: CONFIRMACAO_TEXTO,
                opcoes: selecionadas,
            });
            const data = await response.json();

            if (!response.ok) {
                setResultado({ tipo: 'erro', mensagem: data.message || 'Erro ao realizar a limpeza.' });
                return;
            }

            setResultado({ tipo: 'sucesso', mensagem: data.message, contagens: data.contagens });
            setSelecionadas({});
            setConfirmacaoTexto('');
        } catch {
            setResultado({ tipo: 'erro', mensagem: 'Não foi possível comunicar com o servidor.' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            {/* Cabeçalho */}
            <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                    Limpeza de Dados em Massa
                </h2>
                <p className="text-base text-slate-600">
                    Elimine categorias completas de dados do sistema. As contas de administrador nunca são afetadas.
                </p>
            </div>

            {/* Aviso principal */}
            <div className="flex gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold text-red-800 text-sm">Ação irreversível</p>
                    <p className="text-red-700 text-sm mt-0.5">
                        Os dados eliminados não podem ser recuperados. Certifique-se de que tem uma cópia de segurança
                        da base de dados antes de prosseguir.
                    </p>
                </div>
            </div>

            {/* Resultado da operação */}
            {resultado && (
                <div
                    className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${
                        resultado.tipo === 'sucesso'
                            ? 'bg-green-50 border-green-500'
                            : 'bg-red-50 border-red-500'
                    }`}
                >
                    {resultado.tipo === 'sucesso' ? (
                        <CheckCircle size={22} className="text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <XCircle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p
                            className={`font-semibold text-sm ${
                                resultado.tipo === 'sucesso' ? 'text-green-800' : 'text-red-800'
                            }`}
                        >
                            {resultado.mensagem}
                        </p>
                        {resultado.contagens && (
                            <div className="mt-2">
                                <button
                                    onClick={() => setMostrarDetalhes((v) => !v)}
                                    className="flex items-center gap-1 text-xs text-green-700 hover:underline"
                                >
                                    {mostrarDetalhes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {mostrarDetalhes ? 'Ocultar detalhes' : 'Ver detalhes'}
                                </button>
                                {mostrarDetalhes && (
                                    <ul className="mt-2 space-y-1">
                                        {Object.entries(resultado.contagens).map(([chave, valor]) => (
                                            <li key={chave} className="text-xs text-green-700">
                                                <span className="font-medium capitalize">{chave.replace(/_/g, ' ')}</span>:{' '}
                                                {valor} registo{valor !== 1 ? 's' : ''} eliminado{valor !== 1 ? 's' : ''}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Seleção de categorias */}
            <div>
                <h3 className="font-semibold text-slate-800 mb-4">
                    1. Selecione as categorias a eliminar
                </h3>
                <div className="space-y-3">
                    {CATEGORIAS.map((cat) => {
                        const Icon = cat.icon;
                        const cores = COR_CLASSES[cat.cor];
                        const ativa = !!selecionadas[cat.id];

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => toggleCategoria(cat.id)}
                                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                    ativa
                                        ? `${cores.border} ${cores.bg}`
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Checkbox visual */}
                                    <div
                                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                            ativa ? cores.check : 'border-slate-300'
                                        }`}
                                    >
                                        {ativa && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                                <path
                                                    d="M2 6l3 3 5-5"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </div>

                                    <Icon size={20} className={`flex-shrink-0 mt-0.5 ${cores.icon}`} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800">{cat.label}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1">{cat.descricao}</p>
                                        {ativa && (
                                            <p className={`text-xs mt-2 font-medium ${cores.icon}`}>
                                                ⚠ {cat.aviso}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Confirmação por texto */}
            {totalSelecionadas > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-slate-800">
                        2. Confirme a operação
                    </h3>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                        <p className="text-sm text-slate-700">
                            Vai eliminar{' '}
                            <strong>
                                {totalSelecionadas} categoria{totalSelecionadas > 1 ? 's' : ''}
                            </strong>{' '}
                            de dados. Para confirmar, escreva exatamente o seguinte no campo abaixo:
                        </p>
                        <p className="font-mono font-bold text-red-700 text-sm bg-red-50 px-3 py-2 rounded border border-red-200 inline-block">
                            {CONFIRMACAO_TEXTO}
                        </p>
                        <input
                            type="text"
                            value={confirmacaoTexto}
                            onChange={(e) => setConfirmacaoTexto(e.target.value)}
                            placeholder={`Escreva "${CONFIRMACAO_TEXTO}"`}
                            className={`w-full px-4 py-3 text-base rounded-lg border font-mono transition focus:outline-none focus:ring-2 ${
                                confirmacaoTexto.length > 0 && !confirmacaoValida
                                    ? 'border-red-300 focus:ring-red-400/40'
                                    : confirmacaoValida
                                    ? 'border-green-400 focus:ring-green-400/40'
                                    : 'border-slate-300 focus:ring-[#06b6d4]/40'
                            }`}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>

                    <button
                        onClick={handleEliminar}
                        disabled={!podeEliminar}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-base transition ${
                            podeEliminar
                                ? 'bg-red-600 hover:bg-red-700 cursor-pointer'
                                : 'bg-slate-300 cursor-not-allowed'
                        }`}
                    >
                        <Trash2 size={20} />
                        {loading ? 'A eliminar...' : `Eliminar ${totalSelecionadas} categoria${totalSelecionadas > 1 ? 's' : ''}`}
                    </button>
                </div>
            )}
        </div>
    );
}
