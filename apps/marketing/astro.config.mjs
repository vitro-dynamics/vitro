import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
	},
	server: {
		// portless injects PORT and HOST so the proxy can reach this dev server.
		// Fall back to 4321 / 127.0.0.1 when running without portless.
		port: process.env.PORT ? Number(process.env.PORT) : 4321,
		host: process.env.HOST ?? "127.0.0.1",
	},
});
