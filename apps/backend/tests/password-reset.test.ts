import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_RESET_TTL_MS,
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiresAt
} from "../src/lib/password-reset.js";

test("password reset tokens are random 256-bit hex values and only hashed for storage", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.match(hashPasswordResetToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashPasswordResetToken(first), first);
  assert.equal(hashPasswordResetToken(first), hashPasswordResetToken(first));
});

test("password reset expiry and URL use the configured app origin", () => {
  const now = Date.UTC(2026, 6, 16, 12, 0, 0);
  assert.equal(passwordResetExpiresAt(now).getTime(), now + PASSWORD_RESET_TTL_MS);

  const url = new URL(buildPasswordResetUrl("https://dndbot.example.com/base", "abc123"));
  assert.equal(url.origin, "https://dndbot.example.com");
  assert.equal(url.pathname, "/reset-password");
  assert.equal(url.searchParams.get("token"), "abc123");
});
