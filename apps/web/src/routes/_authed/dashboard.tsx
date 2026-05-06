import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTRPC } from "~/lib/trpc";

export const Route = createFileRoute("/_authed/dashboard")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(context.trpc.notifications.list.queryOptions()),
	component: Dashboard,
});

function Dashboard() {
	const trpc = useTRPC();
	const opts = trpc.notifications.list.queryOptions();
	const { data } = useSuspenseQuery(opts);

	return (
		<div className="p-6">
			<h1 className="text-2xl font-bold mb-4">Dashboard</h1>
			{data.length === 0 ? (
				<p className="text-muted-foreground">No notifications yet.</p>
			) : (
				<ul className="space-y-2">
					{data.map((n: { id: string; title: string; body: string }) => (
						<li key={n.id} className="p-4 border rounded-md bg-card">
							<p className="font-medium">{n.title}</p>
							<p className="text-sm text-muted-foreground">{n.body}</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
