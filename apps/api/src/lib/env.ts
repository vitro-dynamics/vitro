import { type } from "arktype";

const envType = type({
	DATABASE_URL: "string.url",
	BETTER_AUTH_SECRET: "string >= 32",
	BETTER_AUTH_URL: "string.url",
	TRUSTED_ORIGINS: "string",
	RESEND_API_KEY: "string",
	RESEND_FROM_EMAIL: "string.email",
	VALKEY_URL: "string.url",
	"NODE_ENV?": "'development'|'production'|'test'",
	"LOG_LEVEL?": "'silent'|'fatal'|'error'|'warn'|'info'|'debug'|'trace'",
	// Web push — optional until the feature is enabled
	"VAPID_PUBLIC_KEY?": "string",
	"VAPID_PRIVATE_KEY?": "string",
	"VAPID_SUBJECT?": "string",
	// Email compliance
	"RESEND_WEBHOOK_SECRET?": "string",
	// SMS compliance
	"BIRD_WEBHOOK_SECRET?": "string",
	// Object storage (Railway Buckets or S3-compatible)
	"AWS_ACCESS_KEY_ID?": "string",
	"AWS_SECRET_ACCESS_KEY?": "string",
	"AWS_S3_ENDPOINT?": "string",
	"AWS_REGION?": "string",
	"AWS_S3_BUCKET?": "string",
});

const result = envType(process.env);

if (result instanceof type.errors) {
	console.error("Invalid environment configuration:");
	console.error(result.summary);
	process.exit(1);
}

export const env = result;
