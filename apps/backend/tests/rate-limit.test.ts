import assert from "node:assert/strict";
import test from "node:test";
import { FixedWindowRateLimiter } from "../src/lib/rate-limit.js";

test("fixed-window limiter blocks only after the configured allowance", () => {
  const limiter = new FixedWindowRateLimiter(2, 60_000);
  assert.deepEqual(limiter.consume("login", 1_000), {
    allowed: true,
    remaining: 1,
    resetAt: 61_000
  });
  assert.deepEqual(limiter.consume("login", 2_000), {
    allowed: true,
    remaining: 0,
    resetAt: 61_000
  });
  assert.deepEqual(limiter.consume("login", 3_000), {
    allowed: false,
    retryAfterSeconds: 58,
    resetAt: 61_000
  });
});

test("fixed-window limiter separates keys and resets expired windows", () => {
  const limiter = new FixedWindowRateLimiter(1, 1_000);
  assert.equal(limiter.consume("a", 0).allowed, true);
  assert.equal(limiter.consume("a", 500).allowed, false);
  assert.equal(limiter.consume("b", 500).allowed, true);
  assert.equal(limiter.consume("a", 1_000).allowed, true);
});
