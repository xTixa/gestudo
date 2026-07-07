import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardEdit, X } from 'lucide-react';
import AdminPageHeader from '../../components/layout/AdminPageHeader';
import { apiGet, apiPost } from '../../utils/api';

const FIELD_LABELS = {
    nome: 'Nome',
    data_nasc: 'Data de nascimento',
    cc: 'Cartão de cidadão',
    nif: 'NIF',
    morada: 'Morada',
    localidade: 'Localidade',
    cod_postal: 'Código postal',
    telemovel: 'Telemóvel',
    telefone: 'Telefone',
    email: 'Email',
    imagem_perfil_url: 'Foto de perfil',
    escola: 'Escola',
    ano: 'Ano',
    turma: 'Turma',
    encarregado_nome: 'Nome do encarregado',
    encarregado_parentesco: 'Parentesco',
    encarregado_morada: 'Morada do encarregado',
    encarregado_localidade: 'Localidade do encarregado',
    encarregado_cod_postal: 'Código postal do encarregado',
    encarregado_telemovel: 'Telemóvel do encarregado',
    encarregado_telefone: 'Telefone do encarregado',
    encarregado_email: 'Email do encarregado',
};

function flattenAnterior(dadosAnteriores) {
    const pessoa = dadosAnteriores?.pessoa || {};
    const user = pessoa?.user || {};
    const encarregado = dadosAnteriores?.encarregado || {};
    const encarregadoPessoa = encarregado?.pessoa || {};

    return {
        nome: pessoa.nome,
        data_nasc: pessoa.data_nasc,
        cc: pessoa.cc,
        nif: pessoa.nif,
        morada: pessoa.morada,
        localidade: pessoa.localidade,
        cod_postal: pessoa.cod_postal,
        telemovel: pessoa.telemovel,
        telefone: pessoa.telefone,
        email: user.email,
        imagem_perfil_url: user.imagem_perfil_url,
        escola: dadosAnteriores?.escola,
        ano: dadosAnteriores?.ano,
        turma: dadosAnteriores?.turma,
        encarregado_nome: encarregadoPessoa.nome,
        encarregado_parentesco: encarregado.parentesco,
        encarregado_morada: encarregadoPessoa.morada,
        encarregado_localidade: encarregadoPessoa.localidade,
        encarregado_cod_postal: encarregadoPessoa.cod_postal,
        encarregado_telemovel: encarregadoPessoa.telemovel,
        encarregado_telefone: encarregadoPessoa.telefone,
        encarregado_email: encarregadoPessoa?.user?.email,
    };
}

function formatValue(field, value) {
    if (field === 'imagem_perfil_url') {
        return value ? 'Nova foto carregada' : '-';
    }
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    if (field === 'data_nasc') {
        return String(value).slice(0, 10);
    }
    return String(value);
}

export default function PendingProfileChangesPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [processingId, setProcessingId] = useState(null);

    const carregar = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await apiGet('/api/gestor/alteracoes-pendentes');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Erro ao carregar alterações pendentes.'
                );
            }

            setItems(Array.isArray(data?.alteracoes) ? data.alteracoes : []);
        } catch (fetchError) {
            setError(
                fetchError?.message || 'Erro ao carregar alterações pendentes.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    async function aprovar(item) {
        const confirmed = window.confirm(
            `Aprovar as alterações propostas por ${item.aluno_nome}?`
        );
        if (!confirmed) return;

        setProcessingId(item.id_alteracao);
        setError('');
        setSuccess('');

        try {
            const response = await apiPost(
                `/api/gestor/alteracoes-pendentes/${item.id_alteracao}/aprovar`,
                {}
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Não foi possível aprovar a alteração.'
                );
            }

            setSuccess(`Alterações de ${item.aluno_nome} aprovadas.`);
            await carregar();
        } catch (approveError) {
            setError(approveError?.message || 'Erro ao aprovar alteração.');
        } finally {
            setProcessingId(null);
        }
    }

    async function rejeitar(item) {
        const motivo = window.prompt(
            `Motivo da rejeição das alterações de ${item.aluno_nome} (opcional):`,
            ''
        );
        if (motivo === null) return;

        setProcessingId(item.id_alteracao);
        setError('');
        setSuccess('');

        try {
            const response = await apiPost(
                `/api/gestor/alteracoes-pendentes/${item.id_alteracao}/rejeitar`,
                { motivo }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message || 'Não foi possível rejeitar a alteração.'
                );
            }

            setSuccess(`Alterações de ${item.aluno_nome} rejeitadas.`);
            await carregar();
        } catch (rejectError) {
            setError(rejectError?.message || 'Erro ao rejeitar alteração.');
        } finally {
            setProcessingId(null);
        }
    }

    return (
        <section className="space-y-5">
            <AdminPageHeader
                eyebrow="Alunos"
                title="Alterações de Perfil Pendentes"
                subtitle="Reveja e aprove ou rejeite os pedidos de alteração submetidos pelos alunos."
                icon={ClipboardEdit}
            />

            {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            {success ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                </div>
            ) : null}

            {loading ? (
                <p className="text-sm text-slate-500">A carregar...</p>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                    Não existem alterações pendentes de aprovação.
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => {
                        const anterior = flattenAnterior(item.dados_anteriores);
                        const camposAlterados = Object.keys(
                            item.dados_propostos || {}
                        );

                        return (
                            <div
                                key={item.id_alteracao}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {item.aluno_nome}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Submetido em{' '}
                                            {new Date(
                                                item.criado_em
                                            ).toLocaleString('pt-PT')}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => rejeitar(item)}
                                            disabled={
                                                processingId ===
                                                item.id_alteracao
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <X size={15} />
                                            Rejeitar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => aprovar(item)}
                                            disabled={
                                                processingId ===
                                                item.id_alteracao
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg bg-york-400 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-york-200 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Check size={15} />
                                            Aprovar
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="text-slate-500">
                                            <tr>
                                                <th className="py-1.5 pr-4 text-left font-medium">
                                                    Campo
                                                </th>
                                                <th className="py-1.5 pr-4 text-left font-medium">
                                                    Atual
                                                </th>
                                                <th className="py-1.5 text-left font-medium">
                                                    Proposto
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {camposAlterados.map((campo) => (
                                                <tr key={campo}>
                                                    <td className="py-1.5 pr-4 text-slate-600">
                                                        {FIELD_LABELS[campo] ||
                                                            campo}
                                                    </td>
                                                    <td className="py-1.5 pr-4 text-slate-500">
                                                        {formatValue(
                                                            campo,
                                                            anterior[campo]
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 font-medium text-slate-800">
                                                        {formatValue(
                                                            campo,
                                                            item
                                                                .dados_propostos[
                                                                campo
                                                            ]
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
