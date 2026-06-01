import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

// Configura o caminho para o diretório de migrações SQL, garantindo que as migrações sejam organizadas em um local específico e acessível para a aplicação
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQL_DIR = path.resolve(__dirname, '../../sql');

let startupMigrationsRan = false;

// Função para executar as migrações de inicialização, verificando se já foram executadas para evitar execuções repetidas, lendo os arquivos SQL do diretório de migrações, aplicando-os ao banco de dados e registrando quais migrações foram aplicadas, garantindo que o banco de dados esteja atualizado com as últimas alterações de esquema necessárias para a aplicação funcionar corretamente
export async function runStartupMigrations() {
    if (startupMigrationsRan) {
        return;
    }

    const entries = await readdir(SQL_DIR, { withFileTypes: true });
    const sqlFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    for (const fileName of sqlFiles) {
        const migrationPath = path.join(SQL_DIR, fileName);
        const sql = await readFile(migrationPath, 'utf8');

        if (!sql.trim()) {
            continue;
        }

        await db.query(sql);
        console.log(`[Migrations] ${fileName} aplicado.`);
    }

    startupMigrationsRan = true;
}
