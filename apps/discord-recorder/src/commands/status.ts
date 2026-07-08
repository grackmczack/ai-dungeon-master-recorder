import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

export const statusCommand = {
  data: new SlashCommandBuilder().setName("status").setDescription("Show bot status."),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply("Bot online");
  }
};
