import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TRPCProvider, trpcClient } from "./lib/trpc";
import { makeRouter } from "./router";
import "./index.css";

const router = makeRouter();
const queryClient = router.options.context.queryClient;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in index.html");

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				<RouterProvider router={router} />
			</TRPCProvider>
		</QueryClientProvider>
	</StrictMode>
);
