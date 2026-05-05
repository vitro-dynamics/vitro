import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucket, getS3 } from "./storage";

const ALLOWED_TYPES = /^image\/(jpeg|png|webp|gif)$/;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Generate a short-lived presigned URL that lets the browser PUT a file
 * directly to the bucket — no proxying through the API.
 *
 * The caller should then call the `uploads.confirm` mutation once the PUT
 * succeeds to mark the Image row as `uploaded`.
 */
export async function presignUpload(opts: {
	userId: string;
	contentType: string;
	contentLength: number;
}): Promise<{ url: string; key: string }> {
	if (opts.contentLength > MAX_BYTES) {
		throw new Error(`File too large — maximum is ${MAX_BYTES / 1024 / 1024}MB`);
	}
	if (!ALLOWED_TYPES.test(opts.contentType)) {
		throw new Error(`Unsupported content type: ${opts.contentType}`);
	}

	const key = `users/${opts.userId}/${crypto.randomUUID()}`;
	const command = new PutObjectCommand({
		Bucket: getBucket(),
		Key: key,
		ContentType: opts.contentType,
		ContentLength: opts.contentLength,
	});

	const url = await getSignedUrl(getS3(), command, { expiresIn: 60 * 5 }); // 5 min
	return { url, key };
}

/**
 * Generate a presigned GET URL for serving a private object to the client.
 * Cache the URL client-side until it expires — don't call this on every render.
 */
export async function presignDownload(key: string, expiresIn = 60 * 60): Promise<string> {
	const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
	return getSignedUrl(getS3(), command, { expiresIn });
}
