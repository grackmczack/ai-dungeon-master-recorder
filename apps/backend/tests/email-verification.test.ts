import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_VERIFICATION_TTL_MS,
  buildEmailVerificationUrl,
  buildLoginUrl,
  createEmailVerificationToken,
  emailVerificationExpiresAt,
  hashEmailVerificationToken
} from "../src/lib/email-verification.js";

test("email verification tokens are random 256-bit values and only stored as hashes", () => {
  const first = createEmailVerificationToken();
  const second = createEmailVerificationToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.match(hashEmailVerificationToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashEmailVerificationToken(first), first);
  assert.equal(hashEmailVerificationToken(first), hashEmailVerificationToken(first));
});

test("verification links expire after 24 hours and use the configured app origin", () => {
  const now = Date.UTC(2026, 6, 18, 12, 0, 0);
  assert.equal(emailVerificationExpiresAt(now).getTime(), now + EMAIL_VERIFICATION_TTL_MS);

  const verificationUrl = new URL(
    buildEmailVerificationUrl("https://dndbot.example.com/base", "secret-token")
  );
  assert.equal(verificationUrl.origin, "https://dndbot.example.com");
  assert.equal(verificationUrl.pathname, "/verify-email");
  assert.equal(verificationUrl.searchParams.get("token"), "secret-token");

  const loginUrl = new URL(buildLoginUrl("https://dndbot.example.com/base"));
  assert.equal(loginUrl.pathname, "/login");
  assert.equal(loginUrl.searchParams.get("approved"), "success");
});
