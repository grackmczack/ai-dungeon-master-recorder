import assert from "node:assert/strict";
import test from "node:test";
import { discordInstallationAccessStatus } from "../src/lib/discord-installation-access.js";

const now = new Date("2026-07-18T00:00:00.000Z");
const membership = (
  user: {
    role: "SUPER_ADMIN" | "DM";
    isActive: boolean;
    emailVerifiedAt: Date | null;
    approvedAt: Date | null;
  } | null
) => ({ role: "GM" as const, leftAt: null, user });

test("Discord installations remain unclaimed without a web account", () => {
  assert.equal(discordInstallationAccessStatus([]), "UNCLAIMED");
  assert.equal(discordInstallationAccessStatus([membership(null)]), "UNCLAIMED");
});

test("Discord installations follow email, approval and account-block states", () => {
  assert.equal(
    discordInstallationAccessStatus([
      membership({ role: "DM", isActive: true, emailVerifiedAt: null, approvedAt: null })
    ]),
    "EMAIL_PENDING"
  );
  assert.equal(
    discordInstallationAccessStatus([
      membership({ role: "DM", isActive: true, emailVerifiedAt: now, approvedAt: null })
    ]),
    "APPROVAL_PENDING"
  );
  assert.equal(
    discordInstallationAccessStatus([
      membership({ role: "DM", isActive: false, emailVerifiedAt: now, approvedAt: now })
    ]),
    "ACCOUNT_BLOCKED"
  );
  assert.equal(
    discordInstallationAccessStatus([
      membership({ role: "DM", isActive: true, emailVerifiedAt: now, approvedAt: now })
    ]),
    "READY"
  );
});

test("one authorized GM is sufficient when a campaign has multiple GMs", () => {
  assert.equal(
    discordInstallationAccessStatus([
      membership({ role: "DM", isActive: false, emailVerifiedAt: now, approvedAt: now }),
      membership({ role: "DM", isActive: true, emailVerifiedAt: now, approvedAt: now })
    ]),
    "READY"
  );
});
