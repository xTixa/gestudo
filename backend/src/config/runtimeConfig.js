// runtimeConfig.js - Validação de variáveis de ambiente para configuração de tempo de execução, garantindo que as configurações essenciais estejam presentes e sejam válidas, e fornecendo feedback claro sobre quaisquer problemas encontrados para facilitar a resolução antes do arranque da aplicação
function isNonEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

// Função para verificar se um valor é um número inteiro positivo, garantindo que as configurações numéricas sejam válidas e possam ser usadas corretamente pela aplicação
function isPositiveInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0;
}

// Função para verificar se o valor do usuário de email é um placeholder, garantindo que os desenvolvedores sejam alertados sobre a necessidade de configurar corretamente as credenciais de email para evitar problemas de envio de emails
function isPlaceholderEmailUser(value) {
    return (
        String(value || '')
            .trim()
            .toLowerCase() === 'seu_email@gmail.com'
    );
}

// Função para verificar se o valor da senha de email é um placeholder, garantindo que os desenvolvedores sejam alertados sobre a necessidade de configurar corretamente as credenciais de email para evitar problemas de envio de emails
function isPlaceholderEmailPass(value) {
    return (
        String(value || '')
            .trim()
            .toLowerCase() === 'sua_senha_de_app'
    );
}

// Função para validar a configuração de tempo de execução, verificando a presença e validade de variáveis de ambiente essenciais para o funcionamento da aplicação, como JWT, configuração de banco de dados, email e Cloudinary, e retornando um objeto com o resultado da validação, incluindo quaisquer erros ou avisos encontrados para facilitar a resolução de problemas antes do arranque da aplicação
export function validateRuntimeConfig() {
    const errors = [];
    const warnings = [];

    const nodeEnv = String(process.env.NODE_ENV || 'development').trim();

    if (!isNonEmpty(process.env.JWT_SECRET)) {
        errors.push('JWT_SECRET é obrigatório para autenticação JWT.');
    }

    if (
        isNonEmpty(process.env.JWT_EXPIRES_IN) &&
        String(process.env.JWT_EXPIRES_IN).trim().length < 2
    ) {
        errors.push('JWT_EXPIRES_IN inválido. Exemplo válido: 12h, 30m, 7d.');
    }

    const hasDatabaseUrl = isNonEmpty(process.env.DATABASE_URL);
    const hasDiscreteDbConfig = [
        process.env.DB_HOST,
        process.env.DB_PORT,
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
    ].every(isNonEmpty);

    if (!hasDatabaseUrl && !hasDiscreteDbConfig) {
        errors.push(
            'Configuração de base de dados incompleta. Defina DATABASE_URL ou o conjunto DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.'
        );
    }

    if (
        isNonEmpty(process.env.DB_PORT) &&
        !isPositiveInt(process.env.DB_PORT)
    ) {
        errors.push('DB_PORT inválido. Deve ser um número inteiro positivo.');
    }

    if (!isPositiveInt(process.env.PORT || '5000')) {
        errors.push('PORT inválido. Deve ser um número inteiro positivo.');
    }

    const emailRequired =
        String(process.env.EMAIL_REQUIRED || '').toLowerCase() === 'true' ||
        nodeEnv === 'production';

    if (emailRequired) {
        if (!isNonEmpty(process.env.EMAIL_HOST)) {
            errors.push('EMAIL_HOST é obrigatório quando EMAIL_REQUIRED=true.');
        }

        if (!isPositiveInt(process.env.EMAIL_PORT || '587')) {
            errors.push(
                'EMAIL_PORT inválido. Deve ser um número inteiro positivo.'
            );
        }

        if (
            !isNonEmpty(process.env.EMAIL_USER) ||
            isPlaceholderEmailUser(process.env.EMAIL_USER)
        ) {
            errors.push('EMAIL_USER não configurado corretamente.');
        }

        if (
            !isNonEmpty(process.env.EMAIL_PASSWORD) ||
            isPlaceholderEmailPass(process.env.EMAIL_PASSWORD)
        ) {
            errors.push('EMAIL_PASSWORD não configurado corretamente.');
        }

        if (!isNonEmpty(process.env.APP_URL)) {
            errors.push('APP_URL é obrigatório para links de email.');
        }
    } else {
        warnings.push(
            'EMAIL_REQUIRED=false: envio de emails pode ficar indisponível sem bloquear o arranque.'
        );
    }

    if (nodeEnv === 'production' && !isNonEmpty(process.env.FRONTEND_URL)) {
        warnings.push(
            'FRONTEND_URL não definido em produção. CORS pode bloquear o frontend.'
        );
    }

    const cloudinaryValues = {
        cloudName: isNonEmpty(process.env.CLOUDINARY_CLOUD_NAME),
        apiKey: isNonEmpty(process.env.CLOUDINARY_API_KEY),
        apiSecret: isNonEmpty(process.env.CLOUDINARY_API_SECRET),
    };

    const cloudinaryAnySet =
        cloudinaryValues.cloudName ||
        cloudinaryValues.apiKey ||
        cloudinaryValues.apiSecret;
    const cloudinaryAllSet =
        cloudinaryValues.cloudName &&
        cloudinaryValues.apiKey &&
        cloudinaryValues.apiSecret;

    if (cloudinaryAnySet && !cloudinaryAllSet) {
        warnings.push(
            'Configuração Cloudinary incompleta. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.'
        );
    }

    const hasEmailLogoPublicId =
        isNonEmpty(process.env.EMAIL_LOGO_PUBLIC_ID) ||
        isNonEmpty(process.env.CLOUDINARY_LOGO_PUBLIC_ID);
    const hasEmailLogoUrl = isNonEmpty(process.env.EMAIL_LOGO_URL);

    if (hasEmailLogoPublicId && !cloudinaryAllSet) {
        warnings.push(
            'EMAIL_LOGO_PUBLIC_ID/CLOUDINARY_LOGO_PUBLIC_ID definido sem credenciais Cloudinary completas; fallback para URL manual pode ser necessário.'
        );
    }

    if (!hasEmailLogoPublicId && !hasEmailLogoUrl) {
        warnings.push(
            'Logo de email não configurado. Defina EMAIL_LOGO_URL ou EMAIL_LOGO_PUBLIC_ID para personalizar o cabeçalho dos emails.'
        );
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
    };
}

// Função para imprimir os resultados da validação de configuração de tempo de execução, exibindo claramente quaisquer erros ou avisos encontrados durante a validação para facilitar a resolução de problemas antes do arranque da aplicação
export function printRuntimeConfigValidation(validationResult) {
    const { errors, warnings } = validationResult;

    if (warnings.length) {
        console.warn('\n[Config] Avisos de configuração:');
        warnings.forEach((warning) => console.warn(` - ${warning}`));
    }

    if (errors.length) {
        console.error('\n[Config] Erros de configuração:');
        errors.forEach((error) => console.error(` - ${error}`));
    }
}
