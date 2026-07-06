import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, Save } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../utils/api';

const TEXTAREA_THRESHOLD = 60;

export default function EnrollmentFormTextsSettings() {
    const [textos, setTextos] = useState([]);
    const [selectedSecao, setSelectedSecao] = useState('');
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resettingKey, setResettingKey] = useState('');
    const [message, setMessage] = useState(null);

    const secoes = useMemo(() => {
        const seen = [];
        for (const item of textos) {
            if (!seen.includes(item.secao)) seen.push(item.secao);
        }
        return seen;
    }, [textos]);

    const camposSecao = useMemo(
        () => textos.filter((item) => item.secao === selectedSecao),
        [textos, selectedSecao]
    );

    function formFromTextos(items) {
        return Object.fromEntries(items.map((item) => [item.key, item.value]));
    }

    useEffect(() => {
        let isMounted = true;

        async function loadTextos() {
            try {
                setLoading(true);
                const response = await apiGet('/api/gestor/inscricao-textos');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.message || 'Erro ao carregar textos.');
                }

                const nextTextos = Array.isArray(data?.textos) ? data.textos : [];

                if (isMounted) {
                    setTextos(nextTextos);
                    const firstSecao = nextTextos[0]?.secao || '';
                    setSelectedSecao((current) => current || firstSecao);
                    setForm(
                        formFromTextos(
                            nextTextos.filter(
                                (item) => item.secao === (firstSecao || '')
                            )
                        )
                    );
                }
            } catch (error) {
                if (isMounted) {
                    setMessage({
                        type: 'error',
                        text: error.message || 'Erro ao carregar textos do formulário.',
                    });
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadTextos();
        return () => {
            isMounted = false;
        };
    }, []);

    function selectSecao(secao) {
        setSelectedSecao(secao);
        setForm(formFromTextos(textos.filter((item) => item.secao === secao)));
        setMessage(null);
    }

    function updateField(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    const hasChanges = camposSecao.some(
        (item) => (form[item.key] ?? '') !== item.value
    );

    async function saveSection() {
        const updates = Object.fromEntries(
            camposSecao
                .filter((item) => (form[item.key] ?? '') !== item.value)
                .map((item) => [item.key, form[item.key]])
        );

        if (Object.keys(updates).length === 0) return;

        try {
            setSaving(true);
            setMessage(null);

            const response = await apiPatch('/api/gestor/inscricao-textos', {
                updates,
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao guardar textos.');
            }

            const nextTextos = Array.isArray(data?.textos) ? data.textos : textos;
            setTextos(nextTextos);
            setForm(
                formFromTextos(
                    nextTextos.filter((item) => item.secao === selectedSecao)
                )
            );
            setMessage({ type: 'success', text: 'Alterações guardadas com sucesso.' });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.message || 'Erro ao guardar textos.',
            });
        } finally {
            setSaving(false);
        }
    }

    async function resetField(key) {
        if (!window.confirm('Repor este texto para o valor original?')) return;

        try {
            setResettingKey(key);
            setMessage(null);

            const response = await apiPost(
                `/api/gestor/inscricao-textos/${key}/reset`,
                {}
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao repor texto.');
            }

            const updated = data.texto;
            setTextos((prev) =>
                prev.map((item) => (item.key === updated.key ? updated : item))
            );
            setForm((prev) => ({ ...prev, [updated.key]: updated.value }));
            setMessage({ type: 'success', text: 'Texto reposto para o original.' });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.message || 'Erro ao repor texto.',
            });
        } finally {
            setResettingKey('');
        }
    }

    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                A carregar textos...
            </div>
        );
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
                {secoes.map((secao) => {
                    const isActive = selectedSecao === secao;
                    return (
                        <button
                            key={secao}
                            type="button"
                            onClick={() => selectSecao(secao)}
                            className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                                isActive
                                    ? 'border-york-400 bg-york-50 text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {secao}
                        </button>
                    );
                })}
            </aside>

            <div className="space-y-5">
                {message ? (
                    <div
                        className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                            message.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-red-200 bg-red-50 text-red-800'
                        }`}
                    >
                        {message.type === 'success' ? (
                            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                        ) : (
                            <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        )}
                        <span>{message.text}</span>
                    </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">
                                {selectedSecao}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Edita os textos visíveis nesta secção do formulário
                                público de inscrição. A estrutura dos campos não muda.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={saveSection}
                            disabled={saving || !hasChanges}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <Save size={16} />
                            {saving ? 'A guardar...' : 'Guardar alterações'}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-4">
                        {camposSecao.map((item) => (
                            <label key={item.key}>
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {item.label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => resetField(item.key)}
                                        disabled={resettingKey === item.key}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <RotateCcw size={12} />
                                        Repor
                                    </button>
                                </div>
                                {item.value.length > TEXTAREA_THRESHOLD ? (
                                    <textarea
                                        value={form[item.key] ?? ''}
                                        rows={3}
                                        onChange={(event) =>
                                            updateField(item.key, event.target.value)
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                    />
                                ) : (
                                    <input
                                        value={form[item.key] ?? ''}
                                        onChange={(event) =>
                                            updateField(item.key, event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                    />
                                )}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
