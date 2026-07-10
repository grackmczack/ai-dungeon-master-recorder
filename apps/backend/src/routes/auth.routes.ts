import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post("/auth/register", async (req, reply) => {
    const body = RegisterSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (existing) return reply.status(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(body.data.password, 12);
    const user = await prisma.user.create({
      data: { email: body.data.email, passwordHash, displayName: body.data.displayName }
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "7d" });
    return reply.status(201).send({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  // POST /auth/login
  app.post("/auth/login", async (req, reply) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) return reply.status(401).send({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "7d" });
    return reply.send({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  // GET /auth/me  (protected)
  app.get("/auth/me", { preHandler: [async (req, reply) => { await req.jwtVerify(); }] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, displayName: true, role: true, isActive: true,
        createdAt: true,
        memberships: {
          include: { group: { select: { id: true, name: true } } }
        },
        receivedKeys: {
          where: { revokedAt: null },
          select: { grantedAt: true, superAdmin: { select: { id: true, displayName: true } } }
        }
      }
    });
    if (!user) return reply.status(404).send({ error: "User not found" });

    return reply.send({
      ...user,
      hasAdminKeys: user.receivedKeys.length > 0,
      adminKeyProvider: user.receivedKeys[0]?.superAdmin?.displayName ?? null
    });
  });
}
