import {
    getInscricaoTextosMap,
    listInscricaoTextos,
    resetInscricaoTexto,
    updateInscricaoTextos,
} from '../services/inscricaoFormTextosService.js';

export async function listarInscricaoTextos(req, res) {
    try {
        const textos = await listInscricaoTextos();
        return res.json({ textos });
    } catch (error) {
        console.error('Erro ao listar textos do formulário de inscrição:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao listar textos do formulário de inscrição.' });
    }
}

export async function atualizarInscricaoTextos(req, res) {
    try {
        const updates = req.body?.updates || {};
        const textos = await updateInscricaoTextos(updates, req.userId ?? null);
        return res.json({ textos });
    } catch (error) {
        console.error('Erro ao atualizar textos do formulário de inscrição:', error);
        return res.status(error.status || 500).json({
            message:
                error.message ||
                'Erro ao atualizar textos do formulário de inscrição.',
        });
    }
}

export async function reporInscricaoTexto(req, res) {
    try {
        const texto = await resetInscricaoTexto(req.params.key, req.userId ?? null);

        if (!texto) {
            return res
                .status(404)
                .json({ message: 'Texto não encontrado.' });
        }

        return res.json({ texto });
    } catch (error) {
        console.error('Erro ao repor texto do formulário de inscrição:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao repor texto do formulário de inscrição.' });
    }
}

export async function obterInscricaoTextosPublico(req, res) {
    try {
        const textos = await getInscricaoTextosMap();
        return res.json({ textos });
    } catch (error) {
        console.error('Erro ao obter textos públicos de inscrição:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao obter textos do formulário de inscrição.' });
    }
}
