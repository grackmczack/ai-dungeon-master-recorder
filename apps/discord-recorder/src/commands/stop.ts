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
        const recording = await voiceRecorderService.stop(guildId);
        await interaction.editReply(`Recording saved:\n${recording.filename}`);
      } catch (error) {
        if (error instanceof Error && error.message === "NO_RECORDING_ACTIVE") {
          await interaction.editReply("No recording is active in this server.");
          return;
        }

        throw error;
      }
    }
  };
}
