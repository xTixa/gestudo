import { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    handleReset() {
        this.setState({ hasError: false });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                        <AlertTriangle size={28} className="text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">
                            Algo correu mal
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Ocorreu um erro inesperado. Tente recarregar a página.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => this.handleReset()}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                        <RefreshCcw size={15} />
                        Tentar novamente
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
