import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSENT_POLICY_VERSION,
  isSafeTrackingConfiguration,
  normalizeTrackingPath,
  pageTypeForPath,
  parseConsentCookie
} from "../src/lib/privacy-policy.js";

const NOW = Date.parse("2026-07-20T12:00:00.000Z");

function consentCookie(overrides: Record<string, unknown> = {}) {
  const value = {
    version: CONSENT_POLICY_VERSION,
    necessary: true,
    analytics: true,
    decidedAt: "2026-07-20T11:00:00.000Z",
    expiresAt: "2027-01-16T11:00:00.000Z",
    source: "BANNER",
    ...overrides
  };
  return `other=value; dnd_consent=${encodeURIComponent(JSON.stringify(value))}`;
}

test("accepts a current and structurally valid consent decision", () => {
  const decision = parseConsentCookie(consentCookie(), NOW);
  assert.equal(decision?.analytics, true);
  assert.equal(decision?.version, CONSENT_POLICY_VERSION);
});

test("rejects expired, old-version and malformed consent decisions", () => {
  assert.equal(
    parseConsentCookie(consentCookie({ expiresAt: "2026-07-20T10:00:00.000Z" }), NOW),
    null
  );
  assert.equal(parseConsentCookie(consentCookie({ version: "old-policy" }), NOW), null);
  assert.equal(parseConsentCookie("dnd_consent=%7Bbroken", NOW), null);
});

test("removes secret URL parts and normalizes object identifiers", () => {
  assert.equal(normalizeTrackingPath("/verify-email?token=secret#fragment"), "/verify-email");
  assert.equal(normalizeTrackingPath("/reset-password?token=secret"), "/reset-password");
  assert.equal(normalizeTrackingPath("/connect-discord#token=secret"), "/connect-discord");
  assert.equal(normalizeTrackingPath("/kampagnen/cly123/wiki?filter=npc"), "/kampagnen/:id/wiki");
  assert.equal(normalizeTrackingPath("/sessions/discord-snowflake"), "/sessions/:id");
  assert.equal(pageTypeForPath("/impressum"), "legal");
});

test("requires a valid web container ID and HTTPS tracking endpoint", () => {
  assert.equal(
    isSafeTrackingConfiguration("GTM-ABC123", "https://analytics.dnd-recorder.de"),
    true
  );
  assert.equal(isSafeTrackingConfiguration("G-ABC123", "https://analytics.dnd-recorder.de"), false);
  assert.equal(
    isSafeTrackingConfiguration("GTM-ABC123", "http://analytics.dnd-recorder.de"),
    false
  );
  assert.equal(
    isSafeTrackingConfiguration("GTM-ABC123", "https://analytics.dnd-recorder.de.evil.test"),
    true
  );
});
