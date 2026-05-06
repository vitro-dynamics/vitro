import { prisma } from "@app/db";
import { createLogger } from "@app/logger";
import type Stripe from "stripe";
import { notify } from "../../../src/lib/notify";
import { billing } from "../../../src/templates/billing";

const log = createLogger("tasks:webhook:stripe");

export default defineTask({
	meta: {
		name: "webhook:stripe",
		description: "Process a persisted Stripe webhook event",
	},
	async run(taskEvent) {
		const payload = taskEvent.payload as { eventId: string };
		const record = await prisma.webhookEvent.findUniqueOrThrow({
			where: { id: payload.eventId },
		});
		if (record.processedAt) return { result: "already-processed" };

		// Prisma stores the event as JSON; roundtrip to satisfy TS boundary
		const stripeEvent = JSON.parse(JSON.stringify(record.payload)) as Stripe.Event;
		log.debug("Processing Stripe event", { type: stripeEvent.type, id: record.id });

		switch (stripeEvent.type) {
			case "invoice.payment_failed": {
				const invoice = stripeEvent.data.object as Stripe.Invoice;
				const userId = invoice.metadata?.userId;
				const amount = (invoice.amount_due ?? 0) / 100;
				if (userId) {
					await notify({
						userId,
						type: "billing.payment_failed",
						title: "Payment failed",
						body: `We couldn't process your payment of $${amount}.`,
						payload: billing.paymentFailed(amount),
					});
				}
				break;
			}
			default:
				log.debug("Unhandled Stripe event type", { type: stripeEvent.type });
		}

		await prisma.webhookEvent.update({
			where: { id: record.id },
			data: { processedAt: new Date() },
		});

		return { result: "ok" };
	},
});
