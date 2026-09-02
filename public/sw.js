self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
self.addEventListener('push', (e) => {
	let data = {};
	try { data = e.data ? e.data.json() : {}; } catch (err) {}
	const title = data.title || '새 사고가 등록되었습니다';
	e.waitUntil(self.registration.showNotification(title, {
		body: data.body || '',
		tag: data.tag,
		data: { url: data.url || '/' },
	}));
});
self.addEventListener('notificationclick', (e) => {
	e.notification.close();
	const url = e.notification.data && e.notification.data.url ? e.notification.data.url : '/';
	e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
		const existing = windows.find((window) => 'focus' in window);
		if (existing) { existing.focus(); existing.navigate(url); }
		else if (clients.openWindow) clients.openWindow(url);
	}));
});
