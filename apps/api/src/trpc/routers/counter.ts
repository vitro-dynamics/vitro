import { counterStore } from "../../lib/counter";
import { publish } from "../../lib/events";
import { protectedProcedure, router } from "../trpc";

export const counterRouter = router({
	get: protectedProcedure.query(() => counterStore.get()),

	increment: protectedProcedure.mutation(() => {
		const value = counterStore.increment();
		// Broadcast to every connected client — the web app's useRealtime hook
		// will invalidate the ["counter", "get"] query on receipt.
		publish({ type: "counter.updated", data: { value } });
		return value;
	}),
});
