import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import { getPostChannel, setPostChannel } from "../services/database.service.js";

export const summaryChannelCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("summary-channel")
    .setDescription("Festen Kanal für fertige Session-Zusammenfassungen verwalten")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Aktuellen oder ausgewählten Kanal als Summary-Kanal setzen")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Zielkanal; ohne Auswahl wird der aktuelle Kanal verwendet")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("Aktuell konfigurierten Summary-Kanal anzeigen")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("clear").setDescription("Festen Summary-Kanal entfernen")
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (
      !interaction.inCachedGuild() ||
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: "Du benötigst die Berechtigung **Server verwalten**.",
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "status") {
      const channelId = await getPostChannel(interaction.guildId);
      await interaction.reply({
        content: channelId
          ? `📌 Fertige Session-Zusammenfassungen werden in <#${channelId}> gepostet.`
          : "Es ist kein fester Summary-Kanal gesetzt. Der Bot verwendet den Kanal von `/record`.",
        ephemeral: true
      });
      return;
    }

    if (subcommand === "clear") {
      await setPostChannel(interaction.guildId, interaction.guild.name, null);
      await interaction.reply({
        content:
          "✅ Der feste Summary-Kanal wurde entfernt. Künftig gilt wieder der `/record`-Kanal.",
        ephemeral: true
      });
      return;
    }

    const selected = interaction.options.getChannel("channel") ?? interaction.channel;
    if (
      !selected ||
      (selected.type !== ChannelType.GuildText && selected.type !== ChannelType.GuildAnnouncement)
    ) {
      await interaction.reply({
        content: "Bitte nutze den Befehl in einem Textkanal oder wähle einen Textkanal aus.",
        ephemeral: true
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    const permissions = botMember ? selected.permissionsFor(botMember) : null;
    if (
      !permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ])
    ) {
      await interaction.reply({
        content:
          "Mir fehlen in diesem Kanal **Kanal ansehen**, **Nachrichten senden** oder **Links einbetten**.",
        ephemeral: true
      });
      return;
    }

    await setPostChannel(interaction.guildId, interaction.guild.name, selected.id);
    await interaction.reply({
      content: `✅ <#${selected.id}> ist jetzt der feste Kanal für Session-Zusammenfassungen.`,
      ephemeral: true
    });
  }
};
