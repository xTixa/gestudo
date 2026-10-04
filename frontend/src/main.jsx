import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { aplicarModoTemaInicial } from './theme/modoTema.js';

// Aplica o modo escuro antes do primeiro render (só há tema escuro com sessão).
aplicarModoTemaInicial(Boolean(localStorage.getItem('mc_user')));

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <ErrorBoundary>
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            borderRadius: '12px',
                            fontSize: '14px',
                            background: 'rgb(var(--s-white))',
                            color: 'rgb(var(--t-slate-800))',
                        },
                    }}
                />
            </ErrorBoundary>
        </BrowserRouter>
    </StrictMode>
);
