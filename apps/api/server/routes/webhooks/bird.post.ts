import { createHmac } from "node:crypto";
import { prisma } from "@app/db";
import { createLogger } from "@app/logger";

const log = createLogger("webhooks:bird");

const STOP_KEYWORDS = new Set(["STOP", "END", "CANCEL", "UNSUBSCRIBE", "QUIT"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

const STOP_REPLY =
	"You've been unsubscribed from all messages. Reply HELP for help. No further messages will be sent.";

const HELP_REPLY =
	"Help: Reply STOP to unsubscribe. Msg & data rates may apply. Contact support@example.com.";

/** Bird HMAC-SHA256 signature verification. */
function verifyBirdSignature(body: string, signature: string | undefined, secret: string): boolean {
	if (!signature) return false;
	const computed = createHmac("sha256", secret).update(body).digest("hex");
	return computed === signature;
}

/** Send a reply via Bird Channels API. */
async function sendReply(to: string, body: string) {
	const { BIRD_ACCESS_KEY, BIRD_WORKSPACE_ID, BIRD_SMS_CHANNEL_ID } = process.env;
	if (!BIRD_ACCESS_KEY || !BIRD_WORKSPACE_ID || !BIRD_SMS_CHANNEL_ID) return;

	await fetch(
		`https://channels.bird.com/v1/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_SMS_CHANNEL_ID}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `AccessKey ${BIRD_ACCESS_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				receiver: { contacts: [{ identifierValue: to }] },
				body: { type: "text", text: { text: body } },
			}),
		}
	);
}

export default defineEventHandler(async (event) => {
	const body = await readRawBody(event);
	if (!body) throw createError({ statusCode: 400, statusMessage: "Empty body" });

	const secret = process.env.BIRD_WEBHOOK_SECRET;
	if (secret) {
		const signature = getHeader(event, "x-bird-signature");
		if (!verifyBirdSignature(body, signature, secret)) {
			throw createError({ statusCode: 401, statusMessage: "Invalid signature" });
		}
	} else {
		log.warn("BIRD_WEBHOOK_SECRET not set — skipping signature verification");
	}

	const payload = JSON.parse(body) as {
		type?: string;
		data?: { from?: string; body?: string };
	};

	const from = payload.data?.from; // E.164 number of the sender
	const text = payload.data?.body?.trim().toUpperCase() ?? "";

	log.debug("Bird webhook received", { type: payload.type, from, text });

	if (!from || payload.type !== "message.received") {
		return { received: true };
	}

	if (STOP_KEYWORDS.has(text)) {
		// Insert into SmsOptOut (authoritative) and flip user preference
		await prisma.smsOptOut.upsert({
			where: { phoneNumber: from },
			create: { phoneNumber: from, reason: "stop_keyword" },
			update: { reason: "stop_keyword", optedOutAt: new Date() },
		});

		// Best-effort: also flip smsOptIn on any matching user
		await prisma.user.updateMany({
			where: { phone: from },
			data: { updatedAt: new Date() }, // updatedAt touch; smsOptIn lives on NotificationPreference
		});
		await prisma.notificationPreference.updateMany({
			where: { user: { phone: from } },
			data: { smsOptIn: false },
		});

		// TCPA-mandated confirmation reply (send even to opted-out numbers — just this once)
		await sendReply(from, STOP_REPLY);
		log.info("SMS opt-out processed", { from });
	} else if (HELP_KEYWORDS.has(text)) {
		await sendReply(from, HELP_REPLY);
		log.debug("SMS help reply sent", { from });
	}

	return { received: true };
});
