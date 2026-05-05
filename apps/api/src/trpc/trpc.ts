import { prisma } from "@app/db";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "../lib/auth";

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
	const session = await auth.api.getSession({ headers: req.headers });
	return {
		req,
		prisma,
		user: session?.user ?? null,
		session: session?.session ?? null,
	};
};
type Ctx = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Ctx>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.user || !ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
	// Both user and session are now non-null — narrowed by the guard above.
	return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});
