import { useEffect, useState } from 'react';
import { Book, Info, Pencil, Plus, School, Trash2, User, Users, X } from 'lucide-react';
import EnrollmentStatusBadge from './EnrollmentStatusBadge';

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPlanoFromItem(item) {
    const plano = item?.dados?.plano;
    if (Array.isArray(plano) && plano.length > 0) {
        return plano.map((p) => ({
            disciplina: p?.disciplina || '',
            tipo_servico: p?.tipo_servico || '',
            modalidade: p?.modalidade || '',
            pacote: p?.pacote || '',
        }));
    }

    return [
        {
            disciplina: item?.disciplina || '',
            tipo_servico: item?.tipo_servico || '',
            modalidade: item?.modalidade || '',
            pacote: item?.pacote || '',
        },
    ];
}

function DetailRow({ label, value }) {
    return (
        <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {label}
            </p>
            <p className="text-sm font-medium text-slate-900">{value || '-'}</p>
        </div>
    );
}

function EditField({ label, value, onChange }) {
    return (
        <label className="block">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {label}
            </p>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
        </label>
    );
}

function Section({ title, icon: Icon, children, action }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={14} className="text-slate-600" />}
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {title}
                    </p>
                </div>
                {action || null}
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                {children}
            </div>
        </div>
    );
}

export default function EnrollmentDrawer({
    item,
    onClose,
    onStatusChange,
    onFieldsSave,
    saving,
}) {
    const [localStatus, setLocalStatus] = useState(item?.estado || 'pendente');
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState(() => ({
        nome_completo: item?.nome_completo || '',
        email: item?.email || '',
        telemovel: item?.telemovel || '',
        escola: item?.escola || '',
        turma: item?.turma || '',
        ee_nome: item?.ee_nome || '',
    }));
    const [plano, setPlano] = useState(() => getPlanoFromItem(item));
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (!item) return null;

    async function handleApply() {
        await onStatusChange(item.id_inscricao_publica, localStatus);
    }

    function startEditing() {
        setForm({
            nome_completo: item?.nome_completo || '',
            email: item?.email || '',
            telemovel: item?.telemovel || '',
            escola: item?.escola || '',
            turma: item?.turma || '',
            ee_nome: item?.ee_nome || '',
        });
        setPlano(getPlanoFromItem(item));
        setSaveError('');
        setIsEditing(true);
    }

    function cancelEditing() {
        setIsEditing(false);
        setSaveError('');
    }

    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function updatePlanoField(index, field, value) {
        setPlano((prev) =>
            prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
        );
    }

    function addPlanoRow() {
        setPlano((prev) => [
            ...prev,
            { disciplina: '', tipo_servico: '', modalidade: '', pacote: '' },
        ]);
    }

    function removePlanoRow(index) {
        setPlano((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSaveFields() {
        setSaveError('');

        const trimmedForm = Object.fromEntries(
            Object.entries(form).map(([key, value]) => [key, String(value || '').trim()])
        );

        if (Object.values(trimmedForm).some((value) => !value)) {
            setSaveError('Nenhum campo pode ficar vazio.');
            return;
        }

        const trimmedPlano = plano.map((p) => ({
            disciplina: String(p.disciplina || '').trim(),
            tipo_servico: String(p.tipo_servico || '').trim(),
            modalidade: String(p.modalidade || '').trim(),
            pacote: String(p.pacote || '').trim(),
        }));

        if (trimmedPlano.some((p) => !p.disciplina || !p.modalidade)) {
            setSaveError('Cada disciplina do plano precisa de nome e modalidade.');
            return;
        }

        try {
            await onFieldsSave(item.id_inscricao_publica, {
                ...trimmedForm,
                plano: trimmedPlano,
            });
            setIsEditing(false);
        } catch (err) {
            setSaveError(err?.message || 'Erro ao guardar alterações.');
        }
    }

    const displayPlano = getPlanoFromItem(item);

    return (
        <>
            <div
                onClick={onClose}
                className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm transition-opacity"
            />

            <aside className="fixed bottom-3 left-3 right-3 top-3 z-50 flex max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl bg-white shadow-2xl sm:left-auto sm:w-full sm:max-w-[460px]">
                <div className="flex min-h-0 w-full flex-col">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Inscrição #{item.id_inscricao_publica}
                        </p>
                        <h2 className="text-lg font-bold text-slate-900">
                            {item.nome_completo || '-'}
                        </h2>
                        <div className="mt-2">
                            <EnrollmentStatusBadge status={item.estado} />
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {!isEditing ? (
                            <button
                                type="button"
                                onClick={startEditing}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
                                title="Editar campos"
                                aria-label="Editar campos"
                            >
                                <Pencil size={15} />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    {saveError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            {saveError}
                        </div>
                    ) : null}

                    {isEditing ? (
                        <>
                            <Section title="Dados pessoais" icon={User}>
                                <EditField
                                    label="Nome completo"
                                    value={form.nome_completo}
                                    onChange={(v) => updateField('nome_completo', v)}
                                />
                                <EditField
                                    label="Email"
                                    value={form.email}
                                    onChange={(v) => updateField('email', v)}
                                />
                                <EditField
                                    label="Telemóvel"
                                    value={form.telemovel}
                                    onChange={(v) => updateField('telemovel', v)}
                                />
                            </Section>

                            <Section title="Escola" icon={School}>
                                <EditField
                                    label="Escola"
                                    value={form.escola}
                                    onChange={(v) => updateField('escola', v)}
                                />
                                <EditField
                                    label="Turma"
                                    value={form.turma}
                                    onChange={(v) => updateField('turma', v)}
                                />
                            </Section>

                            <Section
                                title="Plano de estudo"
                                icon={Book}
                                action={
                                    <button
                                        type="button"
                                        onClick={addPlanoRow}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                                    >
                                        <Plus size={12} />
                                        Disciplina
                                    </button>
                                }
                            >
                                {plano.map((p, index) => (
                                    <div
                                        key={index}
                                        className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                Disciplina {index + 1}
                                            </p>
                                            {plano.length > 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => removePlanoRow(index)}
                                                    className="text-slate-400 hover:text-red-600"
                                                    title="Remover"
                                                    aria-label="Remover disciplina"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            ) : null}
                                        </div>
                                        <EditField
                                            label="Disciplina"
                                            value={p.disciplina}
                                            onChange={(v) => updatePlanoField(index, 'disciplina', v)}
                                        />
                                        <EditField
                                            label="Modalidade"
                                            value={p.modalidade}
                                            onChange={(v) => updatePlanoField(index, 'modalidade', v)}
                                        />
                                        <EditField
                                            label="Pacote"
                                            value={p.pacote}
                                            onChange={(v) => updatePlanoField(index, 'pacote', v)}
                                        />
                                    </div>
                                ))}
                            </Section>

                            <Section title="Encarregado de educação" icon={Users}>
                                <EditField
                                    label="Nome"
                                    value={form.ee_nome}
                                    onChange={(v) => updateField('ee_nome', v)}
                                />
                            </Section>
                        </>
                    ) : (
                        <>
                            <Section title="Dados pessoais" icon={User}>
                                <DetailRow
                                    label="Nome completo"
                                    value={item.nome_completo}
                                />
                                <DetailRow label="Email" value={item.email} />
                                <DetailRow label="Telemóvel" value={item.telemovel} />
                            </Section>

                            <Section title="Escola" icon={School}>
                                <DetailRow label="Escola" value={item.escola} />
                                <DetailRow label="Turma" value={item.turma} />
                            </Section>

                            <Section title="Plano de estudo" icon={Book}>
                                {displayPlano.map((p, index) => (
                                    <div
                                        key={index}
                                        className={
                                            index > 0
                                                ? 'space-y-3 border-t border-slate-200 pt-3'
                                                : 'space-y-3'
                                        }
                                    >
                                        {displayPlano.length > 1 ? (
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                Disciplina {index + 1}
                                            </p>
                                        ) : null}
                                        <DetailRow label="Disciplina" value={p.disciplina} />
                                        <DetailRow label="Modalidade" value={p.modalidade} />
                                        <DetailRow label="Pacote" value={p.pacote} />
                                    </div>
                                ))}
                            </Section>

                            <Section title="Encarregado de educação" icon={Users}>
                                <DetailRow label="Nome" value={item.ee_nome} />
                            </Section>

                            <Section title="Informação" icon={Info}>
                                <DetailRow
                                    label="Data de submissão"
                                    value={formatDateTime(item.created_at)}
                                />
                            </Section>
                        </>
                    )}
                </div>

                <div className="flex shrink-0 gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                    {isEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={saving}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveFields}
                                disabled={saving}
                                className="flex-1 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                            >
                                {saving ? 'A guardar...' : 'Guardar alterações'}
                            </button>
                        </>
                    ) : (
                        <>
                            <select
                                value={localStatus}
                                onChange={(e) => setLocalStatus(e.target.value)}
                                disabled={saving}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                <option value="pendente">Pendente</option>
                                <option value="aprovada">Aprovada</option>
                                <option value="rejeitada">Rejeitada</option>
                            </select>
                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={saving || localStatus === item.estado}
                                className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                            >
                                {saving ? 'A guardar...' : 'Aplicar'}
                            </button>
                        </>
                    )}
                </div>
                </div>
            </aside>
        </>
    );
}
