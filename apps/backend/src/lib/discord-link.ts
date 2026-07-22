import { createHash, randomBytes } from "node:crypto";

export const DISCORD_LINK_TTL_MS = 15 * 60 * 1000;

export function createDiscordLinkToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashDiscordLinkToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function discordLinkExpiresAt(now = Date.now()): Date {
  return new Date(now + DISCORD_LINK_TTL_MS);
}

export function buildDiscordConnectUrl(appUrl: string, token: string): string {
  const url = new URL("/connect-discord", appUrl);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}
