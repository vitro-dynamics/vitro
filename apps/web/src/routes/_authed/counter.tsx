import { CounterScreen } from "@app/ui/screens/counter";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTRPC } from "~/lib/trpc";

// Data fetching lives here, not inside CounterScreen.
// This keeps the shared screen component pure and reusable on mobile.
export const Route = createFileRoute("/_authed/counter")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(context.trpc.counter.get.queryOptions()),
	component: CounterPage,
});

function CounterPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: count } = useSuspenseQuery(trpc.counter.get.queryOptions());
	const increment = useMutation(
		trpc.counter.increment.mutationOptions({
			onSuccess: (newValue) => {
				// Optimistic local update; SSE will re-invalidate all other tabs.
				queryClient.setQueryData(trpc.counter.get.queryOptions().queryKey, newValue);
			},
		})
	);

	return (
		<CounterScreen
			count={count}
			isPending={increment.isPending}
			onIncrement={() => increment.mutate()}
		/>
	);
}
