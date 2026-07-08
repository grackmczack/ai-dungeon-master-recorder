import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { groupsRoutes } from "./routes/groups.routes.js";
import { sessionsRoutes } from "./routes/sessions.routes.js";
import { settingsRoutes } from "./routes/settings.routes.js";

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

await app.register(authPlugin);

// Routes
await app.register(authRoutes);
await app.register(groupsRoutes);
await app.register(sessionsRoutes);
await app.register(settingsRoutes);

// Health
app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString(), version: "0.1.0" }));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`🚀 Backend listening on port ${port}`);
