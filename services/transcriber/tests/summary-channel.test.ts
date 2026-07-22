import assert from "node:assert/strict";
import test from "node:test";
import { resolveSummaryChannelId } from "../src/summary-channel.js";

test("configured summary channel wins over the recording channel", () => {
  assert.equal(resolveSummaryChannelId("fixed-channel", "record-channel"), "fixed-channel");
});

test("recording channel remains the fallback when no fixed channel exists", () => {
  assert.equal(resolveSummaryChannelId(null, "record-channel"), "record-channel");
  assert.equal(resolveSummaryChannelId("", "record-channel"), "record-channel");
  assert.equal(resolveSummaryChannelId(undefined, undefined), null);
});
