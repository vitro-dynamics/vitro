import { prisma } from "@app/db";
import { type } from "arktype";
import { protectedProcedure, router } from "../trpc";

export const pushRouter = router({
	subscribe: protectedProcedure
		.input(
			type({
				endpoint: "string",
				keys: { p256dh: "string", auth: "string" },
				"userAgent?": "string",
			})
		)
		.mutation(async ({ input, ctx }) => {
			await prisma.pushSubscription.upsert({
				where: { endpoint: input.endpoint },
				create: {
					endpoint: input.endpoint,
					keys: input.keys,
					userAgent: input.userAgent,
					userId: ctx.user.id,
				},
				update: {
					// Re-subscribing from the same browser updates keys and ownership.
					// This handles the "user logs out, logs back in as different user" case.
					keys: input.keys,
					userId: ctx.user.id,
				},
			});
			return { ok: true };
		}),

	unsubscribe: protectedProcedure
		.input(type({ endpoint: "string" }))
		.mutation(async ({ input, ctx }) => {
			await prisma.pushSubscription.deleteMany({
				where: { endpoint: input.endpoint, userId: ctx.user.id },
			});
			return { ok: true };
		}),
});
