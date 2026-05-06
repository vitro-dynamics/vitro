import { Button } from "@app/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@app/ui/components/ui/card";
import { Input } from "@app/ui/components/ui/input";
import { Label } from "@app/ui/components/ui/label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signUp } from "~/lib/auth";

export const Route = createFileRoute("/signup")({
	component: Signup,
});

function Signup() {
	const navigate = Route.useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setPending(true);
		try {
			const fd = new FormData(e.currentTarget);
			const result = await signUp.email({
				email: fd.get("email") as string,
				password: fd.get("password") as string,
				name: fd.get("name") as string,
			});
			if (result.error) {
				setError(result.error.message ?? "Sign-up failed");
				return;
			}
			// Email verification is required — send user to login with a message
			await navigate({ to: "/login", search: { redirect: "/dashboard" } });
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Create account</CardTitle>
					<CardDescription>
						You’ll receive a verification email before you can sign in.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="name">Full name</Label>
							<Input id="name" name="name" type="text" required autoComplete="name" />
						</div>
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
								minLength={8}
								required
								autoComplete="new-password"
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" className="w-full" disabled={pending}>
							{pending ? "Creating account…" : "Create account"}
						</Button>
						<p className="text-sm text-center text-muted-foreground">
							Already have an account?{" "}
							<Link
								to="/login"
								search={{ redirect: "/dashboard" }}
								className="underline text-foreground"
							>
								Log in
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
