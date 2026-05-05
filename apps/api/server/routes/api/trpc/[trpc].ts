import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../../../src/trpc/router";
import { createContext } from "../../../../src/trpc/trpc";

export default defineEventHandler((event) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req: toWebRequest(event),
		router: appRouter,
		createContext,
	})
);
