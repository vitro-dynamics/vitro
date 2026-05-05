import type { AppRouter } from "@app/trpc";
import type { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext, createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${import.meta.env.VITE_API_URL}/api/trpc`,
			fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
		}),
	],
});

export const makeTrpcProxy = (queryClient: QueryClient) =>
	createTRPCOptionsProxy({ client: trpcClient, queryClient });
