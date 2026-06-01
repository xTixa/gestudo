import { db } from '../config/db.js';

function getPlatform(value) {
    const normalized = String(value || 'web')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return 'web';
    }

    return normalized.slice(0, 30);
}

export async function registarDeviceToken(req, res) {
    try {
        const idUser = req.userId;
        const token = String(req.body?.token || '').trim();
        const plataforma = getPlatform(req.body?.plataforma);

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        if (!token || token.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Token FCM inválido',
            });
        }

        const query = `
      INSERT INTO notificacoes_device_tokens (
        id_user,
        token,
        plataforma,
        ativo,
        ultimo_registo_em
      )
      VALUES ($1, $2, $3, true, NOW())
      ON CONFLICT (token)
      DO UPDATE SET
        id_user = EXCLUDED.id_user,
        plataforma = EXCLUDED.plataforma,
        ativo = true,
        ultimo_registo_em = NOW(),
        updated_at = NOW()
      RETURNING id_notificacao_device_token, id_user, plataforma, ativo, ultimo_registo_em
    `;

        const { rows } = await db.query(query, [idUser, token, plataforma]);

        return res.status(200).json({
            success: true,
            message: 'Token registado com sucesso',
            data: rows[0] || null,
        });
    } catch (error) {
        console.error(
            '[notificacoesController] registarDeviceToken error:',
            error.message
        );
        return res.status(500).json({
            success: false,
            message: 'Erro ao registar token de notificações',
        });
    }
}

export async function removerDeviceToken(req, res) {
    try {
        const idUser = req.userId;
        const token = String(req.body?.token || '').trim();

        if (!idUser) {
            return res.status(401).json({
                success: false,
                message: 'Utilizador não autenticado',
            });
        }

        if (!token || token.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Token FCM inválido',
            });
        }

        const query = `
      UPDATE notificacoes_device_tokens
      SET ativo = false,
          updated_at = NOW()
      WHERE id_user = $1
        AND token = $2
      RETURNING id_notificacao_device_token
    `;

        const { rowCount } = await db.query(query, [idUser, token]);

        return res.status(200).json({
            success: true,
            removed: rowCount,
        });
    } catch (error) {
        console.error(
            '[notificacoesController] removerDeviceToken error:',
            error.message
        );
        return res.status(500).json({
            success: false,
            message: 'Erro ao remover token de notificações',
        });
    }
}
