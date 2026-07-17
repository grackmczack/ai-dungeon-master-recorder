import assert from "node:assert/strict";
import test from "node:test";
import { isExclusivelyManagedGroup } from "../src/lib/user-deletion.js";

test("solely managed groups are deleted with the DM account", () => {
  assert.equal(
    isExclusivelyManagedGroup({
      userId: "dm-1",
      role: "GM",
      leftAt: null,
      activeUserIds: ["dm-1", null]
    }),
    true
  );
});

test("shared groups are retained when another web account is active", () => {
  assert.equal(
    isExclusivelyManagedGroup({
      userId: "dm-1",
      role: "GM",
      leftAt: null,
      activeUserIds: ["dm-1", "dm-2"]
    }),
    false
  );
});

test("player memberships and historical GM memberships never own a group", () => {
  assert.equal(
    isExclusivelyManagedGroup({
      userId: "dm-1",
      role: "PLAYER",
      leftAt: null,
      activeUserIds: ["dm-1"]
    }),
    false
  );
  assert.equal(
    isExclusivelyManagedGroup({
      userId: "dm-1",
      role: "GM",
      leftAt: new Date(),
      activeUserIds: []
    }),
    false
  );
});
