import { GuildMember, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";

export function createRecordCommand(voiceRecorderService: VoiceRecorderService): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("record")
      .setDescription("Start a recording session."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.inCachedGuild() || !(interaction.member instanceof GuildMember)) {
        await interaction.reply({
          content: "This command can only be used in a Discord server.",
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply();

      try {
        await voiceRecorderService.start(interaction.member);
        await interaction.editReply("Recording started");
      } catch (error) {
        if (error instanceof Error && error.message === "USER_NOT_IN_VOICE_CHANNEL") {
          await interaction.editReply("You need to be in a voice channel to start recording.");
          return;
        }

        if (error instanceof Error && error.message === "RECORDING_ALREADY_ACTIVE") {
          await interaction.editReply("A recording is already active in this server.");
          return;
        }

        throw error;
      }
    }
  };
}
