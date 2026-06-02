import('./server.js').catch((err) => {
    console.error('Erro ao arrancar:', err);
    process.exit(1);
});
