import "dotenv/config";

import { createRecordCommand } from "./commands/record.js";
import { statusCommand } from "./commands/status.js";
import { createStopCommand } from "./commands/stop.js";
import { DiscordService } from "./services/discord.service.js";
import { VoiceRecorderService } from "./services/voice-recorder.service.js";
import { ChunkProcessorService } from "./services/chunk-processor.service.js";

const requiredEnv = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"] as const;
type Env = Record<(typeof requiredEnv)[number], string>;

function loadEnv(): Env {
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(", ")}`);
  return {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID!,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID!
  };
}

const env = loadEnv();
const voiceRecorderService = new VoiceRecorderService();
const chunkProcessor = new ChunkProcessorService();

const discordService = new DiscordService({
  token: env.DISCORD_TOKEN,
  clientId: env.DISCORD_CLIENT_ID,
  guildId: env.DISCORD_GUILD_ID,
  commands: [
    createRecordCommand(voiceRecorderService, chunkProcessor),
    createStopCommand(voiceRecorderService),
    statusCommand
  ]
});

await discordService.start();
