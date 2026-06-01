self.addEventListener('push', (event) => {
    if (!event.data) {
        return;
    }

    let payload = {};
    try {
        payload = event.data.json();
    } catch {
        payload = {
            notification: {
                title: 'Nova notificação',
                body: event.data.text() || '',
            },
        };
    }

    const title = payload?.notification?.title || 'Nova notificação';
    const body = payload?.notification?.body || '';
    const icon = '/favicon.ico';
    const link = payload?.data?.link || payload?.fcmOptions?.link || '/';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            data: { link },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetLink = event.notification?.data?.link || '/';

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((windows) => {
                const existing = windows.find((client) =>
                    client.url.includes(self.location.origin)
                );
                if (existing) {
                    existing.focus();
                    existing.navigate(targetLink);
                    return;
                }

                return self.clients.openWindow(targetLink);
            })
    );
});
