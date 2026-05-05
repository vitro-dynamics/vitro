import { createHmac } from "node:crypto";
import { prisma } from "@app/db";
import { createLogger } from "@app/logger";

const log = createLogger("webhooks:resend");

/**
 * Resend uses Svix for webhook delivery. Verification is HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${raw-body}` with the secret decoded from base64.
 */
function verifyResendSignature(
	body: string,
	headers: Record<string, string | undefined>,
	secret: string
): boolean {
	const msgId = headers["svix-id"];
	const msgTimestamp = headers["svix-timestamp"];
	const msgSignature = headers["svix-signature"];
	if (!msgId || !msgTimestamp || !msgSignature) return false;

	const toSign = `${msgId}.${msgTimestamp}.${body}`;
	const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
	const computed = createHmac("sha256", secretBytes).update(toSign).digest("base64");

	return msgSignature.split(" ").some((sig) => {
		const [, value] = sig.split(",");
		return value === computed;
	});
}

export default defineEventHandler(async (event) => {
	const body = await readRawBody(event);
	if (!body) throw createError({ statusCode: 400, statusMessage: "Empty body" });

	const secret = process.env.RESEND_WEBHOOK_SECRET;
	if (secret) {
		const valid = verifyResendSignature(
			body,
			{
				"svix-id": getHeader(event, "svix-id"),
				"svix-timestamp": getHeader(event, "svix-timestamp"),
				"svix-signature": getHeader(event, "svix-signature"),
			},
			secret
		);
		if (!valid) throw createError({ statusCode: 401, statusMessage: "Invalid signature" });
	} else {
		log.warn("RESEND_WEBHOOK_SECRET not set — skipping signature verification");
	}

	const payload = JSON.parse(body) as {
		type?: string;
		data?: { email_id?: string; to?: string[] };
	};
	log.debug("Resend webhook received", { type: payload.type });

	// Idempotency guard
	const eventId = getHeader(event, "svix-id") ?? payload.data?.email_id ?? "";
	if (eventId) {
		const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
		if (existing) return { received: true, duplicate: true };

		await prisma.webhookEvent.create({
			data: {
				id: eventId,
				source: "resend",
				type: payload.type ?? "unknown",
				payload: payload as object,
			},
		});
	}

	const email = payload.data?.to?.[0];

	switch (payload.type) {
		case "email.bounced":
			if (email) {
				await prisma.suppressedEmail.upsert({
					where: { email },
					create: { email, reason: "hard_bounce" },
					update: { reason: "hard_bounce", suppressedAt: new Date() },
				});
				log.info("Hard bounce — email suppressed", { email });
			}
			break;

		case "email.complained":
			if (email) {
				await prisma.suppressedEmail.upsert({
					where: { email },
					create: { email, reason: "complaint" },
					update: { reason: "complaint", suppressedAt: new Date() },
				});
				log.info("Complaint — email suppressed", { email });
			}
			break;

		default:
			log.debug("Unhandled Resend event", { type: payload.type });
	}

	return { received: true };
});
