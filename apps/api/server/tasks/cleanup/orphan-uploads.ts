import { prisma } from "@app/db";
import { createLogger } from "@app/logger";
import { subDays } from "date-fns";

const log = createLogger("tasks:cleanup");

export default defineTask({
	meta: {
		name: "cleanup:orphan-uploads",
		description:
			"Delete Image rows stuck in 'pending' for > 24h (user abandoned the upload UI). Runs daily.",
	},
	async run() {
		// subDays operates on UTC; Prisma stores all datetimes as UTC. No tz conversion needed.
		const cutoff = subDays(new Date(), 1);
		const result = await prisma.image.deleteMany({
			where: { status: "pending", createdAt: { lt: cutoff } },
		});
		log.info("Orphan uploads cleaned up", { deleted: result.count });
		return { result: "ok", deleted: result.count };
	},
});
