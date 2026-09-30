import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

// Configura o caminho para o diretório de migrações SQL, garantindo que as migrações sejam organizadas em um local específico e acessível para a aplicação
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQL_DIR = path.resolve(__dirname, '../../sql');

// Chave arbitrária do advisory lock: impede que duas instâncias da API
// apliquem migrações em simultâneo.
const MIGRATIONS_LOCK_KEY = 7429001;

let startupMigrationsRan = false;

function checksumOf(sql) {
    return createHash('sha256').update(sql).digest('hex');
}

async function listMigrationFiles() {
    const entries = await readdir(SQL_DIR, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

/**
 * Aplica apenas as migrações ainda não registadas em gestudo_migrations,
 * cada uma na sua transação. Uma migração já aplicada cujo conteúdo mudou
 * não volta a correr — é só avisado, porque alterar uma migração aplicada
 * deve ser feito com um ficheiro novo.
 */
export async function runStartupMigrations() {
    if (startupMigrationsRan) {
        return;
    }

    const client = await db.connect();
    try {
        await client.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK_KEY]);

        await client.query(`
            CREATE TABLE IF NOT EXISTS public.gestudo_migrations (
                filename TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        const { rows } = await client.query(
            'SELECT filename, checksum FROM public.gestudo_migrations'
        );
        const applied = new Map(rows.map((row) => [row.filename, row.checksum]));

        let appliedCount = 0;
        for (const fileName of await listMigrationFiles()) {
            const sql = await readFile(path.join(SQL_DIR, fileName), 'utf8');
            const checksum = checksumOf(sql);

            if (applied.has(fileName)) {
                if (applied.get(fileName) !== checksum) {
                    console.warn(
                        `[Migrations] ${fileName} foi alterado depois de aplicado; ignorado. Crie uma nova migração para alterações de schema.`
                    );
                }
                continue;
            }

            try {
                await client.query('BEGIN');
                if (sql.trim()) {
                    await client.query(sql);
                }
                await client.query(
                    'INSERT INTO public.gestudo_migrations (filename, checksum) VALUES ($1, $2)',
                    [fileName, checksum]
                );
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                error.message = `Migração ${fileName} falhou: ${error.message}`;
                throw error;
            }

            appliedCount += 1;
            console.log(`[Migrations] ${fileName} aplicado.`);
        }

        if (appliedCount === 0) {
            console.log('[Migrations] Base de dados atualizada, nada a aplicar.');
        }
    } finally {
        await client
            .query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK_KEY])
            .catch(() => {});
        client.release();
    }

    startupMigrationsRan = true;
}
