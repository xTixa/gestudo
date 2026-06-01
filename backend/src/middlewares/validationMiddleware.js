/**
 * ========================================
 * VALIDATION MIDDLEWARE
 * ========================================
 * Validação de dados de entrada (query, body, params)
 *
 * Uso:
 * router.post("/novo", validateBody({...schema}), controller)
 * router.get("/:id", validateParams({id: 'number'}), controller)
 * router.get("/", validateQuery({from: 'string', limit: 'number'}), controller)
 *
 * ========================================
 */

/**
 * Valida campos obrigatórios no body
 * Retorna erro 400 se faltarem campos
 */
export function validateBody(schema) {
    return (req, res, next) => {
        const errors = [];

        Object.entries(schema).forEach(([field, options]) => {
            const value = req.body?.[field];
            const {
                type = 'string',
                required = false,
                min,
                max,
                enum: allowedValues,
            } = options;

            // Verificar obrigatoriedade
            if (
                required &&
                (value === undefined || value === null || value === '')
            ) {
                errors.push(`Campo obrigatório: ${field}`);
                return;
            }

            // Se não obrigatório e não fornecido, skip
            if (
                !required &&
                (value === undefined || value === null || value === '')
            ) {
                return;
            }

            // Validar tipo
            if (type === 'string' && typeof value !== 'string') {
                errors.push(`${field}: deve ser texto`);
            } else if (type === 'number' && isNaN(Number(value))) {
                errors.push(`${field}: deve ser número`);
            } else if (
                type === 'boolean' &&
                typeof value !== 'boolean' &&
                value !== 'true' &&
                value !== 'false'
            ) {
                errors.push(`${field}: deve ser booleano`);
            } else if (type === 'email' && !String(value).includes('@')) {
                errors.push(`${field}: email inválido`);
            }

            // Validar comprimento
            if (type === 'string' && min && value.length < min) {
                errors.push(`${field}: mínimo ${min} caracteres`);
            }
            if (type === 'string' && max && value.length > max) {
                errors.push(`${field}: máximo ${max} caracteres`);
            }

            if (Array.isArray(allowedValues) && allowedValues.length > 0) {
                const normalizedValue = String(value).toLowerCase().trim();
                const normalizedAllowed = allowedValues.map((item) =>
                    String(item).toLowerCase().trim()
                );

                if (!normalizedAllowed.includes(normalizedValue)) {
                    errors.push(
                        `${field}: valor inválido (permitidos: ${allowedValues.join(', ')})`
                    );
                }
            }
        });

        if (errors.length > 0) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Os dados fornecidos contêm erros',
                details: {
                    scope: 'body',
                    errors,
                },
                timestamp: new Date().toISOString(),
                path: req.path,
            });
        }

        next();
    };
}

/**
 * Valida parâmetros da URL (/rota/:id/:slug)
 */
export function validateParams(schema) {
    return (req, res, next) => {
        const errors = [];

        Object.entries(schema).forEach(([param, type]) => {
            const value = req.params[param];

            if (!value) {
                errors.push(`Parâmetro obrigatório: ${param}`);
                return;
            }

            if (type === 'number' && isNaN(Number(value))) {
                errors.push(`${param}: deve ser número`);
            } else if (type === 'uuid' && !value.match(/^[0-9a-f\-]{36}$/i)) {
                errors.push(`${param}: UUID inválido`);
            }
        });

        if (errors.length > 0) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Os parâmetros da URL contêm erros',
                details: {
                    scope: 'params',
                    errors,
                },
                timestamp: new Date().toISOString(),
                path: req.path,
            });
        }

        next();
    };
}

/**
 * Valida query string (?from=value&to=value)
 */
export function validateQuery(schema) {
    return (req, res, next) => {
        const errors = [];

        Object.entries(schema).forEach(([field, options]) => {
            const value = req.query?.[field];
            const {
                type = 'string',
                required = false,
                pattern,
                enum: allowedValues,
            } = options;

            // Verificar obrigatoriedade
            if (required && (value === undefined || value === '')) {
                errors.push(`Query obrigatória: ${field}`);
                return;
            }

            // Se não obrigatória e não fornecida, skip
            if (!required && (value === undefined || value === '')) {
                return;
            }

            // Validar tipo
            if (type === 'number' && isNaN(Number(value))) {
                errors.push(`${field}: deve ser número`);
            } else if (type === 'date' && !isValidDate(value)) {
                errors.push(`${field}: data inválida (formato: YYYY-MM-DD)`);
            }

            // Validar padrão regex
            if (pattern && !pattern.test(value)) {
                errors.push(`${field}: formato inválido`);
            }

            if (Array.isArray(allowedValues) && allowedValues.length > 0) {
                const normalizedValue = String(value).toLowerCase().trim();
                const normalizedAllowed = allowedValues.map((item) =>
                    String(item).toLowerCase().trim()
                );

                if (!normalizedAllowed.includes(normalizedValue)) {
                    errors.push(
                        `${field}: valor inválido (permitidos: ${allowedValues.join(', ')})`
                    );
                }
            }
        });

        if (errors.length > 0) {
            return res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Os parâmetros da query contêm erros',
                details: {
                    scope: 'query',
                    errors,
                },
                timestamp: new Date().toISOString(),
                path: req.path,
            });
        }

        next();
    };
}

/**
 * Validador de data ISO (YYYY-MM-DD)
 */
function isValidDate(dateString) {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}
