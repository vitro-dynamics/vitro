import { createLogger } from "@app/logger";

const log = createLogger("api:counter");

// In-memory for the demo. Swap for a DB row when persistence matters.
let value = 0;

export const counterStore = {
	get(): number {
		return value;
	},
	increment(): number {
		value += 1;
		log.debug("Counter incremented", { value });
		return value;
	},
};
