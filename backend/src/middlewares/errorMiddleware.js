/**
 * ========================================
 * ERROR HANDLING MIDDLEWARE
 * ========================================
 * Middleware para tratamento de erros 404, 500 e outros
 *
 * IMPORTANTE: Este middleware deve ser registado POR ÚLTIMO no server.js
 *
 * Uso em server.js:
 * --------
 * // ... rotas ...
 * app.use(notFoundHandler);     // Deve ser antes do errorHandler
 * app.use(errorHandler);        // Deve ser o último middleware
 *
 * Padrão Express: error handlers têm 4 parâmetros (err, req, res, next)
 *
 * ========================================
 */

/**
 * Middleware 404 - Rota não encontrada
 * Retorna erro 404 JSON quando nenhuma rota corresponde
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        code: 'NOT_FOUND',
        message: `${req.method} ${req.path} não existe neste servidor`,
        details: {
            method: req.method,
            path: req.path,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
    });
}

/**
 * Middleware de tratamento de erros global
 * Captura todos os erros lançados nas rotas/controllers
 *
 * IMPORTANTE: Deve ser o último middleware registado em app.use()
 *
 * Sintaxe: (err, req, res, next) com 4 parâmetros
 */
export function errorHandler(err, req, res, next) {
    // Log do erro no console para debugging
    console.error('ERROR:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: err.status || 500,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    // Status code do erro (default 500)
    const status = err.status || err.statusCode || 500;
    const code =
        err.code ||
        (status === 400
            ? 'BAD_REQUEST'
            : status === 401
              ? 'UNAUTHORIZED'
              : status === 403
                ? 'FORBIDDEN'
                : status === 404
                  ? 'NOT_FOUND'
                  : 'INTERNAL_SERVER_ERROR');
    const isDatabaseError =
        err.message?.includes('database') || err.message?.includes('query');

    // Resposta de erro
    const response = {
        code,
        message:
            status === 500
                ? isDatabaseError
                    ? 'Erro ao processar pedido do banco de dados'
                    : 'Erro interno no servidor'
                : err.message || 'Algo correu mal',
        details: err.details || null,
        timestamp: new Date().toISOString(),
        path: req.path,
    };

    // Em desenvolvimento, incluir stack trace
    if (process.env.NODE_ENV === 'development') {
        response.details = {
            ...(response.details || {}),
            stack: err.stack,
            name: err.name,
        };
    }

    // Enviar resposta
    res.status(status).json(response);
}

/**
 * Wrapper para controllers - converte erros síncronos/assincronos
 * Permite controllers usar async/await sem try-catch manual
 *
 * Uso:
 * router.get("/", catchAsync(controllerFunction));
 *
 * Exemplo:
 * router.get("/alunos", catchAsync(async (req, res) => {
 *   const data = await db.query(...);
 *   res.json(data);  // Se DB erro, é automaticamente catchado
 * }));
 */
export function catchAsync(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Factory function para criar erros customizados
 *
 * Uso:
 * if (!user) return next(createError(404, "Utilizador não encontrado"));
 * if (!hasPermission) return next(createError(403, "Sem permissões"));
 */
export function createError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}
