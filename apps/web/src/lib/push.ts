import { trpcClient } from "./trpc";

function urlBase64ToUint8Array(base64: string) {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Returns true if the current browser supports push notifications. */
export function pushSupported(): boolean {
	return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Returns the current push subscription status without requesting permission.
 * Safe to call on page load to sync the UI toggle.
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
	if (!pushSupported()) return null;
	const reg = await navigator.serviceWorker.getRegistration();
	return reg?.pushManager.getSubscription() ?? null;
}

/**
 * Request permission, subscribe to push, and persist the subscription to the API.
 *
 * Never call this on page load — only call it in response to a user gesture.
 * Browsers will permanently block the permission prompt if you abuse it.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
	if (!pushSupported()) throw new Error("Push not supported in this browser");

	const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
	if (!vapidKey) throw new Error("VITE_VAPID_PUBLIC_KEY is not configured");

	const reg = await navigator.serviceWorker.register("/sw.js");
	await navigator.serviceWorker.ready;

	const permission = await Notification.requestPermission();
	if (permission !== "granted") throw new Error("Notification permission denied");

	const sub = await reg.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidKey),
	});

	const json = sub.toJSON();
	// PushSubscription.toJSON() guarantees endpoint and keys when subscribed.
	// Validate explicitly so we surface a clear error rather than a runtime crash.
	const { endpoint, keys } = json;
	if (!endpoint || !keys?.p256dh || !keys?.auth) {
		throw new Error("Push subscription is missing required fields (endpoint / keys)");
	}
	await trpcClient.push.subscribe.mutate({
		endpoint,
		keys: { p256dh: keys.p256dh, auth: keys.auth },
		userAgent: navigator.userAgent,
	});

	return sub;
}

/**
 * Unsubscribe from push and remove the subscription from the API.
 */
export async function unsubscribeFromPush(): Promise<void> {
	const reg = await navigator.serviceWorker.getRegistration();
	const sub = await reg?.pushManager.getSubscription();
	if (!sub) return;

	await trpcClient.push.unsubscribe.mutate({ endpoint: sub.endpoint });
	await sub.unsubscribe();
}
