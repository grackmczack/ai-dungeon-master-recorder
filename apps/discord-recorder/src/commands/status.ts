import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";

export const statusCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show current bot and recording status."),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Dynamic import to avoid circular deps
    const { transcriptionQueue } = await import("../services/queue.service.js");
    const queueSize = await transcriptionQueue.getWaiting();
    const activeJobs = await transcriptionQueue.getActive();

    const lines = [
      "🤖 **AI Dungeon Master Recorder** — Online",
      `📡 Latency: ${interaction.client.ws.ping}ms`,
      `🎙️ Queue: ${queueSize.length} waiting, ${activeJobs.length} active transcription job(s)`
    ];

    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
  }
};
