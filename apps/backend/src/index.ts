import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { groupsRoutes } from "./routes/groups.routes.js";
import { sessionsRoutes } from "./routes/sessions.routes.js";
import { settingsRoutes } from "./routes/settings.routes.js";
import { campaignsRoutes } from "./routes/campaigns.routes.js";
import { internalRoutes } from "./routes/internal.routes.js";
import { membersRoutes } from "./routes/members.routes.js";
import { wikiRoutes } from "./routes/wiki.routes.js";
import { wikiCrudRoutes } from "./routes/wiki-crud.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET;
if (isProduction && !jwtSecret) {
  throw new Error("JWT_SECRET is required in production");
}

const app = Fastify({
  logger: { level: process.env.NODE_ENV === "production" ? "info" : "debug" },
  trustProxy: process.env.TRUST_PROXY === "true" || isProduction
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? false,
  credentials: true
});

await app.register(jwt, {
  secret: jwtSecret ?? "development-only-secret"
});

await app.register(multipart, {
  limits: {
    // Hard cap on multipart payloads (files + fields). The per-route
    // req.file() call additionally enforces MAX_UPLOAD_BYTES on the file itself.
    fileSize: 20 * 1024 * 1024, // 20 MB
    files: 1
  }
});

// Public image assets contain verified image bytes and fixed extensions.
await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "..", "..", "storage", "avatars"),
  prefix: "/uploads/avatars/",
  decorateReply: false
});
await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "..", "..", "storage", "campaign-backgrounds"),
  prefix: "/uploads/campaign-backgrounds/",
  decorateReply: false
});

await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "..", "..", "storage", "session-images"),
  prefix: "/uploads/session-images/",
  decorateReply: false
});

// Decorate the root instance so every subsequently registered route plugin
// inherits the authentication hook through Fastify's encapsulation boundary.
await authPlugin(app);

// Routes
await app.register(authRoutes);
await app.register(groupsRoutes);
await app.register(sessionsRoutes);
await app.register(settingsRoutes);
await app.register(campaignsRoutes);

await app.register(internalRoutes);
await app.register(membersRoutes);
await app.register(wikiRoutes);
await app.register(wikiCrudRoutes);
await app.register(adminRoutes);

// Health
app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString(), version: "0.2.0" }));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`🚀 Backend listening on port ${port}`);
