import { Button } from "@app/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@app/ui/components/ui/card";
import { Input } from "@app/ui/components/ui/input";
import { Label } from "@app/ui/components/ui/label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signIn } from "~/lib/auth";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		// Preserve the URL the user was trying to visit so we can redirect back
		redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
	}),
	component: Login,
});

function Login() {
	const { redirect } = Route.useSearch();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setPending(true);
		try {
			const fd = new FormData(e.currentTarget);
			const result = await signIn.email({
				email: fd.get("email") as string,
				password: fd.get("password") as string,
			});
			if (result.error) {
				setError(result.error.message ?? "Sign-in failed");
				return;
			}
			// Navigate back to where the user was, or dashboard.
			// Use window.location so TanStack Router doesn't need to know about
			// arbitrary paths that may have originated outside the router.
			window.location.href = redirect;
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Log in</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input id="email" name="email" type="email" required autoComplete="email" />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								required
								autoComplete="current-password"
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={pending}>
							{pending ? "Signing in…" : "Log in"}
						</Button>
						<p className="text-sm text-center text-muted-foreground">
							Don’t have an account?{" "}
							<Link to="/signup" className="underline text-foreground">
								Sign up
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
