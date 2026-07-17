import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";

export function createStatusCommand(voiceRecorderService: VoiceRecorderService): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("status")
      .setDescription("Zeigt den Status für diesen Discord-Server."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({
          content: "Dieser Befehl kann nur auf einem Discord-Server verwendet werden.",
          ephemeral: true
        });
        return;
      }

      // Nur Jobs der aktuellen Guild zählen, damit keine Statusdaten anderer
      // Discord-Server offengelegt werden.
      const { transcriptionQueue } = await import("../services/queue.service.js");
      const [waitingJobs, activeJobs] = await Promise.all([
        transcriptionQueue.getWaiting(),
        transcriptionQueue.getActive()
      ]);
      const waitingForGuild = waitingJobs.filter((job) => job.data.guildId === guildId).length;
      const activeForGuild = activeJobs.filter((job) => job.data.guildId === guildId).length;

      const lines = [
        "🤖 **AI Dungeon Master Recorder** — Online",
        `📡 Latenz: ${interaction.client.ws.ping} ms`,
        `🔴 Aufnahme: ${voiceRecorderService.isRecording(guildId) ? "läuft" : "inaktiv"}`,
        `🎙️ Verarbeitung: ${waitingForGuild} wartend, ${activeForGuild} aktiv`
      ];

      await interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }
  };
}
