import { S3Client } from "@aws-sdk/client-s3";

// Lazily instantiated so the server boots even without storage configured.
let _s3: S3Client | null = null;

export function getS3(): S3Client {
	if (!_s3) {
		const { AWS_REGION, AWS_S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
		if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
			throw new Error(
				"Storage not configured: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are required"
			);
		}
		_s3 = new S3Client({
			region: AWS_REGION,
			...(AWS_S3_ENDPOINT ? { endpoint: AWS_S3_ENDPOINT } : {}),
			credentials: {
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_SECRET_ACCESS_KEY,
			},
		});
	}
	return _s3;
}

export function getBucket(): string {
	const bucket = process.env.AWS_S3_BUCKET;
	if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
	return bucket;
}

export function storageConfigured(): boolean {
	return !!(
		process.env.AWS_REGION &&
		process.env.AWS_ACCESS_KEY_ID &&
		process.env.AWS_SECRET_ACCESS_KEY &&
		process.env.AWS_S3_BUCKET
	);
}
