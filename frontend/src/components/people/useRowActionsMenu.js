import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const LARGURA_MENU = 192; // w-48

/**
 * Estado do menu de ações de uma linha de tabela (gestão de alunos e de
 * professores). O menu é fixed para não ser cortado pelo scroll da tabela:
 * abre por baixo do botão ou, sem espaço, por cima; fecha ao clicar fora.
 *
 * Devolve { menu, pos, menuRef, abrir, fechar }, em que menu é
 * { id, item } (a linha aberta) ou null.
 */
export function useRowActionsMenu() {
    const [menu, setMenu] = useState(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const menuRef = useRef(null);

    useEffect(() => {
        if (menu === null) return;

        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenu(null);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menu]);

    // Abre (ou fecha, se já estiver aberto) o menu da linha "id".
    function abrir(event, id, item) {
        if (menu?.id === id) {
            setMenu(null);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const left =
            rect.left + LARGURA_MENU > window.innerWidth
                ? Math.max(8, rect.right - LARGURA_MENU)
                : rect.left;
        setPos({
            top: rect.bottom + 4,
            left,
            triggerTop: rect.top,
            triggerBottom: rect.bottom,
        });
        setMenu({ id, item });
    }

    // Depois de medir o menu, abre-o para cima se não couber por baixo.
    useLayoutEffect(() => {
        if (menu === null || !menuRef.current) return;

        const height = menuRef.current.getBoundingClientRect().height;

        setPos((prev) => {
            if (prev.triggerBottom == null) return prev;

            const spaceBelow = window.innerHeight - prev.triggerBottom;
            const fitsBelow = spaceBelow >= height + 8;

            if (fitsBelow) return prev;

            const openUpwardTop = prev.triggerTop - height - 4;
            return {
                ...prev,
                top: Math.max(8, openUpwardTop),
            };
        });
    }, [menu]);

    return { menu, pos, menuRef, abrir, fechar: () => setMenu(null) };
}
