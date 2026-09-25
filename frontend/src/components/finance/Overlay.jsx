import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

function useDialogBehaviour(open, onClose, panelRef) {
    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const previouslyFocused = document.activeElement;
        panelRef.current?.focus();

        function handleKeyDown(event) {
            if (event.key === 'Escape') onClose?.();
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [open, onClose, panelRef]);
}

/** Painel lateral (detalhe de um registo). */
export function Drawer({ open, onClose, title, subtitle, children, footer }) {
    const panelRef = useRef(null);
    useDialogBehaviour(open, onClose, panelRef);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] flex justify-end" role="presentation">
            <button
                type="button"
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
                onClick={onClose}
                aria-label="Fechar"
                tabIndex={-1}
            />
            <section
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl outline-none"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
                        {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Fechar"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer ? (
                    <footer className="border-t border-slate-200 bg-slate-50 px-6 py-3">{footer}</footer>
                ) : null}
            </section>
        </div>
    );
}

/** Janela modal centrada (formulários curtos). */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
    const panelRef = useRef(null);
    useDialogBehaviour(open, onClose, panelRef);

    if (!open) return null;

    const width = size === 'lg' ? 'max-w-3xl' : 'max-w-lg';

    return (
        <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="presentation">
            <button
                type="button"
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px]"
                onClick={onClose}
                aria-label="Fechar"
                tabIndex={-1}
            />
            <section
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`relative my-8 w-full ${width} rounded-xl bg-white shadow-2xl outline-none`}
            >
                <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Fechar"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div className="px-6 py-4">{children}</div>
                {footer ? (
                    <footer className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-6 py-3">
                        {footer}
                    </footer>
                ) : null}
            </section>
        </div>
    );
}
