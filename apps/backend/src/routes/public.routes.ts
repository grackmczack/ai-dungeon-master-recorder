import type { FastifyInstance } from "fastify";

// View Channel, Send Messages, Embed Links, Connect, Speak, Use Voice Activity.
const DISCORD_BOT_PERMISSIONS = "36719616";

export function buildDiscordInviteUrl(clientId: string | undefined): string | null {
  const normalized = clientId?.trim();
  if (!normalized || !/^\d{17,20}$/.test(normalized)) return null;

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", normalized);
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("permissions", DISCORD_BOT_PERMISSIONS);
  url.searchParams.set("integration_type", "0");
  return url.toString();
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/public/discord", async (_req, reply) => {
    const inviteUrl = buildDiscordInviteUrl(process.env.DISCORD_CLIENT_ID);
    if (!inviteUrl) {
      return reply.status(503).send({
        configured: false,
        inviteUrl: null,
        error: "Discord bot installation is not configured"
      });
    }

    return reply.send({ configured: true, inviteUrl });
  });
}
