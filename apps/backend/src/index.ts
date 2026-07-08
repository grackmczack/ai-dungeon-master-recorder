import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev_secret_change_me"
});

app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`Backend listening on port ${port}`);
