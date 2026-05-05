import { S3Client } from "@aws-sdk/client-s3";

// Lazily instantiated so the server boots even without storage configured.
let _s3: S3Client | null = null;

export function getS3(): S3Client {
	if (!_s3) {
		const { AWS_DEFAULT_REGION, AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } =
			process.env;
		if (!AWS_DEFAULT_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
			throw new Error(
				"Storage not configured: AWS_DEFAULT_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are required"
			);
		}
		_s3 = new S3Client({
			region: AWS_DEFAULT_REGION,
			...(AWS_ENDPOINT_URL ? { endpoint: AWS_ENDPOINT_URL } : {}),
			credentials: {
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_SECRET_ACCESS_KEY,
			},
		});
	}
	return _s3;
}

export function getBucket(): string {
	const bucket = process.env.AWS_S3_BUCKET_NAME;
	if (!bucket) throw new Error("AWS_S3_BUCKET_NAME is not configured");
	return bucket;
}

export function storageConfigured(): boolean {
	return !!(
		process.env.AWS_DEFAULT_REGION &&
		process.env.AWS_ACCESS_KEY_ID &&
		process.env.AWS_SECRET_ACCESS_KEY &&
		process.env.AWS_S3_BUCKET_NAME
	);
}
