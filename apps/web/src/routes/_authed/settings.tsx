import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@app/ui/components/ui/card";
import { Label } from "@app/ui/components/ui/label";
import { Separator } from "@app/ui/components/ui/separator";
import { Switch } from "@app/ui/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	getPushSubscription,
	pushSupported,
	subscribeToPush,
	unsubscribeFromPush,
} from "~/lib/push";

export const Route = createFileRoute("/_authed/settings")({
	component: Settings,
});

function Settings() {
	const [pushEnabled, setPushEnabled] = useState(false);
	const [pushLoading, setPushLoading] = useState(true);
	const [pushError, setPushError] = useState<string | null>(null);

	// Read current subscription state on mount — no permission prompt
	useEffect(() => {
		getPushSubscription()
			.then((sub) => setPushEnabled(!!sub))
			.finally(() => setPushLoading(false));
	}, []);

	async function handlePushToggle(on: boolean) {
		setPushError(null);
		try {
			if (on) {
				await subscribeToPush();
			} else {
				await unsubscribeFromPush();
			}
			setPushEnabled(on);
		} catch (err) {
			setPushError(err instanceof Error ? err.message : "Something went wrong");
		}
	}

	return (
		<div className="p-6 max-w-lg">
			<h1 className="text-2xl font-bold mb-6">Settings</h1>

			<Card>
				<CardHeader>
					<CardTitle>Notifications</CardTitle>
					<CardDescription>
						Choose how you want to be notified. Push notifications only work in browsers that
						support the Web Push API (not iOS Safari unless you've added this site to your home
						screen).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="push-toggle">Push notifications</Label>
							<p className="text-sm text-muted-foreground">
								Receive browser notifications even when the tab is closed.
							</p>
						</div>
						<Switch
							id="push-toggle"
							checked={pushEnabled}
							disabled={pushLoading || !pushSupported()}
							onCheckedChange={handlePushToggle}
						/>
					</div>

					{!pushSupported() && (
						<p className="text-xs text-muted-foreground">
							Push notifications are not supported in this browser.
						</p>
					)}

					{pushError && <p className="text-xs text-destructive">{pushError}</p>}

					<Separator />

					<p className="text-xs text-muted-foreground">
						Turning on notifications will ask for browser permission. You can revoke it at any time
						from your browser settings.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
