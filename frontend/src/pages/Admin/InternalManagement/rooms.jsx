import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import GestaoInternaTabs from './internalManagementTabs.jsx';
import GestaoInternaFilters from './internalManagementFilters.jsx';
import { SortableTh } from './sortableTableHeader.jsx';
import { useSortedRows } from './useSortedRows.js';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/api.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SalasPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ nome: '', capacidade: '' });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const columns = useMemo(() => ['nome', 'capacidade', 'acoes'], []);

    const getRowId = useCallback((row) => row?.id ?? null, []);

    const carregar = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await apiGet(`${API_URL}/api/gestor/salas`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao carregar salas.');
            }

            setRows(Array.isArray(data?.salas) ? data.salas : []);
        } catch (fetchError) {
            setError(fetchError.message || 'Erro ao carregar salas.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        if (!term) {
            return rows;
        }

        return rows.filter((row) =>
            columns.some((column) =>
                String(row?.[column] ?? '')
                    .toLowerCase()
                    .includes(term)
            )
        );
    }, [columns, rows, searchTerm]);

    const { sortedRows, sortColumn, sortDirection, toggleSort } =
        useSortedRows(filteredRows);

    function formatHeader(key) {
        return key
            .replaceAll('_', ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function abrirCriacao() {
        setEditingId(null);
        setFormData({ nome: '', capacidade: '' });
        setFormError('');
        setIsFormOpen(true);
    }

    function abrirEdicao(row) {
        const id = getRowId(row);
        if (id == null) {
            setError('Não foi possível identificar o ID desta sala.');
            return;
        }

        setEditingId(id);
        setFormData({
            nome: String(row?.nome ?? ''),
            capacidade: String(row?.capacidade ?? ''),
        });
        setFormError('');
        setIsFormOpen(true);
    }

    function fecharFormulario() {
        setIsFormOpen(false);
        setEditingId(null);
        setFormData({ nome: '', capacidade: '' });
        setFormError('');
    }

    async function submeterFormulario(event) {
        event.preventDefault();

        const nome = formData.nome.trim();
        if (!nome) {
            setFormError('O nome da sala é obrigatório.');
            return;
        }

        const capacidade = formData.capacidade.trim();
        if (capacidade && Number.isNaN(Number(capacidade))) {
            setFormError('Capacidade deve ser um número válido.');
            return;
        }

        setSubmitting(true);
        setFormError('');

        try {
            const isEditing = editingId != null;
            const url = `${API_URL}/api/gestor/salas${isEditing ? `/${editingId}` : ''}`;

            const response = isEditing
                ? await apiPatch(url, {
                      nome,
                      capacidade,
                  })
                : await apiPost(url, {
                      nome,
                      capacidade,
                  });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(
                    payload.message || 'Não foi possível guardar a sala.'
                );
            }

            await carregar();
            fecharFormulario();
        } catch (submitError) {
            setFormError(submitError.message || 'Erro ao guardar sala.');
        } finally {
            setSubmitting(false);
        }
    }

    async function eliminarSala(row) {
        const id = getRowId(row);
        if (id == null) {
            setError('Não foi possível identificar o ID desta sala.');
            return;
        }

        const confirmed = window.confirm(
            'Tem a certeza que pretende eliminar esta sala?'
        );
        if (!confirmed) {
            return;
        }

        try {
            const response = await apiDelete(
                `${API_URL}/api/gestor/salas/${id}`
            );

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(
                    payload.message || 'Não foi possível eliminar a sala.'
                );
            }

            await carregar();
        } catch (deleteError) {
            setError(deleteError.message || 'Erro ao eliminar sala.');
        }
    }

    return (
        <section className="space-y-7">
            <GestaoInternaTabs />
            <GestaoInternaFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                totalCount={rows.length}
                filteredCount={filteredRows.length}
                placeholder="Pesquisar por nome ou capacidade..."
            />

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={abrirCriacao}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#06b6d4] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0891b2]"
                >
                    <Plus size={16} />
                    Inserir Sala
                </button>
            </div>

            {isFormOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        onClick={fecharFormulario}
                        className="absolute inset-0 bg-slate-900/45"
                        aria-label="Fechar modal"
                    />

                    <form
                        onSubmit={submeterFormulario}
                        className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
                    >
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
                                    {editingId != null
                                        ? 'Editar Sala'
                                        : 'Nova Sala'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {editingId != null
                                        ? 'Atualize os campos da sala'
                                        : 'Preencha os campos para criar uma nova sala'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={fecharFormulario}
                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
                                aria-label="Fechar formulário"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Sala *
                                </span>
                                <input
                                    type="text"
                                    value={formData.nome}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            nome: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                    placeholder="Ex: Sala A"
                                />
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Capacidade
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.capacidade}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            capacidade: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                    placeholder="Ex: 30"
                                />
                            </label>
                        </div>

                        {formError ? (
                            <p className="mt-3 text-sm text-red-600">
                                {formError}
                            </p>
                        ) : null}

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={fecharFormulario}
                                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl bg-[#06b6d4] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0891b2] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting
                                    ? 'A guardar...'
                                    : editingId != null
                                      ? 'Guardar'
                                      : 'Adicionar'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                    <ListChecks size={17} className="text-slate-600" />
                    <h2 className="text-base font-semibold text-slate-700">
                        Lista de Salas
                    </h2>
                </div>
                {loading ? (
                    <p className="p-5 text-base text-slate-500">
                        A carregar salas...
                    </p>
                ) : error ? (
                    <p className="p-5 text-base text-red-600">{error}</p>
                ) : rows.length === 0 ? (
                    <p className="p-5 text-base text-slate-500">
                        Sem salas registadas.
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
                                    {columns.map((column) => {
                                        if (column === 'acoes') {
                                            return (
                                                <th
                                                    key={column}
                                                    className="px-5 py-3.5 text-right font-semibold"
                                                >
                                                    Ações
                                                </th>
                                            );
                                        }

                                        return (
                                            <SortableTh
                                                key={column}
                                                column={column}
                                                label={formatHeader(column)}
                                                sortColumn={sortColumn}
                                                sortDirection={sortDirection}
                                                onSort={toggleSort}
                                            />
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedRows.map((row, index) => (
                                    <tr
                                        key={`sala-${getRowId(row) ?? index}`}
                                        className="hover:bg-slate-50"
                                    >
                                        {columns.map((column) => {
                                            if (column === 'acoes') {
                                                const rowId = getRowId(row);
                                                return (
                                                    <td
                                                        key={`${index}-${column}`}
                                                        className="px-5 py-4 text-right"
                                                    >
                                                        <div className="inline-flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    abrirEdicao(
                                                                        row
                                                                    )
                                                                }
                                                                disabled={
                                                                    rowId ==
                                                                    null
                                                                }
                                                                className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                                title="Editar sala"
                                                            >
                                                                <Pencil
                                                                    size={16}
                                                                />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    eliminarSala(
                                                                        row
                                                                    )
                                                                }
                                                                disabled={
                                                                    rowId ==
                                                                    null
                                                                }
                                                                className="rounded-md p-1.5 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                                title="Eliminar sala"
                                                            >
                                                                <Trash2
                                                                    size={16}
                                                                />
                                                            </button>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td
                                                    key={`${index}-${column}`}
                                                    className="px-5 py-4 text-slate-700"
                                                >
                                                    {String(row[column] ?? '-')}
                                                </td>
                                            );
                                        })}
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
