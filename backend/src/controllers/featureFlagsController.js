import {
    getFeatureFlagsMap,
    listFeatureFlags,
    setFeatureFlag,
} from '../services/featureFlagsService.js';

export async function listarFeatureFlags(req, res) {
    try {
        const flags = await listFeatureFlags();
        return res.json({ flags });
    } catch (error) {
        console.error('Erro ao listar feature flags:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao listar feature flags.' });
    }
}

export async function atualizarFeatureFlag(req, res) {
    try {
        const flag = await setFeatureFlag(
            req.params.key,
            req.body?.ativo,
            req.userId ?? null
        );

        if (!flag) {
            return res.status(404).json({ message: 'Flag não encontrada.' });
        }

        return res.json({ flag });
    } catch (error) {
        console.error('Erro ao atualizar feature flag:', error);
        return res.status(error.status || 500).json({
            message: error.message || 'Erro ao atualizar feature flag.',
        });
    }
}

export async function obterFeatureFlagsPublico(req, res) {
    try {
        const flags = await getFeatureFlagsMap();
        return res.json({ flags });
    } catch (error) {
        console.error('Erro ao obter feature flags públicas:', error);
        return res
            .status(500)
            .json({ message: 'Erro ao obter feature flags.' });
    }
}
