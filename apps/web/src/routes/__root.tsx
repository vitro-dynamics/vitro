import type { AppRouter } from "@app/trpc";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { TRPCClient } from "@trpc/client";
import type { makeTrpcProxy } from "~/lib/trpc";

interface RouterContext {
	queryClient: QueryClient;
	trpc: ReturnType<typeof makeTrpcProxy>;
	trpcClient: TRPCClient<AppRouter>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => <Outlet />,
});
