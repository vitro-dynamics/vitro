import { prisma } from "@app/db";
import { type } from "arktype";
import { presignDownload, presignUpload } from "../../lib/uploads";
import { protectedProcedure, router } from "../trpc";

export const uploadsRouter = router({
	/**
	 * Reserve an Image row and return a presigned PUT URL.
	 * The browser PUTs the file directly to the bucket (no API proxy),
	 * then calls `confirm` to mark the row as uploaded.
	 */
	presign: protectedProcedure
		.input(
			type({
				contentType: "string",
				contentLength: "number",
			})
		)
		.mutation(async ({ input, ctx }) => {
			const { url, key } = await presignUpload({
				userId: ctx.user.id,
				contentType: input.contentType,
				contentLength: input.contentLength,
			});

			// Reserve the row before upload so orphan cleanup can find abandoned rows.
			await prisma.image.create({
				data: {
					id: key,
					userId: ctx.user.id,
					contentType: input.contentType,
					status: "pending",
				},
			});

			return { url, key };
		}),

	/**
	 * Mark the upload as complete. Call this after the browser's PUT succeeds.
	 */
	confirm: protectedProcedure.input(type({ key: "string" })).mutation(async ({ input, ctx }) => {
		await prisma.image.update({
			where: { id: input.key, userId: ctx.user.id },
			data: { status: "uploaded", uploadedAt: new Date() },
		});
		return { ok: true };
	}),

	/**
	 * Get a short-lived download URL for a private image.
	 * Cache client-side until expiry (default 1 hour).
	 */
	getUrl: protectedProcedure.input(type({ key: "string" })).query(async ({ input, ctx }) => {
		// Verify ownership before handing out a URL
		await prisma.image.findUniqueOrThrow({
			where: { id: input.key, userId: ctx.user.id },
		});
		const url = await presignDownload(input.key);
		return { url };
	}),
});
