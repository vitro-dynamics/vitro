// Service worker for web push notifications.
// This file must be at the site root (/sw.js) so it controls the full origin scope.
// Vite copies everything in public/ verbatim into the build output.

// Take control immediately on install so updates apply without the user
// having to close all tabs.
self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	if (!event.data) return;

	let data;
	try {
		data = event.data.json();
	} catch {
		return;
	}

	const { title, body, url, tag } = data;

	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			tag, // Same tag replaces an existing notification instead of stacking
			icon: "/icon-192.png",
			badge: "/badge-72.png",
			data: { url: url || "/" },
		})
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url || "/";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
			// Focus an existing tab on the right URL rather than opening a new one
			for (const client of clients) {
				if (client.url.endsWith(url) && "focus" in client) {
					return client.focus();
				}
			}
			return self.clients.openWindow(url);
		})
	);
});
