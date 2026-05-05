import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
	server: {
		// portless injects PORT and HOST so the proxy can reach this dev server.
		// Fall back to 3000 / 127.0.0.1 when running without portless.
		port: process.env.PORT ? Number(process.env.PORT) : 3000,
		host: process.env.HOST ?? "127.0.0.1",
	},
});
