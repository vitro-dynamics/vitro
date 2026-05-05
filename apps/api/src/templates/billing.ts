import type { NotificationPayload } from "../lib/notify";

export const billing = {
	paymentFailed: (amount: number): NotificationPayload => ({
		email: {
			subject: "Payment failed",
			html: `<p>We couldn't process your payment of $${amount}. Please update your payment method.</p>`,
		},
		sms: {
			body: `Payment of $${amount} failed. Update your card to avoid service interruption.`,
		},
	}),
};
