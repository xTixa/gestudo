import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import GestaoInternaTabs from './internalManagementTabs';
import GestaoInternaFilters from './internalManagementFilters';
import { SortableTh } from './sortableTableHeader';
import { useSortedRows } from './useSortedRows';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const HORAS_MENSAIS_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 18, 20];

const EMPTY_FORM = {
    nome: '',
    preco: '',
    horas: '',
    idModalidade: '',
    idDisciplina: '',
};

export default function PacotesPage() {
    const [rows, setRows] = useState([]);
    const [modalidades, setModalidades] = useState([]);
    const [disciplinas, setDisciplinas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const modalidadesMap = useMemo(() => {
        const map = {};
        modalidades.forEach((modalidade) => {
            const id = String(
                modalidade?.id_modalidade ?? modalidade?.id ?? ''
            ).trim();
            const nome = String(
                modalidade?.nome ?? modalidade?.designacao ?? ''
            ).trim();
            if (id && nome) {
                map[id] = nome;
            }
        });
        return map;
    }, [modalidades]);

    const getRowId = useCallback((row) => row?.id ?? null, []);

    const carregar = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const [pacotesResponse, modalidadesResponse, disciplinasResponse] =
                await Promise.all([
                    apiGet('/api/gestor/pacotes'),
                    apiGet('/api/gestor/modalidades'),
                    apiGet('/api/gestor/disciplinas'),
                ]);

            const data = await pacotesResponse.json();
            const modalidadesData = await modalidadesResponse.json();
            const disciplinasData = await disciplinasResponse.json();

            if (!pacotesResponse.ok) {
                throw new Error(data.message || 'Erro ao carregar pacotes.');
            }

            setRows(Array.isArray(data?.pacotes) ? data.pacotes : []);
            setModalidades(
                Array.isArray(modalidadesData?.modalidades)
                    ? modalidadesData.modalidades
                    : []
            );
            setDisciplinas(
                Array.isArray(disciplinasData?.disciplinas)
                    ? disciplinasData.disciplinas
                    : []
            );
        } catch (fetchError) {
            setError(fetchError.message || 'Erro ao carregar pacotes.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

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
                    raw: row,
                    nome: String(row?.nome ?? '-').trim() || '-',
                    preco: row?.preco ?? row?.valor ?? '-',
                    modalidade:
                        modalidadesMap[modalidadeId] ||
                        (modalidadeId && Number.isNaN(Number(modalidadeId))
                            ? modalidadeId
                            : '-'),
                    horas: row?.horas_mensais ?? row?.horas ?? row?.carga_horaria ?? '-',
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

    const { sortedRows, sortColumn, sortDirection, toggleSort } =
        useSortedRows(filteredRows);

    function abrirCriacao() {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setFormError('');
        setIsFormOpen(true);
    }

    function abrirEdicao(row) {
        const id = getRowId(row);
        if (id == null) {
            setError('Não foi possível identificar o ID deste pacote.');
            return;
        }

        setEditingId(id);
        setFormData({
            nome: String(row?.nome ?? ''),
            preco: String(row?.preco ?? ''),
            horas: String(row?.horas_mensais ?? row?.horas ?? ''),
            idModalidade: String(row?.id_modalidade ?? ''),
            idDisciplina: String(row?.id_disciplina ?? ''),
        });
        setFormError('');
        setIsFormOpen(true);
    }

    function fecharFormulario() {
        setIsFormOpen(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setFormError('');
    }

    async function submeterFormulario(event) {
        event.preventDefault();

        const nome = formData.nome.trim();
        if (!nome) {
            setFormError('O nome do pacote é obrigatório.');
            return;
        }

        const preco = formData.preco.trim();
        if (preco && Number.isNaN(Number(preco))) {
            setFormError('O preço deve ser um número válido.');
            return;
        }

        if (formData.horas) {
            const horas = Number(formData.horas);
            if (
                !Number.isInteger(horas) ||
                horas % 2 !== 0 ||
                horas < 4 ||
                horas > 20
            ) {
                setFormError(
                    'As horas mensais devem ser um número par entre 4 e 20.'
                );
                return;
            }
        }

        setSubmitting(true);
        setFormError('');

        try {
            const isEditing = editingId != null;
            const url = `${API_URL}/api/gestor/pacotes${isEditing ? `/${editingId}` : ''}`;

            const payload = {
                nome,
                preco,
                horas: formData.horas || '',
                idModalidade: formData.idModalidade || '',
                idDisciplina: formData.idDisciplina || '',
            };

            const response = isEditing
                ? await apiPatch(url, payload)
                : await apiPost(url, payload);

            const responsePayload = await response.json();
            if (!response.ok) {
                throw new Error(
                    responsePayload.message ||
                        'Não foi possível guardar o pacote.'
                );
            }

            await carregar();
            fecharFormulario();
        } catch (submitError) {
            setFormError(submitError.message || 'Erro ao guardar pacote.');
        } finally {
            setSubmitting(false);
        }
    }

    async function eliminarPacote(row) {
        const id = getRowId(row);
        if (id == null) {
            setError('Não foi possível identificar o ID deste pacote.');
            return;
        }

        const confirmed = window.confirm(
            'Tem a certeza que pretende eliminar este pacote?'
        );
        if (!confirmed) {
            return;
        }

        try {
            const response = await apiDelete(
                `${API_URL}/api/gestor/pacotes/${id}`
            );

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(
                    payload.message || 'Não foi possível eliminar o pacote.'
                );
            }

            await carregar();
        } catch (deleteError) {
            setError(deleteError.message || 'Erro ao eliminar pacote.');
        }
    }

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

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={abrirCriacao}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#06b6d4] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0891b2]"
                >
                    <Plus size={16} />
                    Inserir Pacote
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
                                        ? 'Editar Pacote'
                                        : 'Novo Pacote'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {editingId != null
                                        ? 'Atualize os campos do pacote'
                                        : 'Preencha os campos para criar um novo pacote'}
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
                            <label className="block space-y-1.5 md:col-span-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Nome *
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
                                    placeholder="Ex: Grupo 8h/mês"
                                />
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Preço (€)
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.preco}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            preco: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                    placeholder="Ex: 65.00"
                                />
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Horas mensais
                                </span>
                                <select
                                    value={formData.horas}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            horas: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                >
                                    <option value="">Sem horas definidas</option>
                                    {HORAS_MENSAIS_OPTIONS.map((horas) => (
                                        <option key={horas} value={horas}>
                                            {horas}h
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Modalidade
                                </span>
                                <select
                                    value={formData.idModalidade}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            idModalidade: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                >
                                    <option value="">Sem modalidade</option>
                                    {modalidades.map((modalidade) => (
                                        <option
                                            key={modalidade.id_modalidade}
                                            value={modalidade.id_modalidade}
                                        >
                                            {modalidade.nome}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">
                                    Disciplina
                                </span>
                                <select
                                    value={formData.idDisciplina}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            idDisciplina: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-[#06b6d4] focus:ring-2 focus:ring-[#cffafe]"
                                >
                                    <option value="">Sem disciplina</option>
                                    {disciplinas.map((disciplina) => (
                                        <option
                                            key={disciplina.id_disciplina}
                                            value={disciplina.id_disciplina}
                                        >
                                            {disciplina.nome}
                                        </option>
                                    ))}
                                </select>
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
                                    <SortableTh
                                        column="nome"
                                        label="Nome"
                                        sortColumn={sortColumn}
                                        sortDirection={sortDirection}
                                        onSort={toggleSort}
                                    />
                                    <SortableTh
                                        column="preco"
                                        label="Preço"
                                        sortColumn={sortColumn}
                                        sortDirection={sortDirection}
                                        onSort={toggleSort}
                                    />
                                    <SortableTh
                                        column="modalidade"
                                        label="Modalidade"
                                        sortColumn={sortColumn}
                                        sortDirection={sortDirection}
                                        onSort={toggleSort}
                                    />
                                    <SortableTh
                                        column="horas"
                                        label="Horas"
                                        sortColumn={sortColumn}
                                        sortDirection={sortDirection}
                                        onSort={toggleSort}
                                    />
                                    <th className="px-5 py-3.5 text-right font-semibold">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedRows.map((row, index) => {
                                    const rowId = getRowId(row.raw);
                                    return (
                                        <tr
                                            key={`pacote-${rowId ?? index}`}
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
                                            <td className="px-5 py-4 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirEdicao(
                                                                row.raw
                                                            )
                                                        }
                                                        disabled={
                                                            rowId == null
                                                        }
                                                        className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                        title="Editar pacote"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            eliminarPacote(
                                                                row.raw
                                                            )
                                                        }
                                                        disabled={
                                                            rowId == null
                                                        }
                                                        className="rounded-md p-1.5 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                        title="Eliminar pacote"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
