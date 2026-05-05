import { createLogger } from "@app/logger";
import Redis from "ioredis";

const log = createLogger("api:events");

export type AppEvent<T = unknown> = {
	type: string;
	userId?: string;
	data: T;
};

const CHANNEL = "app:events";
type Handler = (e: AppEvent) => void;
const handlers = new Set<Handler>();

// Lazy clients — not created at module load so the server can start
// without VALKEY_URL (e.g. during build or test). Connections are
// established the first time publish() or subscribe() is called.
let _publisher: Redis | null = null;
let _subscriber: Redis | null = null;

function getPublisher(): Redis {
	if (!_publisher) {
		const url = process.env.VALKEY_URL;
		if (!url) throw new Error("VALKEY_URL is required for pub/sub");
		_publisher = new Redis(url);
		_publisher.on("error", (err) => log.error("Valkey publisher error", { err: err.message }));
	}
	return _publisher;
}

function getSubscriber(): Redis {
	if (!_subscriber) {
		const url = process.env.VALKEY_URL;
		if (!url) throw new Error("VALKEY_URL is required for pub/sub");
		_subscriber = new Redis(url);
		_subscriber.on("error", (err) => log.error("Valkey subscriber error", { err: err.message }));
		_subscriber.subscribe(CHANNEL, (err) => {
			if (err) log.error("Failed to subscribe to event channel", { err: err.message });
		});
		_subscriber.on("message", (_channel: string, message: string) => {
			let event: AppEvent;
			try {
				event = JSON.parse(message);
			} catch {
				log.warn("Received malformed event on channel", { message });
				return;
			}
			for (const handler of handlers) {
				handler(event);
			}
		});
	}
	return _subscriber;
}

export function publish(event: AppEvent): void {
	getPublisher()
		.publish(CHANNEL, JSON.stringify(event))
		.catch((err: Error) => {
			log.error("Failed to publish event", { err: err.message });
		});
}

export function subscribe(handler: Handler): () => void {
	getSubscriber(); // ensure subscriber is connected
	handlers.add(handler);
	return () => handlers.delete(handler);
}
