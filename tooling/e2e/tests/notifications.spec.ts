import { expect, test } from "@playwright/test";

// Notifications tests require an authenticated session.
// TODO: Add a test fixture that logs in with a seeded test account.
test.describe("notifications", () => {
	test.skip("dashboard shows empty state when no notifications", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page.getByText("No notifications yet.")).toBeVisible();
	});
});
