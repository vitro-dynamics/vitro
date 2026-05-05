import { authRouter } from "./routers/auth";
import { counterRouter } from "./routers/counter";
import { notificationsRouter } from "./routers/notifications";
import { pushRouter } from "./routers/push";
import { uploadsRouter } from "./routers/uploads";
import { router } from "./trpc";

export const appRouter = router({
	auth: authRouter,
	notifications: notificationsRouter,
	counter: counterRouter,
	push: pushRouter,
	uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
