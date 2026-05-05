import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "https://app.vitro.localhost";
const isCI = !!process.env.CI;

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 2 : undefined,
	reporter: isCI
		? [["html", { open: "never" }], ["github"]]
		: [["list"], ["html", { open: "on-failure" }]],
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
