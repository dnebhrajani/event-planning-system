/**
 * Stub mailer – sends real email when SMTP is configured,
 * silently succeeds otherwise.
 */
import nodemailer from "nodemailer";

let transporter = null;

if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

export async function sendMail({ to, subject, text, html }) {
    if (!transporter) {
        console.log(`[mailer-stub] Would send to ${to}: ${subject}`);
        return { accepted: [to] };
    }
    return transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@events.local",
        to,
        subject,
        text,
        html,
    });
}
