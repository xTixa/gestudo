// Corre antes de qualquer import da aplicação. O loadEnv.js não sobrepõe
// variáveis já definidas no .env, por isso estes valores prevalecem e
// garantem que os testes nunca tocam na base de dados real.
// Atenção: o .env.local é carregado com override e ganharia a estes valores.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.GESTUDO_PLANO = 'completo';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.DATABASE_URL = '';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_NAME = 'gestudo_test_sem_bd';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_SSL = 'false';
