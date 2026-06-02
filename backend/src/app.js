import express from 'express';
import { authMiddleware } from './middlewares/authMiddleware.js';
import {
    corsMiddleware,
    securityHeadersMiddleware,
    rateLimitMiddleware,
    loggingMiddleware,
    sanitizeInputMiddleware,
    csrfProtectionMiddleware,
} from './middlewares/securityMiddleware.js';
import {
    notFoundHandler,
    errorHandler,
} from './middlewares/errorMiddleware.js';
import { verificarMatriculaAtiva } from './middlewares/matriculaMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import gestorRoutes from './routes/gestorRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import alunoRoutes from './routes/alunoRoutes.js';
import professorRoutes from './routes/professorRoutes.js';
import notificacoesRoutes from './routes/notificacoesRoutes.js';
import alertasRoutes from './routes/alertasRoutes.js';
import buscaRoutes from './routes/buscaRoutes.js';
import { db } from './config/db.js';

const app = express();

app.set('trust proxy', 1);

// 1) CORS PRIMEIRO
app.use(corsMiddleware());
app.options('*', corsMiddleware());

// 2) Segurança e rate limit
app.use(securityHeadersMiddleware());
app.use(loggingMiddleware());
app.use(rateLimitMiddleware(500, 15));

// 3) Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInputMiddleware());

// 4) Auth (não bloqueia)
app.use(authMiddleware);

// Rota de teste simples para verificar se a API está online e responder com informações básicas sobre a versão e status. Útil para monitoramento e health checks.
app.get('/', (req, res) => {
    res.json({
        message: 'API MediaCenter',
        version: '1.0.0',
        status: 'online',
    });
});

// Rota de health check para verificar a conectividade com a base de dados. Retorna um status 200 se a conexão for bem-sucedida, ou um status 500 com detalhes do erro se houver falha na conexão.
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            ok: true,
            db: 'connected',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({
            code: 'HEALTHCHECK_DB_ERROR',
            message: 'Falha no healthcheck da base de dados.',
            details: {
                db: 'error',
                reason: error.message,
            },
            timestamp: new Date().toISOString(),
            path: req.path,
        });
    }
});

app.use('/api/auth', authRoutes); // Autenticação (pública)
app.use('/api/public', publicRoutes); // Endpoints públicos

app.use(csrfProtectionMiddleware()); // Proteção CSRF para rotas autenticadas

app.use('/api/aluno', verificarMatriculaAtiva, alunoRoutes); // Perfil do aluno (role aluno)
app.use('/api/professor', professorRoutes); // Área do professor (role professor)
app.use('/api/busca', buscaRoutes); // Busca global (autenticada)
app.use('/api/gestor', gestorRoutes); // Admin only (roleMiddleware aplicado na rota)
app.use('/api/notificacoes', notificacoesRoutes); // Notificações (auth + role verificati)
app.use('/api/alertas', alertasRoutes); // Alertas (catalog público, preferências autenticadas)

app.use(notFoundHandler); // 404 - Rota não encontrada
app.use(errorHandler); // Erro global

export default app;
