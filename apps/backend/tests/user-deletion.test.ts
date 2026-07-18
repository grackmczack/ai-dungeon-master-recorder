import assert from "node:assert/strict";
import test from "node:test";
import { isExclusivelyManagedCampaign } from "../src/lib/user-deletion.js";

test("solely managed campaigns are deleted with the DM account", () => {
  assert.equal(
    isExclusivelyManagedCampaign({
      userId: "dm-1",
      role: "GM",
      leftAt: null,
      activeUserIds: ["dm-1", null]
    }),
    true
  );
});

test("shared campaigns are retained when another web account is active", () => {
  assert.equal(
    isExclusivelyManagedCampaign({
      userId: "dm-1",
      role: "GM",
      leftAt: null,
      activeUserIds: ["dm-1", "dm-2"]
    }),
    false
  );
});

test("player memberships and historical GM memberships never own a campaign", () => {
  assert.equal(
    isExclusivelyManagedCampaign({
      userId: "dm-1",
      role: "PLAYER",
      leftAt: null,
      activeUserIds: ["dm-1"]
    }),
    false
  );
  assert.equal(
    isExclusivelyManagedCampaign({
      userId: "dm-1",
      role: "GM",
      leftAt: new Date(),
      activeUserIds: []
    }),
    false
  );
});
