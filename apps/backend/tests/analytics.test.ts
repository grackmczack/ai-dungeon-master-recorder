import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ANALYTICS_POLICY_VERSION,
  hashAnalyticsRevocationToken,
  SERVER_ANALYTICS_EVENTS
} from "../src/lib/analytics.js";

test("analytics consent policy and server event names are explicit", () => {
  assert.equal(ANALYTICS_POLICY_VERSION, "2026-07-20");
  assert.deepEqual(SERVER_ANALYTICS_EVENTS, [
    "email_verified",
    "account_approved",
    "discord_connection_claimed",
    "campaign_channel_configured",
    "recording_started",
    "first_recording_started",
    "recording_completed",
    "session_processing_failed",
    "first_session_completed"
  ]);
});

test("revocation secrets are only persisted as SHA-256 hashes", () => {
  const token = "a".repeat(64);
  assert.equal(
    hashAnalyticsRevocationToken(token),
    createHash("sha256").update(token, "utf8").digest("hex")
  );
  assert.notEqual(hashAnalyticsRevocationToken(token), token);
});
