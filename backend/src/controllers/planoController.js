import { getPlanSummary, getPlanUsage } from '../config/plans.js';

// Público: módulos incluídos no pacote (usado pelo frontend para esconder
// menus e pelo formulário público de inscrição).
export function obterPlanoPublico(req, res) {
    return res.json(getPlanSummary());
}

// Gestor: pacote + utilização atual face aos limites.
export async function obterPlanoGestor(req, res) {
    try {
        const uso = await getPlanUsage();
        return res.json({ ...getPlanSummary(), uso });
    } catch (error) {
        console.error('Erro ao obter plano:', error);
        return res.status(500).json({ message: 'Erro ao obter o pacote contratado.' });
    }
}
