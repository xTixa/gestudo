import { db } from '../config/db.js';
import { isTemaValido, TEMA_POR_OMISSAO } from '../config/temas.js';

const CHAVE_TEMA = 'tema_cor';

// Cor do tema do centro. Se a BD falhar ou o valor guardado já não existir,
// usa o tema por omissão em vez de partir a app.
export async function obterTemaCentro() {
    try {
        const { rows } = await db.query(
            'SELECT valor FROM configuracoes_centro WHERE chave = $1',
            [CHAVE_TEMA]
        );
        const tema = rows[0]?.valor;
        return isTemaValido(tema) ? tema : TEMA_POR_OMISSAO;
    } catch (error) {
        console.warn('[aparenciaService] A usar o tema por omissão:', error.message);
        return TEMA_POR_OMISSAO;
    }
}

export async function definirTemaCentro(tema, updatedBy) {
    if (!isTemaValido(tema)) {
        const error = new Error('Cor de tema inválida.');
        error.status = 400;
        throw error;
    }

    await db.query(
        `
            INSERT INTO configuracoes_centro (chave, valor, updated_by, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (chave) DO UPDATE
            SET valor = EXCLUDED.valor,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
        `,
        [CHAVE_TEMA, tema, updatedBy || null]
    );

    return tema;
}
