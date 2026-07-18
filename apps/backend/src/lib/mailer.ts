import nodemailer from "nodemailer";
import type { FastifyBaseLogger } from "fastify";

type EmailAction = {
  label: string;
  url: string;
};

type BrandedEmailInput = {
  subject: string;
  preheader: string;
  title: string;
  displayName: string;
  paragraphs: string[];
  action?: EmailAction;
  notice?: string;
  ignoreNotice?: string;
};

export type BrandedEmail = {
  subject: string;
  text: string;
  html: string;
};

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function brandLogoUrl(): string {
  try {
    return new URL("/logo-d20.png", process.env.APP_URL ?? "http://localhost:5173").toString();
  } catch {
    return "http://localhost:5173/logo-d20.png";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildBrandedEmail(input: BrandedEmailInput): BrandedEmail {
  const textLines = [
    input.title,
    "",
    `Hallo ${input.displayName},`,
    "",
    ...input.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(input.action ? [`${input.action.label}: ${input.action.url}`, ""] : []),
    ...(input.notice ? [input.notice, ""] : []),
    ...(input.ignoreNotice ? [input.ignoreNotice, ""] : []),
    "Möge die nächste Session eine gute Geschichte schreiben.",
    "Dein Artificer · DnD Recorder"
  ];

  const paragraphHtml = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#d7d7e2;font-size:16px;line-height:1.65;">${escapeHtml(paragraph)}</p>`
    )
    .join("");
  const actionHtml = input.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 24px;"><tr><td style="border-radius:10px;background:#7c3aed;"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">${escapeHtml(input.action.label)}</a></td></tr></table>`
    : "";
  const noticeHtml = input.notice
    ? `<p style="margin:20px 0 0;padding:14px 16px;border-left:3px solid #8b5cf6;background:#252540;color:#c8c8d6;font-size:14px;line-height:1.55;">${escapeHtml(input.notice)}</p>`
    : "";
  const ignoreHtml = input.ignoreNotice
    ? `<p style="margin:20px 0 0;color:#9ca3af;font-size:13px;line-height:1.55;">${escapeHtml(input.ignoreNotice)}</p>`
    : "";

  return {
    subject: input.subject,
    text: textLines.join("\n").trim(),
    html: `<!doctype html>
<html lang="de">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
  <body style="margin:0;padding:0;background:#0f0f1a;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f0f1a;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#1a1a2e;border:1px solid #2d2d4a;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:24px 30px;background:#151525;border-bottom:1px solid #2d2d4a;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
              <td style="padding-right:14px;"><img src="${escapeHtml(brandLogoUrl())}" width="48" height="48" alt="DnD Recorder" style="display:block;width:48px;height:48px;border:0;"></td>
              <td><div style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:.2px;">DnD Recorder</div><div style="color:#a78bfa;font-size:12px;margin-top:3px;">Dein KI-Chronist am Spieltisch</div></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:32px 30px;">
            <div style="color:#a78bfa;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:10px;">Botschaft des Artificers</div>
            <h1 style="margin:0 0 22px;color:#ffffff;font-size:27px;line-height:1.25;">${escapeHtml(input.title)}</h1>
            <p style="margin:0 0 16px;color:#ffffff;font-size:16px;line-height:1.65;">Hallo ${escapeHtml(input.displayName)},</p>
            ${paragraphHtml}
            ${actionHtml}
            ${noticeHtml}
            ${ignoreHtml}
          </td></tr>
          <tr><td style="padding:22px 30px;border-top:1px solid #2d2d4a;background:#151525;color:#9ca3af;font-size:12px;line-height:1.6;">
            Möge die nächste Session eine gute Geschichte schreiben.<br>
            <strong style="color:#c4b5fd;">Dein Artificer · DnD Recorder</strong>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
  };
}

export function buildEmailVerificationEmail(
  displayName: string,
  verificationUrl: string
): BrandedEmail {
  return buildBrandedEmail({
    subject: "Bestätige deine E-Mail-Adresse · DnD Recorder",
    preheader: "Bestätige deine E-Mail-Adresse und aktiviere dein Konto.",
    title: "Ein letzter Wurf",
    displayName,
    paragraphs: [
      "dein Konto ist vorbereitet. Bestätige jetzt deine E-Mail-Adresse, bevor dein Abenteuer im DnD Recorder beginnt."
    ],
    action: { label: "E-Mail-Adresse bestätigen", url: verificationUrl },
    notice: "Der Link ist 24 Stunden gültig und kann nur einmal verwendet werden.",
    ignoreNotice: "Wenn du dieses Konto nicht erstellt hast, kannst du diese Nachricht ignorieren."
  });
}

export function buildAccountActivatedEmail(displayName: string, loginUrl: string): BrandedEmail {
  return buildBrandedEmail({
    subject: "Dein Konto ist aktiviert · DnD Recorder",
    preheader: "Dein Konto ist aktiviert und der Spieltisch wartet.",
    title: "Willkommen am Spieltisch",
    displayName,
    paragraphs: [
      "deine E-Mail-Adresse ist bestätigt und dein Konto wurde aktiviert.",
      "Du kannst jetzt deine Gruppe und Kampagne einrichten, den Discord-Bot verbinden und eure nächsten Abenteuer festhalten."
    ],
    action: { label: "Zum DnD Recorder", url: loginUrl }
  });
}

export function buildPasswordResetEmail(displayName: string, resetUrl: string): BrandedEmail {
  return buildBrandedEmail({
    subject: "Passwort zurücksetzen · DnD Recorder",
    preheader: "Lege ein neues Passwort für dein DnD-Recorder-Konto fest.",
    title: "Ein neuer Schlüssel für dein Konto",
    displayName,
    paragraphs: [
      "für dein Konto wurde ein neues Passwort angefordert. Über den folgenden Link kannst du einen neuen Zugangsschlüssel festlegen."
    ],
    action: { label: "Neues Passwort festlegen", url: resetUrl },
    notice: "Der Link ist 30 Minuten gültig und kann nur einmal verwendet werden.",
    ignoreNotice: "Wenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren."
  });
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
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
}

async function sendEmail(
  recipient: string,
  email: BrandedEmail,
  logger: FastifyBaseLogger
): Promise<void> {
  if (!smtpConfigured()) {
    logger.error("Email requested, but SMTP_HOST or SMTP_FROM is not configured");
    return;
  }
  await createTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    ...email
  });
}

export function sendEmailVerificationEmail(
  recipient: string,
  displayName: string,
  verificationUrl: string,
  logger: FastifyBaseLogger
): Promise<void> {
  return sendEmail(recipient, buildEmailVerificationEmail(displayName, verificationUrl), logger);
}

export function sendAccountActivatedEmail(
  recipient: string,
  displayName: string,
  loginUrl: string,
  logger: FastifyBaseLogger
): Promise<void> {
  return sendEmail(recipient, buildAccountActivatedEmail(displayName, loginUrl), logger);
}

export function sendPasswordResetEmail(
  recipient: string,
  displayName: string,
  resetUrl: string,
  logger: FastifyBaseLogger
): Promise<void> {
  return sendEmail(recipient, buildPasswordResetEmail(displayName, resetUrl), logger);
}
