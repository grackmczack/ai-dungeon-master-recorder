import "dotenv/config";

import { createRecordCommand } from "./commands/record.js";
import { statusCommand } from "./commands/status.js";
import { createStopCommand } from "./commands/stop.js";
import { DiscordService } from "./services/discord.service.js";
import { VoiceRecorderService } from "./services/voice-recorder.service.js";

const requiredEnv = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"] as const;

type Env = Record<(typeof requiredEnv)[number], string>;

function loadEnv(): Env {
  const missingKeys = requiredEnv.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(", ")}`);
  }

  return {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID
  } as Env;
}

const env = loadEnv();
const voiceRecorderService = new VoiceRecorderService();

const discordService = new DiscordService({
  token: env.DISCORD_TOKEN,
  clientId: env.DISCORD_CLIENT_ID,
  guildId: env.DISCORD_GUILD_ID,
  commands: [
    createRecordCommand(voiceRecorderService),
    createStopCommand(voiceRecorderService),
    statusCommand
  ]
});

await discordService.start();
