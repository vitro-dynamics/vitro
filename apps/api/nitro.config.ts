// Port is assigned by portless in dev; in production Railway injects PORT.
export default defineNitroConfig({
	compatibilityDate: "2026-05-05",
	srcDir: "server",
	experimental: {
		tasks: true,
	},
	scheduledTasks: {
		"0 3 * * *": ["cleanup:expired-sessions"],
		"0 4 * * *": ["cleanup:orphan-uploads"],
	},
	runtimeConfig: {},
	// Keep Prisma runtime and pg adapter as external node_modules.
	// @app/db itself is bundled (its TS source is inlined by Rollup),
	// but its heavy deps must not be bundled — they rely on native bindings.
	rollupConfig: {
		external: ["@prisma/client", "@prisma/adapter-pg", "pg-native"],
	},
});
