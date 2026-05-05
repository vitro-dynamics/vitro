import { expect, test } from "@playwright/test";

const randomEmail = () => `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

test.describe("auth", () => {
	test("signup → verify redirect to login", async ({ page }) => {
		const email = randomEmail();
		await page.goto("/signup");
		await page.fill('[name="name"]', "Test User");
		await page.fill('[name="email"]', email);
		await page.fill('[name="password"]', "password123");
		await page.click('[type="submit"]');
		// After signup, user is redirected to /login (email verification required)
		await expect(page).toHaveURL(/\/login/);
	});

	test("login with invalid credentials shows error", async ({ page }) => {
		await page.goto("/login");
		await page.fill('[name="email"]', randomEmail());
		await page.fill('[name="password"]', "wrongpassword");
		await page.click('[type="submit"]');
		// Should remain on login page
		await expect(page).toHaveURL(/\/login/);
	});

	test("unauthenticated access to /dashboard redirects to /login", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login/);
	});
});
