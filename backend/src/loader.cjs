process.on('uncaughtException', (err) => {
    console.error('ERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
});

import('./server.js').catch((err) => {
    console.error('ERRO NO IMPORT:', err.message);
    console.error(err.stack);
    process.exit(1);
});
