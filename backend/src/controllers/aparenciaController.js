import {
    definirTemaCentro,
    obterTemaCentro,
} from '../services/aparenciaService.js';

// Público: a app lê a cor do centro ao arrancar, para todos os papéis.
export async function obterAparencia(req, res) {
    const tema = await obterTemaCentro();
    return res.json({ tema });
}

export async function atualizarAparencia(req, res) {
    try {
        const tema = await definirTemaCentro(req.body?.tema, req.userId ?? null);
        return res.json({ tema });
    } catch (error) {
        if (!error.status) {
            console.error('Erro ao atualizar a aparência:', error);
        }
        return res.status(error.status || 500).json({
            message: error.status
                ? error.message
                : 'Erro ao guardar a cor do tema.',
        });
    }
}
