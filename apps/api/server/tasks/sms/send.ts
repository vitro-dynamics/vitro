import { prisma } from "@app/db";
import { createLogger } from "@app/logger";
import { getHours } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const log = createLogger("tasks:sms");

// Bird (formerly MessageBird) Channels API — no SDK, single POST.
// Phone numbers must be E.164 (+15551234567).
// The "from" sender is configured on the channel in Bird's dashboard.
const BIRD_API = "https://channels.bird.com/v1";

export default defineTask({
	meta: {
		name: "sms:send",
		description: "Send an SMS via Bird (formerly MessageBird) Channels API",
	},
	async run(event) {
		const payload = event.payload as {
			to: string;
			body: string;
			type?: "transactional" | "marketing";
		};
		// 1. Hard opt-out check (authoritative by phone number)
		const optedOut = await prisma.smsOptOut.findUnique({ where: { phoneNumber: payload.to } });
		if (optedOut) {
			log.info("SMS skipped — number opted out", { to: payload.to, reason: optedOut.reason });
			return { result: "opted-out" };
		}

		// 2. Quiet-hours guard for marketing messages (9am–8pm in user's local timezone)
		// Transactional messages (OTP, security, billing) are exempt.
		if (payload.type === "marketing") {
			const user = await prisma.user.findFirst({
				where: { phone: payload.to },
				select: { timezone: true },
			});
			const tz = user?.timezone;
			if (tz) {
				// date-fns-tz getHours: reads the hour in the given IANA timezone.
				// All timestamps in Postgres are UTC; this conversion is purely for
				// display/guard logic and is never persisted.
				const localHour = getHours(toZonedTime(new Date(), tz));
				if (localHour < 9 || localHour >= 20) {
					log.info("SMS blocked by quiet hours", { to: payload.to, localHour, tz });
					return { result: "quiet-hours" };
				}
			}
		}

		const { BIRD_ACCESS_KEY, BIRD_WORKSPACE_ID, BIRD_SMS_CHANNEL_ID } = process.env;

		if (!BIRD_ACCESS_KEY || !BIRD_WORKSPACE_ID || !BIRD_SMS_CHANNEL_ID) {
			log.warn("Bird SMS not configured — skipping send", { to: payload.to });
			return { result: "not-configured" };
		}

		const res = await fetch(
			`${BIRD_API}/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_SMS_CHANNEL_ID}/messages`,
			{
				method: "POST",
				headers: {
					Authorization: `AccessKey ${BIRD_ACCESS_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					receiver: { contacts: [{ identifierValue: payload.to }] },
					body: { type: "text", text: { text: payload.body } },
				}),
			}
		);

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Bird API error ${res.status}: ${text}`);
		}

		const data = (await res.json()) as { id?: string };
		log.info("SMS sent via Bird", { to: payload.to, id: data.id });
		return { result: "sent", id: data.id };
	},
});
