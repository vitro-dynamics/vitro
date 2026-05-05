import { Resend } from "resend";

// Lazily constructed — only defined when RESEND_API_KEY is present.
// In dev, email:send routes through Mailpit instead.
export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
