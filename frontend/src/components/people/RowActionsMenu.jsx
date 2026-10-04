import { Download, Eye, EyeOff, Pencil, Trash, UserRound } from 'lucide-react';

const CLASSE_ITEM =
    'flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50';

/**
 * Menu de ações de uma linha (ver ficha, editar, descarregar a ficha,
 * ativar/desativar, eliminar). Usa o estado de useRowActionsMenu; cada ação
 * fecha o menu e recebe o item da linha.
 */
export default function RowActionsMenu({
    menu,
    pos,
    menuRef,
    onFechar,
    onVerFicha,
    onEditar,
    onDownload,
    onAlterarEstado,
    onEliminar,
}) {
    if (menu === null) return null;

    const { item } = menu;
    const executar = (acao) => () => {
        onFechar();
        acao(item);
    };

    return (
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                top: `${pos.top}px`,
                left: `${pos.left}px`,
                zIndex: 9999,
            }}
            className="w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1"
        >
            <button className={CLASSE_ITEM} onClick={executar(onVerFicha)}>
                <UserRound size={14} />
                Ver ficha completa
            </button>
            <button className={CLASSE_ITEM} onClick={executar(onEditar)}>
                <Pencil size={14} />
                Editar
            </button>
            <button className={CLASSE_ITEM} onClick={executar(onDownload)}>
                <Download size={14} />
                Download
            </button>
            <button className={CLASSE_ITEM} onClick={executar(onAlterarEstado)}>
                {item.status ? <EyeOff size={14} /> : <Eye size={14} />}
                {item.status ? 'Desativar' : 'Ativar'}
            </button>
            <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={executar(onEliminar)}
            >
                <Trash size={14} />
                Eliminar definitivamente
            </button>
        </div>
    );
}
