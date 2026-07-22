import { createHash, randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createEmailVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function emailVerificationExpiresAt(now = Date.now()): Date {
  return new Date(now + EMAIL_VERIFICATION_TTL_MS);
}

export function buildEmailVerificationUrl(appUrl: string, token: string): string {
  const url = new URL("/verify-email", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildLoginUrl(appUrl: string): string {
  const url = new URL("/login", appUrl);
  url.searchParams.set("approved", "success");
  return url.toString();
}
