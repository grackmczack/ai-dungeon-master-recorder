import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function passwordResetExpiresAt(now = Date.now()): Date {
  return new Date(now + PASSWORD_RESET_TTL_MS);
}

export function buildPasswordResetUrl(appUrl: string, token: string): string {
  const url = new URL("/reset-password", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
