import { useEffect, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import GestaoInternaTabs from './internalManagementTabs';
import GestaoInternaFilters from './internalManagementFilters';
import { apiGet } from '../../../utils/api';

export default function PacotesPage() {
    const [rows, setRows] = useState([]);
    const [modalidadesMap, setModalidadesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function carregar() {
            setLoading(true);
            setError('');

            try {
                const [pacotesResponse, modalidadesResponse] =
                    await Promise.all([
                        apiGet('/api/gestor/pacotes'),
                        apiGet('/api/gestor/modalidades'),
                    ]);

                const data = await pacotesResponse.json();
                const modalidadesData = await modalidadesResponse.json();

                if (!pacotesResponse.ok) {
                    throw new Error(
                        data.message || 'Erro ao carregar pacotes.'
                    );
                }

                if (isMounted) {
                    setRows(Array.isArray(data?.pacotes) ? data.pacotes : []);

                    const modalidades = Array.isArray(
                        modalidadesData?.modalidades
                    )
                        ? modalidadesData.modalidades
                        : [];

                    const nextMap = {};
                    modalidades.forEach((modalidade) => {
                        const id = String(
                            modalidade?.id_modalidade ?? modalidade?.id ?? ''
                        ).trim();
                        const nome = String(
                            modalidade?.nome ?? modalidade?.designacao ?? ''
                        ).trim();

                        if (id && nome) {
                            nextMap[id] = nome;
                        }
                    });

                    setModalidadesMap(nextMap);
                }
            } catch (fetchError) {
                if (isMounted) {
                    setError(fetchError.message || 'Erro ao carregar pacotes.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        carregar();

        return () => {
            isMounted = false;
        };
    }, []);

    const visibleRows = useMemo(
        () =>
            rows.map((row) => {
                const modalidadeRaw =
                    row?.id_modalidade ??
                    row?.modalidade_id ??
                    row?.modalidade ??
                    '';
                const modalidadeId = String(modalidadeRaw ?? '').trim();

                return {
                    nome: String(row?.nome ?? '-').trim() || '-',
                    preco: row?.preco ?? row?.valor ?? '-',
                    modalidade:
                        modalidadesMap[modalidadeId] ||
                        (modalidadeId && Number.isNaN(Number(modalidadeId))
                            ? modalidadeId
                            : '-'),
                    horas: row?.horas ?? row?.carga_horaria ?? '-',
                };
            }),
        [rows, modalidadesMap]
    );

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        if (!term) {
            return visibleRows;
        }

        return visibleRows.filter((row) =>
            [row.nome, row.preco, row.modalidade, row.horas].some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term)
            )
        );
    }, [searchTerm, visibleRows]);

    return (
        <section className="space-y-7">
            <GestaoInternaTabs />
            <GestaoInternaFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                totalCount={visibleRows.length}
                filteredCount={filteredRows.length}
                placeholder="Pesquisar por nome, preço, modalidade ou horas..."
            />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                    <ListChecks size={17} className="text-slate-600" />
                    <h2 className="text-base font-semibold text-slate-700">
                        Lista de Pacotes
                    </h2>
                </div>
                {loading ? (
                    <p className="p-5 text-base text-slate-500">
                        A carregar pacotes...
                    </p>
                ) : error ? (
                    <p className="p-5 text-base text-red-600">{error}</p>
                ) : rows.length === 0 ? (
                    <p className="p-5 text-base text-slate-500">
                        Sem pacotes registados.
                    </p>
                ) : filteredRows.length === 0 ? (
                    <p className="p-5 text-base text-slate-500">
                        Sem resultados para o filtro aplicado.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-base">
                            <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                    <th className="px-5 py-3.5 text-left font-semibold">
                                        Nome
                                    </th>
                                    <th className="px-5 py-3.5 text-left font-semibold">
                                        Preço
                                    </th>
                                    <th className="px-5 py-3.5 text-left font-semibold">
                                        Modalidade
                                    </th>
                                    <th className="px-5 py-3.5 text-left font-semibold">
                                        Horas
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRows.map((row, index) => (
                                    <tr
                                        key={`pacote-${index}`}
                                        className="hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 text-slate-700">
                                            {String(row.nome ?? '-')}
                                        </td>
                                        <td className="px-5 py-4 text-slate-700">
                                            {String(row.preco ?? '-')}
                                        </td>
                                        <td className="px-5 py-4 text-slate-700">
                                            {String(row.modalidade ?? '-')}
                                        </td>
                                        <td className="px-5 py-4 text-slate-700">
                                            {String(row.horas ?? '-')}
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
