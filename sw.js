self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
self.addEventListener('notificationclick', (e) => {
	e.notification.close();
	const url = e.notification.data && e.notification.data.url ? e.notification.data.url : '/';
	e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
		const existing = windows.find((window) => 'focus' in window);
		if (existing) { existing.focus(); existing.navigate(url); }
		else if (clients.openWindow) clients.openWindow(url);
	}));
});
