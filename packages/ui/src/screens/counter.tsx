/**
 * CounterScreen — shared presentation component.
 *
 * Lives in packages/ui so both apps can render the same UI:
 *   - apps/web  → imported by the TanStack Router route (useSuspenseQuery feeds it)
 *   - apps/mobile → imported by the "use dom" wrapper (native shell feeds it via props)
 *
 * No data fetching. No routing. No platform APIs.
 * Receives everything it needs as props.
 */
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

type Props = {
	count: number;
	isPending: boolean;
	/**
	 * Called when the user taps Increment.
	 * May be sync (web mutation) or async (mobile bridge RPC) — both are fine.
	 */
	onIncrement: () => void | Promise<void>;
};

export function CounterScreen({ count, isPending, onIncrement }: Props) {
	return (
		<div className="min-h-screen flex items-center justify-center p-6 bg-background">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-2">
						<Badge variant="outline" className="font-mono text-xs">
							shared screen · web + mobile
						</Badge>
					</div>
					<CardTitle className="text-7xl font-bold tabular-nums tracking-tight">{count}</CardTitle>
					<CardDescription>
						On web: SSE pushes updates to every open tab. On mobile: haptic feedback fires on each
						tap via the native bridge.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Button
						size="lg"
						className="w-full"
						disabled={isPending}
						onClick={async () => await onIncrement()}
					>
						{isPending ? "Incrementing…" : "Increment"}
					</Button>
					<p className="text-center text-xs text-muted-foreground font-mono">
						packages/ui/src/screens/counter.tsx
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
