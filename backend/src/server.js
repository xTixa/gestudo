import './loadEnv.js';
import app from './app.js';
import {
    validateRuntimeConfig,
    printRuntimeConfigValidation,
} from './config/runtimeConfig.js';
import { runStartupMigrations } from './config/runMigrations.js';
import { startLogRetentionScheduler } from './services/logRetentionService.js';

// Valida configuração de runtime antes de iniciar o servidor
const runtimeConfigCheck = validateRuntimeConfig();
printRuntimeConfigValidation(runtimeConfigCheck);

if (!runtimeConfigCheck.ok) {
    console.error('\n[Startup] Arranque cancelado por configuração inválida.');
    process.exit(1);
}

const PORT = process.env.PORT || 5000;

// ========================================
/*
 * Middleware de autenticação:
 * - Verifica token JWT em header Authorization ou cookie mc_token
 * - Se token válido, define req.userId e req.userRole
 * - Se token ausente ou inválido, req.userId = null (rota pode ser pública)
 *
 * Formato esperado do token JWT:
 * - Payload deve conter campo "id" com ID do utilizador
 * - Opcionalmente pode conter campo "role" para o papel do utilizador
 *
 * Formas de enviar o token:
 * 1. Cookie: mc_token=<token>
 * 2. Authorization Bearer: Bearer <token> ou apenas <token>
 *
 * Resultado:
 * - req.userId: ID do utilizador autenticado (ou null se não autenticado)
 * - req.userRole: Papel do utilizador (ou null se não autenticado ou sem role)
 *
 * Notas:
 * - NÃO bloqueia requisições (continua mesmo sem autenticação)
 * - Útil para rotas que permitem ambos autenticados e não autenticados
 * ========================================
 */
async function bootstrapServer() {
    await runStartupMigrations();

    app.listen(PORT, () => {
        startLogRetentionScheduler();

        console.log(`
************************************
MediaCenter API
Servidor a correr na porta ${PORT}
Ambiente: ${process.env.NODE_ENV || 'development'}
Middlewares ativos
************************************
    `);
    });
}

// ========================================
/*
 * Middleware de autenticação:
 * - Verifica token JWT em header Authorization ou cookie mc_token
 * - Se token válido, define req.userId e req.userRole
 * - Se token ausente ou inválido, req.userId = null (rota pode ser pública)
 *
 * Formato esperado do token JWT:
 * - Payload deve conter campo "id" com ID do utilizador
 * - Opcionalmente pode conter campo "role" para o papel do utilizador
 *
 * Formas de enviar o token:
 * 1. Cookie: mc_token=<token>
 * 2. Authorization Bearer: Bearer <token> ou apenas <token>
 *
 * Resultado:
 * - req.userId: ID do utilizador autenticado (ou null se não autenticado)
 * - req.userRole: Papel do utilizador (ou null se não autenticado ou sem role)
 *
 * Notas:
 * - NÃO bloqueia requisições (continua mesmo sem autenticação)
 * - Útil para rotas que permitem ambos autenticados e não autenticados
 * ========================================
 */
bootstrapServer().catch((error) => {
    console.error('[Startup] Falha ao iniciar servidor:', error.message);
    process.exit(1);
});

export default app;
