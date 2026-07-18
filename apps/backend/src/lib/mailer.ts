import nodemailer from "nodemailer";
import type { FastifyBaseLogger } from "fastify";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendPasswordResetEmail(
  recipient: string,
  resetUrl: string,
  logger: FastifyBaseLogger
): Promise<void> {
  if (!smtpConfigured()) {
    logger.error("Password reset requested, but SMTP_HOST or SMTP_FROM is not configured");
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    tls: process.env.SMTP_TLS_SERVERNAME
      ? { servername: process.env.SMTP_TLS_SERVERNAME }
      : undefined,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject: "Passwort für DM Recorder zurücksetzen",
    text: [
      "Du hast das Zurücksetzen deines DM-Recorder-Passworts angefordert.",
      "",
      `Öffne innerhalb von 30 Minuten diesen Link: ${resetUrl}`,
      "",
      "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren."
    ].join("\n"),
    html: `
      <h1>Passwort zurücksetzen</h1>
      <p>Du hast das Zurücksetzen deines DM-Recorder-Passworts angefordert.</p>
      <p><a href="${resetUrl}">Neues Passwort festlegen</a></p>
      <p>Der Link ist 30 Minuten gültig und kann nur einmal verwendet werden.</p>
      <p>Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
    `
  });
}
