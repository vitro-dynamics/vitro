import { protectedProcedure, router } from "../trpc";

export const authRouter = router({
	// Better Auth handles most flows at /api/auth/*
	// Add user-facing queries/mutations here as needed
	me: protectedProcedure.query(({ ctx }) => ctx.user),
});
