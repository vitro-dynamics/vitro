import { prisma } from "@app/db";
import { createLogger } from "@app/logger";
import webpush from "web-push";

const log = createLogger("tasks:push");

// VAPID credentials are set once at module init. If they're missing the task
// will skip gracefully — feature is gated by the presence of env vars.
if (process.env.VAPID_SUBJECT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT,
		process.env.VAPID_PUBLIC_KEY,
		process.env.VAPID_PRIVATE_KEY
	);
}

type Payload = {
	userId: string;
	title: string;
	body: string;
	url?: string;
	tag?: string;
};

export default defineTask({
	meta: {
		name: "push:send",
		description: "Fan out a web push notification to all of a user's browser subscriptions",
	},
	async run(event) {
		const payload = event.payload as Payload;
		if (!process.env.VAPID_PUBLIC_KEY) {
			log.debug("VAPID keys not configured — skipping push send", { userId: payload.userId });
			return { result: "not-configured" };
		}

		const subs = await prisma.pushSubscription.findMany({
			where: { userId: payload.userId },
		});

		if (subs.length === 0) return { result: "no-subscriptions" };

		const message = JSON.stringify({
			title: payload.title,
			body: payload.body,
			url: payload.url ?? "/",
			tag: payload.tag,
		});

		const results = await Promise.allSettled(
			subs.map((sub) =>
				webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: sub.keys as { p256dh: string; auth: string },
					},
					message
				)
			)
		);

		// 404/410 = subscription is dead. Clean up so we stop trying.
		const expired: string[] = [];
		results.forEach((r, i) => {
			if (r.status === "rejected") {
				const sub = subs[i];
				// r.reason is the raw rejection value from the web-push library.
				const reason = r.reason as { statusCode?: number } | undefined;
				const code = reason?.statusCode;
				if (code === 404 || code === 410) {
					if (sub) expired.push(sub.endpoint);
				} else {
					log.error("push send failed", { endpoint: sub?.endpoint, err: reason });
				}
			}
		});

		if (expired.length > 0) {
			await prisma.pushSubscription.deleteMany({
				where: { endpoint: { in: expired } },
			});
			log.info("cleaned up dead subscriptions", { count: expired.length });
		}

		log.info("push sent", {
			userId: payload.userId,
			attempted: subs.length,
			expired: expired.length,
		});
		return { result: "sent", attempted: subs.length, expired: expired.length };
	},
});
