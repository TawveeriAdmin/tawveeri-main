// Tawveeri Web Push Service Worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Tawveeri', body: event.data.text() };
  }

  const { title, body, icon, data, dir, lang, tag } = payload;

  const options = {
    body: body || '',
    icon: icon || '/images/favicon.ico',
    data: data || {},
    dir: dir || 'ltr',
    lang: lang || 'en',
    tag: tag || undefined,
    badge: '/images/favicon.ico',
  };

  event.waitUntil(self.registration.showNotification(title || 'Tawveeri', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
