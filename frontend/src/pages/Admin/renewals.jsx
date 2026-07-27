import { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    RefreshCcw,
    RefreshCw,
    Search,
    ShieldAlert,
    UserX,
} from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import AdminPageHeader from '../../components/layout/AdminPageHeader';

export default function RenewalsPage() {
    const [alunos, setAlunos] = useState([]);
    const [anoLetivoAtual, setAnoLetivoAtual] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [renewingId, setRenewingId] = useState(null);
    const [suspending, setSuspending] = useState(false);

    function resetMessages() {
        setError('');
        setSuccess('');
    }

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            resetMessages();

            const response = await apiGet('/api/gestor/renovacoes/alunos-expirados');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao carregar alunos.');
            }

            setAlunos(Array.isArray(data?.alunos) ? data.alunos : []);
            setAnoLetivoAtual(data?.anoLetivoAtual || '');
        } catch (err) {
            setError(err?.message || 'Erro ao carregar alunos com matrícula por renovar.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => loadData(), 0);
        return () => clearTimeout(t);
    }, [loadData]);

    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(''), 4000);
        return () => clearTimeout(t);
    }, [success]);

    async function handleRenovar(idAluno) {
        setRenewingId(idAluno);
        resetMessages();

        try {
            const response = await apiPost(`/api/gestor/renovacoes/${idAluno}/renovar`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao renovar matrícula.');
            }

            setAlunos((prev) => prev.filter((a) => a.id_aluno !== idAluno));
            setSuccess(data?.message || 'Matrícula renovada com sucesso.');
        } catch (err) {
            setError(err?.message || 'Erro ao renovar matrícula.');
        } finally {
            setRenewingId(null);
        }
    }

    async function handleSuspenderExpirados() {
        if (
            !window.confirm(
                `Suspender as contas de todos os alunos (${filteredAlunos.length}) com matrícula por renovar?`
            )
        )
            return;

        setSuspending(true);
        resetMessages();

        try {
            const response = await apiPost('/api/gestor/renovacoes/suspender-expirados');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao suspender contas.');
            }

            setSuccess(data?.message || 'Contas suspensas.');
            await loadData();
        } catch (err) {
            setError(err?.message || 'Erro ao suspender contas.');
        } finally {
            setSuspending(false);
        }
    }

    const term = search.toLowerCase();
    const filteredAlunos = term
        ? alunos.filter((a) =>
              `${a.nome || ''} ${a.email || ''}`.toLowerCase().includes(term)
          )
        : alunos;

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Gestão de matrículas"
                title="Renovações"
                subtitle={
                    anoLetivoAtual
                        ? `Alunos que ainda não renovaram a matrícula para ${anoLetivoAtual}.`
                        : 'Alunos que ainda não renovaram a matrícula.'
                }
                icon={RefreshCcw}
                actions={
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                }
            />

            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
                Quando o aluno faz a reinscrição, a matrícula é renovada automaticamente. Use esta página apenas para
                renovar manualmente a matrícula de alunos que não fizeram a reinscrição.
            </p>

            {success ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-sm">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    {success}
                </div>
            ) : null}

            {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="relative max-w-xs flex-1">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Pesquisar por nome ou email..."
                            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                            {filteredAlunos.length}{' '}
                            {filteredAlunos.length === 1 ? 'aluno' : 'alunos'} por renovar
                        </span>
                        <button
                            type="button"
                            onClick={handleSuspenderExpirados}
                            disabled={suspending || filteredAlunos.length === 0}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <UserX size={16} />
                            Suspender todos
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-sm text-slate-500">A carregar...</div>
                ) : filteredAlunos.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-10 text-center">
                        <CheckCircle2 size={28} className="text-emerald-500" />
                        <p className="text-sm font-medium text-slate-700">
                            {alunos.length === 0
                                ? 'Todos os alunos têm a matrícula renovada.'
                                : 'Nenhum aluno corresponde à pesquisa.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-3 font-semibold">Aluno</th>
                                    <th className="px-5 py-3 font-semibold">Email</th>
                                    <th className="px-5 py-3 font-semibold">Estado da conta</th>
                                    <th className="px-5 py-3 font-semibold text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAlunos.map((aluno) => (
                                    <tr
                                        key={aluno.id_aluno}
                                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-3 font-medium text-slate-800">
                                            {aluno.nome || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">{aluno.email || '—'}</td>
                                        <td className="px-5 py-3">
                                            {aluno.status ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                    Ativa
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                                    <ShieldAlert size={12} />
                                                    Suspensa
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleRenovar(aluno.id_aluno)}
                                                disabled={renewingId === aluno.id_aluno}
                                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <RefreshCcw
                                                    size={13}
                                                    className={renewingId === aluno.id_aluno ? 'animate-spin' : ''}
                                                />
                                                {renewingId === aluno.id_aluno ? 'A renovar...' : 'Renovar matrícula'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
