import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discordGuildId: z.string().optional()
});

export async function groupsRoutes(app: FastifyInstance) {
  // All routes require auth
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  // GET /groups — list groups for current user
  app.get("/groups", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: sub, leftAt: null },
      include: {
        group: {
          include: {
            _count: { select: { campaigns: true, memberships: true } }
          }
        }
      }
    });
    return reply.send(memberships.map(m => ({ ...m.group, role: m.role })));
  });

  // POST /groups — create group
  app.post("/groups", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = CreateGroupSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const group = await prisma.group.create({
      data: {
        ...body.data,
        memberships: { create: { userId: sub, role: "GM" } }
      }
    });
    return reply.status(201).send(group);
  });

  // GET /groups/:id
  app.get("/groups/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const membership = await prisma.groupMembership.findFirst({ where: { groupId: id, userId: sub, leftAt: null } });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { leftAt: null },
          include: { user: { select: { id: true, displayName: true, email: true } } }
        },
        campaigns: { orderBy: { createdAt: "desc" } },
        settings: true
      }
    });
    return reply.send(group);
  });

  // POST /groups/:id/members — invite user by email
  app.post("/groups/:id/members", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { email, role } = req.body as { email: string; role?: string };

    const myMembership = await prisma.groupMembership.findFirst({ where: { groupId: id, userId: sub, role: "GM", leftAt: null } });
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can invite" });

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) return reply.status(404).send({ error: "User not found" });

    const existing = await prisma.groupMembership.findFirst({ where: { groupId: id, userId: targetUser.id, leftAt: null } });
    if (existing) return reply.status(409).send({ error: "Already a member" });

    const membership = await prisma.groupMembership.create({
      data: { groupId: id, userId: targetUser.id, role: (role as any) ?? "PLAYER" }
    });
    return reply.status(201).send(membership);
  });
}
