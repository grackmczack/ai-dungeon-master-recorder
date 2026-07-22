import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCORD_LINK_TTL_MS,
  buildDiscordConnectUrl,
  createDiscordLinkToken,
  discordLinkExpiresAt,
  hashDiscordLinkToken
} from "../src/lib/discord-link.js";

test("Discord connection tokens are random and only stored as hashes", () => {
  const first = createDiscordLinkToken();
  const second = createDiscordLinkToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.match(hashDiscordLinkToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashDiscordLinkToken(first), first);
  assert.equal(hashDiscordLinkToken(first), hashDiscordLinkToken(` ${first} `));
});

test("Discord link codes expire after fifteen minutes", () => {
  const now = Date.UTC(2026, 6, 17, 20, 0, 0);
  assert.equal(discordLinkExpiresAt(now).getTime(), now + DISCORD_LINK_TTL_MS);
});

test("Discord connection URL points to the configured web application", () => {
  const url = new URL(buildDiscordConnectUrl("https://dndbot.example.com/base", "secret-token"));
  assert.equal(url.origin, "https://dndbot.example.com");
  assert.equal(url.pathname, "/connect-discord");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), "secret-token");
  assert.equal(url.search, "");
});
