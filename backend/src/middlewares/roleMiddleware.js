import { db } from '../config/db.js';

/**
 * ========================================
 * ROLE MIDDLEWARE
 * ========================================
 * Confirma na base de dados que a sessão continua válida e, opcionalmente,
 * que o utilizador tem uma das roles pedidas.
 *
 * A sessão é inválida se o utilizador não existir, estiver desativado ou se
 * o token_version da BD for diferente do "tv" do JWT (password alterada,
 * redefinida ou reposta pelo gestor depois de o token ser emitido).
 *
 * Uso:
 * router.use(authMiddleware)
 * router.use(roleMiddleware('gestor'))
 * router.use(roleMiddlewareMultiple(['gestor', 'professor']))
 * router.use(requireSession())      // qualquer utilizador autenticado
 * ========================================
 */

function verificarSessao(requiredRoles) {
    const roles = requiredRoles.map((role) => String(role).toLowerCase());

    return async (req, res, next) => {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    error: 'Autenticação necessária',
                    message: 'Faça login para aceder a este recurso',
                });
            }

            const { rows } = await db.query(
                `SELECT role, status, token_version FROM users WHERE id_user = $1 LIMIT 1`,
                [req.userId]
            );

            if (!rows.length) {
                return res.status(401).json({
                    error: 'Utilizador não encontrado',
                    message: 'Utilizador não existe no sistema',
                });
            }

            const user = rows[0];

            if (user.status === false) {
                return res.status(401).json({
                    error: 'Conta desativada',
                    message:
                        'A sua conta foi desativada. Contacte o administrador',
                });
            }

            if (Number(user.token_version || 0) !== (req.tokenVersion || 0)) {
                return res.status(401).json({
                    error: 'Sessão terminada',
                    message:
                        'A sua sessão terminou porque a password foi alterada. Faça login novamente.',
                });
            }

            if (
                roles.length &&
                !roles.includes(String(user.role).toLowerCase())
            ) {
                return res.status(403).json({
                    error: 'Permissão insuficiente',
                    message: 'Não tem permissão para aceder a este recurso',
                });
            }

            req.userRole = user.role;
            next();
        } catch (error) {
            console.error('Erro no middleware de role:', error.message);
            return res.status(500).json({
                error: 'Erro interno',
                message: 'Erro ao verificar permissões',
            });
        }
    };
}

export function roleMiddleware(requiredRole) {
    return verificarSessao([requiredRole]);
}

export function roleMiddlewareMultiple(requiredRoles) {
    return verificarSessao(requiredRoles);
}

export function requireSession() {
    return verificarSessao([]);
}
