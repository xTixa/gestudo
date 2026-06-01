import { db } from '../config/db.js';

/**
 * ========================================
 * ROLE MIDDLEWARE
 * ========================================
 * Verifica se o utilizador autenticado tem a role/permissão necessária
 * Consulta a tabela users para obter o role do utilizador
 *
 * Uso:
 * router.use(authMiddleware)
 * router.use(roleMiddleware('gestor'))
 *
 * Ou por rota:
 * router.get("/admin", roleMiddleware('admin'), controller)
 *
 * Resultado:
 * - Se user tem role correto: continua (next)
 * - Se user não tem role correto: retorna 403 Forbidden
 * - Se user não autenticado: retorna 401 Unauthorized
 * ========================================
 */

export function roleMiddleware(requiredRole) {
    return async (req, res, next) => {
        try {
            // Verificar se utilizador está autenticado
            if (!req.userId) {
                return res.status(401).json({
                    error: 'Autenticação necessária',
                    message: 'Faça login para aceder a este recurso',
                });
            }

            // Obter role do utilizador da BD
            const { rows } = await db.query(
                `SELECT role, status FROM users WHERE id_user = $1 LIMIT 1`,
                [req.userId]
            );

            if (!rows.length) {
                return res.status(401).json({
                    error: 'Utilizador não encontrado',
                    message: 'Utilizador não existe no sistema',
                });
            }

            const user = rows[0];

            // Verificar se utilizador está ativo
            if (user.status === false) {
                return res.status(401).json({
                    error: 'Conta desativada',
                    message:
                        'A sua conta foi desativada. Contacte o administrador',
                });
            }

            // Verificar se tem a role necessária
            if (
                String(user.role).toLowerCase() !==
                String(requiredRole).toLowerCase()
            ) {
                return res.status(403).json({
                    error: 'Permissão insuficiente',
                    message: `Apenas utilizadores com role '${requiredRole}' podem aceder a este recurso`,
                    userRole: user.role,
                    requiredRole: requiredRole,
                });
            }

            // Adicionar role a req para acesso em controladores
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

/**
 * Middleware para verificar múltiplas roles
 * Utiliza: roleMiddlewareMultiple(['admin', 'gestor'])
 */
export function roleMiddlewareMultiple(requiredRoles) {
    return async (req, res, next) => {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    error: 'Autenticação necessária',
                    message: 'Faça login para aceder a este recurso',
                });
            }

            const { rows } = await db.query(
                `SELECT role, status FROM users WHERE id_user = $1 LIMIT 1`,
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

            // Verificar se role está na lista permitida
            const hasRole = requiredRoles.some(
                (role) =>
                    String(user.role).toLowerCase() ===
                    String(role).toLowerCase()
            );

            if (!hasRole) {
                return res.status(403).json({
                    error: 'Permissão insuficiente',
                    message: `Apenas utilizadores com roles ${requiredRoles.join(', ')} podem aceder a este recurso`,
                    userRole: user.role,
                    requiredRoles: requiredRoles,
                });
            }

            req.userRole = user.role;
            next();
        } catch (error) {
            console.error(
                'Erro no middleware de role (múltiplo):',
                error.message
            );
            return res.status(500).json({
                error: 'Erro interno',
                message: 'Erro ao verificar permissões',
            });
        }
    };
}
