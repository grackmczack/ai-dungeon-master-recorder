import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { authPlugin } from "../src/plugins/auth.js";

test("authPlugin decorates the root Fastify instance", async () => {
  const app = Fastify();
  await app.register(jwt, { secret: "test-only-secret" });

  await authPlugin(app);

  assert.equal(typeof app.authenticate, "function");
  await app.close();
});
