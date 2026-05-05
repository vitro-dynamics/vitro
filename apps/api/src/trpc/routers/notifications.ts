import { type } from "arktype";
import { publish } from "../../lib/events";
import { protectedProcedure, router } from "../trpc";

export const notificationsRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.prisma.notification.findMany({
			where: { userId: ctx.user.id },
			orderBy: { createdAt: "desc" },
			take: 50,
		})
	),

	markRead: protectedProcedure.input(type({ id: "string" })).mutation(async ({ ctx, input }) => {
		const n = await ctx.prisma.notification.update({
			where: { id: input.id, userId: ctx.user.id },
			data: { readAt: new Date() },
		});
		publish({ type: "notification.read", userId: ctx.user.id, data: { id: n.id } });
		return n;
	}),
});
