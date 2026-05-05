import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type AppEvent = { type: string; userId?: string; data: unknown };

// Map event types to query keys to invalidate
const INVALIDATIONS: Record<string, string[][]> = {
	"notification.created": [["notifications"]],
	"notification.read": [["notifications"]],
	"counter.updated": [["counter"]],
	"post.created": [["posts"]],
	"post.updated": [["posts"]],
	"post.deleted": [["posts"]],
};

export function useRealtime() {
	const qc = useQueryClient();

	useEffect(() => {
		const es = new EventSource(`${import.meta.env.VITE_API_URL}/api/events`, {
			withCredentials: true,
		});

		es.onmessage = (msg) => {
			const event: AppEvent = JSON.parse(msg.data);
			for (const key of INVALIDATIONS[event.type] ?? []) {
				qc.invalidateQueries({ queryKey: key });
			}
		};

		es.onerror = () => {
			// EventSource auto-reconnects with backoff; nothing to do here
		};

		return () => es.close();
	}, [qc]);
}
