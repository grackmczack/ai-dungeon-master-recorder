import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";

export function createStopCommand(voiceRecorderService: VoiceRecorderService): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stoppt die aktuell laufende Session-Aufnahme."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({
          content: "Dieser Befehl kann nur auf einem Discord-Server verwendet werden.",
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply();

      try {
        const recordingKey = voiceRecorderService.getActiveRecordingKey(guildId);
        if (!recordingKey) throw new Error("NO_RECORDING_ACTIVE");
        await voiceRecorderService.stop(recordingKey);
        await interaction.editReply(
          "✅ **Aufnahme gestoppt.** Transkription läuft — du bekommst eine Nachricht, wenn die Zusammenfassung fertig ist."
        );
      } catch (error) {
        if (error instanceof Error && error.message === "NO_RECORDING_ACTIVE") {
          await interaction.editReply("Keine aktive Aufnahme in diesem Server.");
          return;
        }
        throw error;
      }
    }
  };
}
