import { useEffect, useState } from 'react';
import { apiGet } from '../../utils/api';

const SELECTED_KEY = 'mc_educando_selecionado';

function readStoredId() {
    try {
        const value = Number(localStorage.getItem(SELECTED_KEY));
        return Number.isInteger(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

/**
 * Educandos do encarregado autenticado e o educando selecionado (lembrado
 * neste dispositivo, para manter a escolha entre páginas).
 */
export function useEducandos() {
    const [state, setState] = useState(null);
    const [selectedId, setSelectedIdState] = useState(readStoredId);

    useEffect(() => {
        let active = true;
        apiGet('/api/encarregado/educandos')
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.message || 'Não foi possível carregar os educandos.');
                }
                if (active) {
                    setState({ educandos: data.educandos || [], error: '' });
                }
            })
            .catch((error) => {
                if (active) setState({ educandos: [], error: error.message });
            });
        return () => {
            active = false;
        };
    }, []);

    const educandos = state?.educandos || [];
    const selected =
        educandos.find((item) => item.idAluno === selectedId) || educandos[0] || null;

    function setSelectedId(id) {
        setSelectedIdState(id);
        try {
            localStorage.setItem(SELECTED_KEY, String(id));
        } catch {
            // Sem armazenamento: a escolha dura só nesta página.
        }
    }

    return {
        loading: !state,
        error: state?.error || '',
        educandos,
        selected,
        setSelectedId,
    };
}
