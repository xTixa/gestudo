import { runStartupMigrations } from '../src/config/runMigrations.js';
import { runLogRetentionCleanup } from '../src/services/logRetentionService.js';

async function main() {
    await runStartupMigrations();
    const result = await runLogRetentionCleanup();
    console.log(
        `[Logs] Limpeza manual concluída: ${result.deleted} removidos.`
    );
}

main().catch((error) => {
    console.error('[Logs] Limpeza manual falhou:', error.message);
    process.exit(1);
});
