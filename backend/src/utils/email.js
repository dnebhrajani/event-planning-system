import nodemailer from "nodemailer";

/**
 * Build the nodemailer transporter from environment variables.
 * Throws if SMTP config is missing.
 */
function createTransporter() {
    const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
    const SMTP_PORT = process.env.SMTP_PORT || 465;
    const { SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_USER || !SMTP_PASS) {
        throw new Error(
            "SMTP credentials missing. Set SMTP_USER and SMTP_PASS in .env or Render dashboard"
        );
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
}

/**
 * Send an email.
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
export async function sendMail({ to, subject, text, html }) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!from) {
        throw new Error("SMTP_FROM (or SMTP_USER) must be set in .env");
    }

    const transporter = createTransporter();
    const info = await transporter.sendMail({ from, to, subject, text, html });
    return info;
}
