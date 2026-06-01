import { createRequire } from 'node:module';

// Serviço para integração com Firebase Admin SDK, usado principalmente para envio de notificações push via FCM
const require = createRequire(import.meta.url);

let admin = null;

// Tenta carregar o módulo firebase-admin, mas não falha se não estiver instalado. Isso permite que o serviço seja usado mesmo sem a dependência, apenas desativando as funcionalidades relacionadas ao Firebase.
try {
    admin = require('firebase-admin');
} catch (error) {
    console.warn(
        '[firebaseAdminService] firebase-admin indisponível. Push ficará desativado até instalar dependência.',
        error.message
    );
}

let initialized = false;

// Função para extrair as credenciais do Firebase a partir das variáveis de ambiente, suportando tanto um JSON completo quanto as partes individuais (project_id, client_email, private_key)
function parseServiceAccountFromEnv() {
    const rawJson = String(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
    ).trim();

    if (rawJson) {
        try {
            return JSON.parse(rawJson);
        } catch (error) {
            console.warn(
                '[firebaseAdminService] FIREBASE_SERVICE_ACCOUNT_JSON inválido:',
                error.message
            );
            return null;
        }
    }

    const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();

    if (!projectId || !clientEmail || !privateKeyRaw) {
        return null;
    }

    return {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKeyRaw.replace(/\\n/g, '\n'),
    };
}

// Função para garantir que o Firebase Admin SDK esteja inicializado antes de usar qualquer funcionalidade relacionada. Retorna true se estiver pronto para uso, ou false se não estiver configurado corretamente.
function ensureInitialized() {
    if (!admin) {
        return false;
    }

    if (initialized || admin.apps.length > 0) {
        initialized = true;
        return true;
    }

    const credentials = parseServiceAccountFromEnv();
    if (!credentials) {
        return false;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
        });
        initialized = true;
        return true;
    } catch (error) {
        console.error(
            '[firebaseAdminService] Erro ao inicializar Firebase:',
            error.message
        );
        initialized = false;
        return false;
    }
}

// Função para obter a instância do Firebase Messaging, ou null se o Firebase não estiver configurado corretamente
export function getFirebaseMessaging() {
    if (!ensureInitialized()) {
        return null;
    }

    return admin.messaging();
}

export function isFirebaseConfigured() {
    return ensureInitialized();
}
