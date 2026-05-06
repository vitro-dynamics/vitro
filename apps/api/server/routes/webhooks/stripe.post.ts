import { prisma } from "@app/db";
import { runTask } from "nitropack/runtime";
import Stripe from "stripe";

// Lazy client — only constructed when the first webhook arrives.
// Avoids crashing the server at startup when Stripe keys aren't yet configured.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
	if (!_stripe) {
		const key = process.env.STRIPE_SECRET_KEY;
		if (!key) throw createError({ statusCode: 503, statusMessage: "Stripe not configured" });
		_stripe = new Stripe(key);
	}
	return _stripe;
}

export default defineEventHandler(async (event) => {
	const stripe = getStripe();
	const body = await readRawBody(event);
	const sig = getHeader(event, "stripe-signature");

	if (!body || !sig) throw createError({ statusCode: 400, statusMessage: "Missing signature" });

	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret)
		throw createError({ statusCode: 503, statusMessage: "Stripe webhook not configured" });

	let stripeEvent: Stripe.Event;
	try {
		stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret);
	} catch {
		throw createError({ statusCode: 400, statusMessage: "Invalid signature" });
	}

	// Idempotency: skip if already received
	const existing = await prisma.webhookEvent.findUnique({ where: { id: stripeEvent.id } });
	if (existing) return { received: true, duplicate: true };

	await prisma.webhookEvent.create({
		data: {
			id: stripeEvent.id,
			source: "stripe",
			type: stripeEvent.type,
			payload: JSON.parse(JSON.stringify(stripeEvent)),
		},
	});

	await runTask("webhook:stripe", { payload: { eventId: stripeEvent.id } });

	return { received: true };
});
