import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { sessionCookie } from "../plugins/auth.js";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiresAt
} from "../lib/password-reset.js";
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken,
  emailVerificationExpiresAt,
  hashEmailVerificationToken
} from "../lib/email-verification.js";
import {
  sendEmailConfirmedEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail
} from "../lib/mailer.js";
import { FixedWindowRateLimiter, normalizedEmailFromBody, rateLimit } from "../lib/rate-limit.js";
import { accountAccessState } from "../lib/account-access.js";

const EmailSchema = z.string().trim().toLowerCase().email();
const NewPasswordSchema = z.string().min(12).max(128);

const RegisterSchema = z.object({
  email: EmailSchema,
  password: NewPasswordSchema,
  displayName: z.string().trim().min(2).max(80)
});

const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().max(128)
});

const ForgotPasswordSchema = z.object({ email: EmailSchema });
const ResendVerificationSchema = z.object({ email: EmailSchema });
const VerifyEmailSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) });
const ResetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: NewPasswordSchema
});
const ChangePasswordSchema = z.object({
  currentPassword: z.string().max(128),
  newPassword: NewPasswordSchema
});
const UpdateProfileSchema = z.object({ displayName: z.string().trim().min(2).max(80) });

const loginLimiter = new FixedWindowRateLimiter(10, 15 * 60 * 1000);
const registerLimiter = new FixedWindowRateLimiter(5, 60 * 60 * 1000);
const forgotPasswordLimiter = new FixedWindowRateLimiter(5, 60 * 60 * 1000);
const resendVerificationLimiter = new FixedWindowRateLimiter(5, 60 * 60 * 1000);
const verifyEmailLimiter = new FixedWindowRateLimiter(20, 60 * 60 * 1000);
const resetPasswordLimiter = new FixedWindowRateLimiter(10, 60 * 60 * 1000);

const genericResetMessage =
  "Wenn ein aktives Konto zu dieser E-Mail existiert, wurde ein Link zum Zurücksetzen versendet.";
const genericVerificationMessage =
  "Wenn ein noch nicht bestätigtes Konto zu dieser E-Mail existiert, wurde ein neuer Bestätigungslink versendet.";
const appUrl = () => process.env.APP_URL ?? "http://localhost:5173";

function sessionToken(
  app: FastifyInstance,
  user: { id: string; email: string; sessionVersion: number }
) {
  return app.jwt.sign(
    { sub: user.id, email: user.email, sv: user.sessionVersion },
    { expiresIn: "7d" }
  );
}

async function waitForMinimumDuration(startedAt: number, minimumMs = 300): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/register",
    { preHandler: [rateLimit(registerLimiter, (request) => request.ip)] },
    async (req, reply) => {
      const body = RegisterSchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

      const existing = await prisma.user.findFirst({
        where: { email: { equals: body.data.email, mode: "insensitive" } }
      });
      if (existing) return reply.status(409).send({ error: "E-Mail ist bereits registriert" });

      const passwordHash = await bcrypt.hash(body.data.password, 12);
      const verificationToken = createEmailVerificationToken();
      const user = await prisma.user.create({
        data: {
          email: body.data.email,
          passwordHash,
          displayName: body.data.displayName,
          emailVerifiedAt: null,
          approvedAt: null,
          emailVerificationTokenHash: hashEmailVerificationToken(verificationToken),
          emailVerificationExpiresAt: emailVerificationExpiresAt()
        }
      });

      const verificationUrl = buildEmailVerificationUrl(appUrl(), verificationToken);
      void sendEmailVerificationEmail(user.email, user.displayName, verificationUrl, app.log).catch(
        (error: unknown) => {
          app.log.error({ err: error }, "Could not send email verification email");
        }
      );

      return reply.status(201).send({
        email: user.email,
        message:
          "Konto erstellt. Bestätige deine E-Mail-Adresse und warte anschließend auf die manuelle Beta-Freigabe."
      });
    }
  );

  app.post(
    "/auth/login",
    {
      preHandler: [
        rateLimit(loginLimiter, (request) => `${request.ip}:${normalizedEmailFromBody(request)}`)
      ]
    },
    async (req, reply) => {
      const body = LoginSchema.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: "Ungültige Anmeldedaten" });

      const user = await prisma.user.findFirst({
        where: { email: { equals: body.data.email, mode: "insensitive" } }
      });
      if (!user) return reply.status(401).send({ error: "E-Mail oder Passwort ist falsch" });

      const valid = await bcrypt.compare(body.data.password, user.passwordHash);
      if (!valid) return reply.status(401).send({ error: "E-Mail oder Passwort ist falsch" });
      const accessState = accountAccessState(user);
      if (accessState === "INACTIVE") {
        return reply.status(403).send({ error: "Konto ist deaktiviert" });
      }
      if (accessState === "EMAIL_NOT_VERIFIED") {
        return reply.status(403).send({
          error: "E-Mail-Adresse ist noch nicht bestätigt",
          code: "EMAIL_NOT_VERIFIED"
        });
      }
      if (accessState === "APPROVAL_PENDING") {
        return reply.status(403).send({
          error: "Dein Beta-Zugang wartet noch auf die Freigabe",
          code: "APPROVAL_PENDING"
        });
      }

      reply.header("Set-Cookie", sessionCookie(sessionToken(app, user)));
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role
        }
      });
    }
  );

  app.post(
    "/auth/resend-verification",
    {
      preHandler: [
        rateLimit(
          resendVerificationLimiter,
          (request) => `${request.ip}:${normalizedEmailFromBody(request)}`
        )
      ]
    },
    async (req, reply) => {
      const startedAt = Date.now();
      const body = ResendVerificationSchema.safeParse(req.body);

      if (body.success) {
        const user = await prisma.user.findFirst({
          where: {
            email: { equals: body.data.email, mode: "insensitive" },
            isActive: true,
            emailVerifiedAt: null
          },
          select: { id: true, email: true, displayName: true }
        });

        if (user) {
          const verificationToken = createEmailVerificationToken();
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerificationTokenHash: hashEmailVerificationToken(verificationToken),
              emailVerificationExpiresAt: emailVerificationExpiresAt()
            }
          });

          const verificationUrl = buildEmailVerificationUrl(appUrl(), verificationToken);
          void sendEmailVerificationEmail(
            user.email,
            user.displayName,
            verificationUrl,
            app.log
          ).catch((error: unknown) => {
            app.log.error({ err: error }, "Could not resend email verification email");
          });
        }
      }

      await waitForMinimumDuration(startedAt);
      return reply.status(202).send({ message: genericVerificationMessage });
    }
  );

  app.post(
    "/auth/verify-email",
    { preHandler: [rateLimit(verifyEmailLimiter, (request) => request.ip)] },
    async (req, reply) => {
      const body = VerifyEmailSchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Bestätigungslink ist ungültig oder abgelaufen" });
      }

      const tokenHash = hashEmailVerificationToken(body.data.token);
      const user = await prisma.user.findFirst({
        where: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: { gt: new Date() },
          emailVerifiedAt: null,
          isActive: true
        },
        select: { id: true, email: true, displayName: true }
      });
      if (!user) {
        return reply.status(400).send({ error: "Bestätigungslink ist ungültig oder abgelaufen" });
      }

      const updated = await prisma.user.updateMany({
        where: {
          id: user.id,
          emailVerificationTokenHash: tokenHash,
          emailVerifiedAt: null
        },
        data: {
          emailVerifiedAt: new Date(),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null
        }
      });
      if (updated.count !== 1) {
        return reply.status(400).send({ error: "Bestätigungslink ist ungültig oder abgelaufen" });
      }

      void sendEmailConfirmedEmail(user.email, user.displayName, app.log).catch(
        (error: unknown) => {
          app.log.error({ err: error }, "Could not send email confirmation notice");
        }
      );

      return reply.send({
        message:
          "E-Mail-Adresse bestätigt. Dein Beta-Zugang wartet jetzt auf die manuelle Freigabe."
      });
    }
  );

  app.post(
    "/auth/forgot-password",
    {
      preHandler: [
        rateLimit(
          forgotPasswordLimiter,
          (request) => `${request.ip}:${normalizedEmailFromBody(request)}`
        )
      ]
    },
    async (req, reply) => {
      const startedAt = Date.now();
      const body = ForgotPasswordSchema.safeParse(req.body);

      if (body.success) {
        const user = await prisma.user.findFirst({
          where: { email: { equals: body.data.email, mode: "insensitive" } }
        });
        if (user?.isActive && user.emailVerifiedAt) {
          const token = createPasswordResetToken();
          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordResetTokenHash: hashPasswordResetToken(token),
              passwordResetExpiresAt: passwordResetExpiresAt()
            }
          });

          const resetUrl = buildPasswordResetUrl(appUrl(), token);
          void sendPasswordResetEmail(user.email, user.displayName, resetUrl, app.log).catch(
            (error: unknown) => {
              app.log.error({ err: error }, "Could not send password reset email");
            }
          );
        }
      }

      await waitForMinimumDuration(startedAt);
      return reply.status(202).send({ message: genericResetMessage });
    }
  );

  app.post(
    "/auth/reset-password",
    { preHandler: [rateLimit(resetPasswordLimiter, (request) => request.ip)] },
    async (req, reply) => {
      const body = ResetPasswordSchema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Reset-Link ist ungültig oder abgelaufen" });
      }

      const tokenHash = hashPasswordResetToken(body.data.token);
      const user = await prisma.user.findFirst({
        where: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { gt: new Date() },
          isActive: true,
          emailVerifiedAt: { not: null }
        },
        select: { id: true }
      });
      if (!user) {
        return reply.status(400).send({ error: "Reset-Link ist ungültig oder abgelaufen" });
      }

      const passwordHash = await bcrypt.hash(body.data.password, 12);
      const updated = await prisma.user.updateMany({
        where: { id: user.id, passwordResetTokenHash: tokenHash },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          sessionVersion: { increment: 1 }
        }
      });
      if (updated.count !== 1) {
        return reply.status(400).send({ error: "Reset-Link ist ungültig oder abgelaufen" });
      }

      reply.header("Set-Cookie", sessionCookie("", true));
      return reply.send({ message: "Passwort wurde geändert. Du kannst dich jetzt anmelden." });
    }
  );

  app.post("/auth/change-password", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = ChangePasswordSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Das neue Passwort muss 12–128 Zeichen lang sein" });
    }

    const { sub } = req.user as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return reply.status(404).send({ error: "Konto wurde nicht gefunden" });

    const valid = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
    if (!valid) return reply.status(400).send({ error: "Aktuelles Passwort ist falsch" });
    if (body.data.currentPassword === body.data.newPassword) {
      return reply.status(400).send({ error: "Das neue Passwort muss sich unterscheiden" });
    }

    const passwordHash = await bcrypt.hash(body.data.newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        sessionVersion: { increment: 1 }
      }
    });

    reply.header("Set-Cookie", sessionCookie(sessionToken(app, updated)));
    return reply.send({ message: "Passwort wurde geändert" });
  });

  app.patch("/auth/profile", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = UpdateProfileSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Name ist ungültig" });

    const { sub } = req.user as { sub: string };
    const user = await prisma.user.update({
      where: { id: sub },
      data: { displayName: body.data.displayName },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true
      }
    });
    return reply.send({ user });
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.header("Set-Cookie", sessionCookie("", true));
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
        approvedAt: true,
        createdAt: true,
        memberships: {
          include: { campaign: { select: { id: true, name: true } } }
        },
        receivedKeys: {
          where: { revokedAt: null },
          select: { grantedAt: true, superAdmin: { select: { id: true, displayName: true } } }
        }
      }
    });
    if (!user) return reply.status(404).send({ error: "Konto wurde nicht gefunden" });

    return reply.send({
      ...user,
      hasAdminKeys: user.receivedKeys.length > 0,
      adminKeyProvider: user.receivedKeys[0]?.superAdmin?.displayName ?? null
    });
  });
}
