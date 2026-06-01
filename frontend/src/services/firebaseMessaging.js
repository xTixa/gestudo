import { registarTokenPush, removerTokenPush } from '../utils/api';
import { initializeApp } from 'firebase/app';
import {
    getMessaging,
    getToken,
    isSupported,
    onMessage,
} from 'firebase/messaging';

const TOKEN_STORAGE_KEY = 'mc_fcm_token';

let firebaseApp = null;

function getFirebaseConfig() {
    return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
}

function hasRequiredFirebaseConfig(config) {
    return Boolean(
        config.apiKey &&
        config.projectId &&
        config.messagingSenderId &&
        config.appId
    );
}

async function getOrCreateFirebaseApp() {
    if (firebaseApp) {
        return firebaseApp;
    }

    const config = getFirebaseConfig();
    if (!hasRequiredFirebaseConfig(config)) {
        return null;
    }

    firebaseApp = initializeApp(config);
    return firebaseApp;
}

function getStoredToken() {
    try {
        return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    } catch {
        return '';
    }
}

function setStoredToken(token) {
    try {
        if (!token) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            return;
        }

        localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
        // Ignora falhas de storage.
    }
}

export async function iniciarNotificacoesFirebase() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return { success: false, reason: 'not_browser' };
    }

    const app = await getOrCreateFirebaseApp();
    const vapidKey = String(
        import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
    ).trim();

    if (!app || !vapidKey) {
        return { success: false, reason: 'missing_config' };
    }

    const supported = await isSupported();
    if (!supported) {
        return { success: false, reason: 'messaging_not_supported' };
    }

    if (!('Notification' in window)) {
        return { success: false, reason: 'notifications_api_unavailable' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return { success: false, reason: 'permission_denied' };
    }

    const serviceWorkerRegistration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js'
    );

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
    });

    if (!token) {
        return { success: false, reason: 'token_unavailable' };
    }

    const previousToken = getStoredToken();
    if (previousToken !== token) {
        await registarTokenPush(token, 'web');
        setStoredToken(token);
    }

    return {
        success: true,
        token,
        unsubscribeForeground: onMessage(messaging, (payload) => {
            const title = payload?.notification?.title || 'Nova notificação';
            const body = payload?.notification?.body || '';

            if (Notification.permission === 'granted') {
                new Notification(title, { body });
            }

            window.dispatchEvent(
                new CustomEvent('mc:push-foreground', {
                    detail: {
                        payload,
                        title,
                        body,
                    },
                })
            );
        }),
    };
}

export async function removerTokenFirebaseAtual() {
    const storedToken = getStoredToken();
    if (!storedToken) {
        return;
    }

    try {
        await removerTokenPush(storedToken);
    } finally {
        setStoredToken('');
    }
}
