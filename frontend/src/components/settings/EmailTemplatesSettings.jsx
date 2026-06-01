import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    Save,
    Variable,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../utils/api';

const editableFields = [
    { key: 'subject', label: 'Assunto', type: 'input' },
    { key: 'title', label: 'Titulo', type: 'input' },
    { key: 'introText', label: 'Texto introdutorio', type: 'textarea' },
    { key: 'bodyText', label: 'Texto principal', type: 'textarea', rows: 8 },
    { key: 'footerText', label: 'Rodape', type: 'textarea' },
    { key: 'buttonLabel', label: 'Texto do botao', type: 'input' },
];

function pickEditable(template) {
    return editableFields.reduce((acc, field) => {
        acc[field.key] = template?.[field.key] || '';
        return acc;
    }, {});
}

export default function EmailTemplatesSettings() {
    const [templates, setTemplates] = useState([]);
    const [selectedKey, setSelectedKey] = useState('');
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const selectedTemplate = useMemo(
        () =>
            templates.find((template) => template.templateKey === selectedKey),
        [selectedKey, templates]
    );

    useEffect(() => {
        let isMounted = true;

        async function loadTemplates() {
            try {
                setLoading(true);
                const response = await apiGet('/api/gestor/email-templates');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data?.message || 'Erro ao carregar templates.'
                    );
                }

                const nextTemplates = Array.isArray(data?.templates)
                    ? data.templates
                    : [];

                if (isMounted) {
                    setTemplates(nextTemplates);
                    const firstKey = nextTemplates[0]?.templateKey || '';
                    setSelectedKey((current) => current || firstKey);
                    setForm(pickEditable(nextTemplates[0]));
                }
            } catch (error) {
                if (isMounted) {
                    setMessage({
                        type: 'error',
                        text:
                            error.message ||
                            'Erro ao carregar templates de email.',
                    });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadTemplates();

        return () => {
            isMounted = false;
        };
    }, []);

    function selectTemplate(templateKey) {
        const template = templates.find(
            (item) => item.templateKey === templateKey
        );
        setSelectedKey(templateKey);
        setForm(pickEditable(template));
        setMessage(null);
    }

    function updateField(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function updateTemplateInState(nextTemplate) {
        setTemplates((prev) =>
            prev.map((template) =>
                template.templateKey === nextTemplate.templateKey
                    ? nextTemplate
                    : template
            )
        );
        setForm(pickEditable(nextTemplate));
    }

    async function saveTemplate() {
        if (!selectedTemplate) return;

        try {
            setSaving(true);
            setMessage(null);

            const response = await apiPatch(
                `/api/gestor/email-templates/${selectedTemplate.templateKey}`,
                form
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao guardar template.');
            }

            updateTemplateInState(data.template);
            setMessage({
                type: 'success',
                text: 'Template guardado com sucesso.',
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.message || 'Erro ao guardar template.',
            });
        } finally {
            setSaving(false);
        }
    }

    async function resetTemplate() {
        if (!selectedTemplate) return;

        if (!window.confirm('Repor este template para o texto original?')) {
            return;
        }

        try {
            setSaving(true);
            setMessage(null);

            const response = await apiPost(
                `/api/gestor/email-templates/${selectedTemplate.templateKey}/reset`,
                {}
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao repor template.');
            }

            updateTemplateInState(data.template);
            setMessage({
                type: 'success',
                text: 'Template reposto para o texto original.',
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.message || 'Erro ao repor template.',
            });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                A carregar templates...
            </div>
        );
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
                {templates.map((template) => {
                    const isActive = selectedKey === template.templateKey;
                    return (
                        <button
                            key={template.templateKey}
                            type="button"
                            onClick={() =>
                                selectTemplate(template.templateKey)
                            }
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                                isActive
                                    ? 'border-york-400 bg-york-50 text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span className="block text-sm font-semibold">
                                {template.name}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                                {template.description}
                            </span>
                        </button>
                    );
                })}
            </aside>

            {selectedTemplate ? (
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
                                <CheckCircle2
                                    size={17}
                                    className="mt-0.5 shrink-0"
                                />
                            ) : (
                                <AlertCircle
                                    size={17}
                                    className="mt-0.5 shrink-0"
                                />
                            )}
                            <span>{message.text}</span>
                        </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {selectedTemplate.name}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Edita apenas o conteudo. O layout, envio e
                                    variaveis obrigatorias ficam protegidos.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={resetTemplate}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <RotateCcw size={16} />
                                    Repor
                                </button>
                                <button
                                    type="button"
                                    onClick={saveTemplate}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <Save size={16} />
                                    {saving ? 'A guardar...' : 'Guardar'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4">
                            {editableFields.map((field) => (
                                <label key={field.key}>
                                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {field.label}
                                    </span>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={form[field.key] || ''}
                                            rows={field.rows || 3}
                                            onChange={(event) =>
                                                updateField(
                                                    field.key,
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                        />
                                    ) : (
                                        <input
                                            value={form[field.key] || ''}
                                            onChange={(event) =>
                                                updateField(
                                                    field.key,
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                        />
                                    )}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h3 className="text-sm font-semibold text-slate-800">
                                Preview
                            </h3>
                            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                                <div className="bg-york-400 px-5 py-4 text-white">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                                        {selectedTemplate.preview?.subject}
                                    </p>
                                    <h4 className="mt-2 text-xl font-bold">
                                        {selectedTemplate.preview?.title}
                                    </h4>
                                </div>
                                <div className="space-y-3 bg-white px-5 py-4 text-sm leading-6 text-slate-700">
                                    <p>{selectedTemplate.preview?.introText}</p>
                                    {String(
                                        selectedTemplate.preview?.bodyText || ''
                                    )
                                        .split('\n\n')
                                        .filter(Boolean)
                                        .map((paragraph, index) => (
                                            <p key={index}>{paragraph}</p>
                                        ))}
                                    {selectedTemplate.preview?.buttonLabel ? (
                                        <span className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                                            {
                                                selectedTemplate.preview
                                                    .buttonLabel
                                            }
                                        </span>
                                    ) : null}
                                </div>
                                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                                    {selectedTemplate.preview?.footerText}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="flex items-center gap-2 text-slate-800">
                                <Variable size={16} />
                                <h3 className="text-sm font-semibold">
                                    Variaveis
                                </h3>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Usa apenas estas variaveis. As obrigatorias
                                precisam de existir no template.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {selectedTemplate.allowedVariables.map(
                                    (variable) => {
                                        const required =
                                            selectedTemplate.requiredVariables.includes(
                                                variable
                                            );
                                        return (
                                            <button
                                                key={variable}
                                                type="button"
                                                onClick={() =>
                                                    updateField(
                                                        'bodyText',
                                                        `${form.bodyText || ''}{${variable}}`
                                                    )
                                                }
                                                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                                    required
                                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                        : 'border-slate-200 bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                {`{${variable}}`}
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
