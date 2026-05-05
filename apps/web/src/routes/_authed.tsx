import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "~/lib/auth";
import { useRealtime } from "~/lib/use-realtime";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const { data: session } = await authClient.getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		return { session };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	useRealtime();
	return <Outlet />;
}
