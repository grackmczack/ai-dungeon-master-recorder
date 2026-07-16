import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";

export function createStopCommand(voiceRecorderService: VoiceRecorderService): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop the current recording session."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({
          content: "This command can only be used in a Discord server.",
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply();

      try {
        await voiceRecorderService.stop(guildId);
        await interaction.editReply(
          "✅ **Aufnahme gestoppt.** Transkription läuft — du bekommst eine Nachricht wenn die Summary fertig ist."
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
