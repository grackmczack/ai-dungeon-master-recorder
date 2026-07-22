import assert from "node:assert/strict";
import test from "node:test";
import { buildDiscordInviteUrl } from "../src/routes/public.routes.js";

test("builds a guild-install invite with the required bot scopes", () => {
  const invite = buildDiscordInviteUrl("123456789012345678");
  assert.ok(invite);

  const url = new URL(invite);
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.searchParams.get("client_id"), "123456789012345678");
  assert.equal(url.searchParams.get("scope"), "bot applications.commands");
  assert.equal(url.searchParams.get("permissions"), "36719616");
  assert.equal(url.searchParams.get("integration_type"), "0");
});

test("rejects a missing or malformed Discord client id", () => {
  assert.equal(buildDiscordInviteUrl(undefined), null);
  assert.equal(buildDiscordInviteUrl("not-a-snowflake"), null);
});
