import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { makeTrpcProxy, trpcClient } from "./lib/trpc";
import { routeTree } from "./routeTree.gen";

export function makeRouter() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: 30_000 } },
	});
	const trpc = makeTrpcProxy(queryClient);

	return createRouter({
		routeTree,
		context: { queryClient, trpc, trpcClient },
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof makeRouter>;
	}
}
