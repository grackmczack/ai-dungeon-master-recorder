import assert from "node:assert/strict";
import test from "node:test";
import { accountAccessState } from "../src/lib/account-access.js";

const verifiedAt = new Date("2026-07-18T00:00:00.000Z");

test("public DM registrations require email confirmation and manual approval", () => {
  assert.equal(
    accountAccessState({ role: "DM", isActive: true, emailVerifiedAt: null, approvedAt: null }),
    "EMAIL_NOT_VERIFIED"
  );
  assert.equal(
    accountAccessState({
      role: "DM",
      isActive: true,
      emailVerifiedAt: verifiedAt,
      approvedAt: null
    }),
    "APPROVAL_PENDING"
  );
  assert.equal(
    accountAccessState({
      role: "DM",
      isActive: true,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt
    }),
    "ACTIVE"
  );
});

test("deactivation wins over onboarding state and superadmins bypass beta approval", () => {
  assert.equal(
    accountAccessState({
      role: "DM",
      isActive: false,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt
    }),
    "INACTIVE"
  );
  assert.equal(
    accountAccessState({
      role: "SUPER_ADMIN",
      isActive: true,
      emailVerifiedAt: verifiedAt,
      approvedAt: null
    }),
    "ACTIVE"
  );
});
