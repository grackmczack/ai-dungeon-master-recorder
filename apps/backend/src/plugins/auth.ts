import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { accountAccessState } from "../lib/account-access.js";

const SESSION_COOKIE = "dnd_session";

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function sessionCookie(token: string, clear = false): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = clear ? 0 : 7 * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${clear ? "" : encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const token =
      bearerToken(request.headers.authorization) ??
      cookieValue(request.headers.cookie, SESSION_COOKIE);
    if (!token) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    let payload: { sub: string; sv?: number };
    try {
      payload = app.jwt.verify<{ sub: string; sv?: number }>(token);
      request.user = payload;
    } catch {
      reply.header("Set-Cookie", sessionCookie("", true));
      await reply.status(401).send({ error: "Invalid or expired session" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        role: true,
        isActive: true,
        emailVerifiedAt: true,
        approvedAt: true,
        sessionVersion: true
      }
    });
    const accessState = accountAccessState(user);
    if (accessState === "INACTIVE") {
      reply.header("Set-Cookie", sessionCookie("", true));
      await reply.status(403).send({ error: "Account is inactive" });
      return;
    }
    if (!user) return;
    if (accessState === "EMAIL_NOT_VERIFIED") {
      reply.header("Set-Cookie", sessionCookie("", true));
      await reply.status(403).send({ error: "E-Mail-Adresse ist noch nicht bestätigt" });
      return;
    }
    if (accessState === "APPROVAL_PENDING") {
      reply.header("Set-Cookie", sessionCookie("", true));
      await reply.status(403).send({
        error: "Dein Beta-Zugang wartet noch auf die Freigabe",
        code: "APPROVAL_PENDING"
      });
      return;
    }
    if (payload.sv !== user.sessionVersion) {
      reply.header("Set-Cookie", sessionCookie("", true));
      await reply.status(401).send({ error: "Session wurde widerrufen" });
    }
  });
}
