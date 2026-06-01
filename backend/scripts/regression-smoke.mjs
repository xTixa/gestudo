import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function readJson(relativePath) {
    const raw = await readFile(path.join(rootDir, relativePath), 'utf8');
    return JSON.parse(raw);
}

async function assertFile(relativePath) {
    await access(path.join(rootDir, relativePath));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const packageJson = await readJson('package.json');

assert(
    packageJson.type === 'module',
    'backend/package.json deve continuar configurado como ES modules.'
);
assert(
    packageJson.scripts?.['security:sast'],
    'Script security:sast em falta.'
);

await Promise.all([
    assertFile('src/app.js'),
    assertFile('src/server.js'),
    assertFile('src/middlewares/authMiddleware.js'),
    assertFile('src/middlewares/securityMiddleware.js'),
    assertFile('src/controllers/presencasController.js'),
    assertFile('scripts/security-sast.mjs'),
]);

const appSource = await readFile(path.join(rootDir, 'src/app.js'), 'utf8');
assert(
    appSource.includes("app.use('/api/auth'"),
    'Rota /api/auth nao encontrada em src/app.js.'
);
assert(
    appSource.includes("app.use('/api/gestor'"),
    'Rota /api/gestor nao encontrada em src/app.js.'
);
assert(
    appSource.includes("app.use('/api/professor'"),
    'Rota /api/professor nao encontrada em src/app.js.'
);

console.log('[regression-smoke] Verificacoes basicas passaram.');
