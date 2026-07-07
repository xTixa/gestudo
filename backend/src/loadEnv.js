import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

// Carrega o .env a partir da pasta backend/ (onde este ficheiro vive), não a
// partir do cwd do processo. Process managers como o Passenger podem
// arrancar o Node a partir de uma pasta de trabalho diferente da raiz da
// aplicação, fazendo o dotenv/config (que usa process.cwd() por omissão)
// falhar a encontrar o .env em silêncio e deixar variáveis obrigatórias
// (ex: JWT_SECRET, DATABASE_URL) vazias — o que faz a app fechar-se logo
// no arranque sem erro visível.
//
// Tem de ser importado em primeiro lugar, antes de qualquer módulo que leia
// process.env (ex: app.js, db.js), para que os imports (hoisted) desses
// módulos só sejam avaliados depois deste ficheiro correr.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
