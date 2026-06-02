const fs = require('fs');
const path = require('path');
const log = (msg) =>
    fs.appendFileSync(path.resolve(__dirname, '../debug.log'), msg + '\n');
fs.writeFileSync(path.resolve(__dirname, '../debug.log'), '');

async function test() {
    log('1 - a importar runtimeConfig...');
    await import('./config/runtimeConfig.js');
    log('2 - a importar db...');
    await import('./config/db.js');
    log('3 - a importar securityMiddleware...');
    await import('./middlewares/securityMiddleware.js');
    log('4 - a importar authMiddleware...');
    await import('./middlewares/authMiddleware.js');
    log('5 - a importar app...');
    await import('./app.js');
    log('6 - a importar server...');
    await import('./server.js');
    log('TUDO OK');
}

test().catch((err) => {
    log('ERRO: ' + err.message);
    log(err.stack);
    process.exit(1);
});
