import { prisma } from "@app/db";
import { createLogger } from "@app/logger";
import { runTask } from "nitropack/runtime";
import { publish } from "./events";

const log = createLogger("api:notify");

export type NotificationPayload = {
	push?: { title: string; body: string; tag: string; data?: Record<string, unknown> };
	sms?: { body: string };
	email?: { subject: string; html: string; text?: string };
};

export async function notify(opts: {
	userId: string;
	type: string;
	title: string;
	body: string;
	data?: Record<string, unknown>;
	payload?: NotificationPayload;
}) {
	// 1. real-time first (cheap, fire-and-forget)
	publish({
		type: opts.type,
		userId: opts.userId,
		data: { title: opts.title, body: opts.body, ...opts.data },
	});

	// 2. persist for the inbox
	const notification = await prisma.notification.create({
		data: {
			userId: opts.userId,
			type: opts.type,
			title: opts.title,
			body: opts.body,
			data: JSON.parse(JSON.stringify(opts.data ?? {})),
		},
	});

	// 3. fan out to channels via tasks (queued, retryable)
	const prefs = await prisma.notificationPreference.findUnique({
		where: { userId: opts.userId },
	});

	// Fetch user once if any outbound channel needs it — avoids duplicate DB round-trips.
	const needsUser =
		(opts.payload?.email && prefs?.emailOptIn !== false) || (opts.payload?.sms && prefs?.smsOptIn);

	const user = needsUser
		? await prisma.user.findUniqueOrThrow({
				where: { id: opts.userId },
				select: { email: true, phone: true },
			})
		: null;

	if (opts.payload?.email && prefs?.emailOptIn !== false && user) {
		const suppressed = await prisma.suppressedEmail.findUnique({ where: { email: user.email } });
		if (suppressed) {
			log.info("Email suppressed — skipping send", {
				email: user.email,
				reason: suppressed.reason,
			});
		} else {
			await runTask("email:send", { payload: { to: user.email, ...opts.payload.email } });
		}
	}

	if (opts.payload?.sms && prefs?.smsOptIn && user?.phone) {
		await runTask("sms:send", { payload: { to: user.phone, body: opts.payload.sms.body } });
	}

	if (opts.payload?.push && prefs?.pushOptIn !== false) {
		await runTask("push:send", {
			payload: {
				userId: opts.userId,
				title: opts.payload.push.title,
				body: opts.payload.push.body,
				url:
					typeof opts.payload.push.data?.url === "string" ? opts.payload.push.data.url : undefined,
				tag: opts.payload.push.tag,
			},
		});
	}

	return notification;
}
