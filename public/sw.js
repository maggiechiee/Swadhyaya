// Service Worker for Swadhyaya push notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Swadhyāya';
  const options = {
    body: data.body || 'Time to check in.',
    icon: '/namaste.png',
    badge: '/namaste.png',
    tag: data.tag || 'swadhyaya-reminder',
    data: { url: data.url || '/' },
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
