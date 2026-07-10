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
import { adminRoutes } from "./routes/admin.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const app = Fastify({
  logger: { level: process.env.NODE_ENV === "production" ? "info" : "debug" }
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true,
  credentials: true
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev_secret_change_me_in_production"
});

await app.register(multipart);

// Statisches Serving für hochgeladene Avatare + Charakterbögen (PDF)
// Static file serving for all storage directories
await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "..", "..", "storage", "avatars"),
  prefix: "/uploads/avatars/",
  decorateReply: false
});
await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "..", "..", "storage", "character-sheets"),
  prefix: "/uploads/character-sheets/",
  decorateReply: false
});
await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "..", "..", "storage", "recordings"),
  prefix: "/uploads/recordings/",
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

await app.register(authPlugin);

// Routes
await app.register(authRoutes);
await app.register(groupsRoutes);
await app.register(sessionsRoutes);
await app.register(settingsRoutes);
await app.register(campaignsRoutes);

await app.register(internalRoutes);
await app.register(membersRoutes);
await app.register(wikiRoutes);
await app.register(adminRoutes);

// Health
app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString(), version: "0.1.0" }));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`🚀 Backend listening on port ${port}`);
