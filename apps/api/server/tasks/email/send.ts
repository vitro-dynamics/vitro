import { createLogger } from "@app/logger";
import nodemailer from "nodemailer";
import { Resend } from "resend";

const log = createLogger("tasks:email");
const isProd = process.env.NODE_ENV === "production";

const resend = isProd && process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const mailpit = !isProd
	? nodemailer.createTransport({ host: "localhost", port: 1025, secure: false })
	: null;

export default defineTask({
	meta: {
		name: "email:send",
		description: "Send a transactional email via Resend (prod) or Mailpit (dev)",
	},
	async run(event) {
		const payload = event.payload as { to: string; subject: string; html: string; text?: string };
		const from = process.env.RESEND_FROM_EMAIL ?? "dev@localhost";

		if (resend) {
			const result = await resend.emails.send({
				from,
				to: payload.to,
				subject: payload.subject,
				html: payload.html,
				text: payload.text ?? stripHtml(payload.html),
			});

			if (result.error) throw new Error(result.error.message);
			log.info("Email sent via Resend", { to: payload.to, id: result.data?.id });
			return { result: "sent", id: result.data?.id };
		}

		if (!mailpit) throw new Error("Mailpit transport not initialized");
		await mailpit.sendMail({
			from,
			to: payload.to,
			subject: payload.subject,
			html: payload.html,
			text: payload.text ?? stripHtml(payload.html),
		});
		log.info("Email sent to Mailpit", { to: payload.to });
		return { result: "sent-dev" };
	},
});

function stripHtml(html: string) {
	return html.replace(/<[^>]+>/g, "").trim();
}
