import type { FastifyInstance, FastifyRequest } from "fastify";

export async function authPlugin(app: FastifyInstance) {
  // Decorator: verify JWT and attach user to request
  app.decorate("authenticate", async (request: FastifyRequest) => {
    await request.jwtVerify();
  });
}
