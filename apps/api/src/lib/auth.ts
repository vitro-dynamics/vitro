import { prisma } from "@app/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { runTask } from "nitropack/runtime";

export const auth = betterAuth({
	database: prismaAdapter(prisma, { provider: "postgresql" }),
	trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "").split(",").filter(Boolean),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await runTask("email:send", {
				payload: {
					to: user.email,
					subject: "Reset your password",
					html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
				},
			});
		},
	},

	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await runTask("email:send", {
				payload: {
					to: user.email,
					subject: "Verify your email",
					html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
				},
			});
		},
	},

	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		defaultCookieAttributes: {
			sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
			secure: process.env.NODE_ENV === "production",
			partitioned: process.env.NODE_ENV === "production",
		},
	},
});
