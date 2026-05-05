import { prisma } from "@app/db";
import { createLogger } from "@app/logger";

const log = createLogger("tasks:cleanup");

export default defineTask({
	meta: {
		name: "cleanup:expired-sessions",
		description: "Delete expired Better Auth sessions (runs daily at 3am)",
	},
	async run() {
		// new Date() is always UTC; expiresAt is stored as UTC by Prisma — no conversion needed.
		const now = new Date();
		const result = await prisma.session.deleteMany({
			where: { expiresAt: { lt: now } },
		});
		log.info("Cleaned up expired sessions", { deleted: result.count });
		return { result: "ok", deleted: result.count };
	},
});
