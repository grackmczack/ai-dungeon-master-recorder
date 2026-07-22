import {
  ChannelType,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildBasedChannel
} from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import {
  configureCampaignBinding,
  discordAccessBlockedMessage,
  getGuildCampaigns,
  setCampaignBindingState
} from "../services/database.service.js";

function channelLabel(channel: GuildBasedChannel | null): string {
  return channel ? channel.name : "unbekannter Kanal";
}

export const campaignCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("kampagne")
    .setDescription("Verknüpft Kampagnen mit Voice- und Summary-Kanälen")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("verbinden")
        .setDescription("Kampagne mit einem Voice- und Summary-Kanal verbinden")
        .addStringOption((option) =>
          option
            .setName("kampagne")
            .setDescription("Kampagne aus dem verbundenen Web-Panel")
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("voice-channel")
            .setDescription("Voice-Channel; ohne Auswahl dein aktueller Kanal")
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
        .addChannelOption((option) =>
          option
            .setName("summary-channel")
            .setDescription("Kanal für fertige Zusammenfassungen")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addBooleanOption((option) =>
          option.setName("standard").setDescription("Als Standardbindung markieren")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("aktivieren")
        .setDescription("Eine Kampagnenbindung aktivieren")
        .addStringOption((option) =>
          option
            .setName("kampagne")
            .setDescription("Kampagne und Voice-Channel")
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("deaktivieren")
        .setDescription("Eine Kampagnenbindung deaktivieren")
        .addStringOption((option) =>
          option
            .setName("kampagne")
            .setDescription("Kampagne und Voice-Channel")
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("Alle Kampagnenbindungen dieses Servers anzeigen")
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guildId) return interaction.respond([]);
    const focused = interaction.options.getFocused().toLowerCase();
    const subcommand = interaction.options.getSubcommand();
    const { campaigns } = await getGuildCampaigns(interaction.guildId);

    if (subcommand === "verbinden") {
      const unique = new Map<string, string>();
      for (const binding of campaigns) unique.set(binding.campaignId, binding.campaignName);
      await interaction.respond(
        [...unique.entries()]
          .filter(([, name]) => name.toLowerCase().includes(focused))
          .slice(0, 25)
          .map(([value, name]) => ({ name, value }))
      );
      return;
    }

    const targetActive = subcommand === "deaktivieren";
    await interaction.respond(
      campaigns
        .filter((binding) => binding.isActive === targetActive)
        .map((binding) => ({
          name: `${binding.campaignName} · ${binding.voiceChannelName ?? "ohne Voice-Channel"}`,
          value: binding.bindingId
        }))
        .filter((choice) => choice.name.toLowerCase().includes(focused))
        .slice(0, 25)
    );
  },

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
    const configured = await getGuildCampaigns(interaction.guildId);

    if (configured.accessStatus !== "READY") {
      await interaction.reply({
        content: `🔒 ${discordAccessBlockedMessage(configured.accessStatus)} Nutze \`/status\` für die nächsten Schritte.`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === "status") {
      const lines = configured.campaigns.map(
        (binding) =>
          `${binding.isActive ? "🟢" : "⚫"} **${binding.campaignName}**` +
          ` · ${
            binding.voiceChannelId
              ? `<#${binding.voiceChannelId}>`
              : "Voice wird beim nächsten /record festgelegt"
          }` +
          ` · ${binding.summaryChannelId ? `Summary <#${binding.summaryChannelId}>` : "kein Summary-Kanal"}`
      );
      await interaction.reply({
        content:
          lines.length > 0
            ? lines.join("\n")
            : "Noch keine Kampagne verbunden. Verbinde den Server zuerst über das Web-Panel.",
        ephemeral: true
      });
      return;
    }

    if (subcommand === "aktivieren" || subcommand === "deaktivieren") {
      const bindingId = interaction.options.getString("kampagne", true);
      const binding = configured.campaigns.find((item) => item.bindingId === bindingId);
      if (!binding) {
        await interaction.reply({
          content: "Diese Kampagnenbindung ist ungültig.",
          ephemeral: true
        });
        return;
      }
      const isActive = subcommand === "aktivieren";
      await setCampaignBindingState({ guildId: interaction.guildId, bindingId, isActive });
      await interaction.reply({
        content: `${isActive ? "🟢" : "⚫"} **${binding.campaignName}** ist auf diesem Server jetzt ${isActive ? "aktiv" : "inaktiv"}.`,
        ephemeral: true
      });
      return;
    }

    const campaignId = interaction.options.getString("kampagne", true);
    const knownCampaign = configured.campaigns.find((item) => item.campaignId === campaignId);
    if (!knownCampaign) {
      await interaction.reply({
        content:
          "Diese Kampagne gehört nicht zum verbundenen Web-Panel. Verknüpfe sie dort zuerst mit diesem Discord-Server.",
        ephemeral: true
      });
      return;
    }

    const member = interaction.member instanceof GuildMember ? interaction.member : null;
    const voiceChannel = interaction.options.getChannel("voice-channel") ?? member?.voice.channel;
    if (
      !voiceChannel ||
      (voiceChannel.type !== ChannelType.GuildVoice &&
        voiceChannel.type !== ChannelType.GuildStageVoice)
    ) {
      await interaction.reply({
        content: "Wähle einen Voice-Channel oder betrete zuerst einen.",
        ephemeral: true
      });
      return;
    }
    const summaryChannel = interaction.options.getChannel("summary-channel");
    if (summaryChannel) {
      const botMember = interaction.guild.members.me;
      const permissions = botMember ? summaryChannel.permissionsFor(botMember) : null;
      if (
        !permissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks
        ])
      ) {
        await interaction.reply({
          content:
            "Mir fehlen im Summary-Kanal **Kanal ansehen**, **Nachrichten senden** oder **Links einbetten**.",
          ephemeral: true
        });
        return;
      }
    }

    const binding = await configureCampaignBinding({
      guildId: interaction.guildId,
      guildName: interaction.guild.name,
      campaignId,
      voiceChannelId: voiceChannel.id,
      voiceChannelName: channelLabel(voiceChannel),
      summaryChannelId: summaryChannel?.id ?? knownCampaign.summaryChannelId,
      summaryChannelName: summaryChannel
        ? channelLabel(summaryChannel)
        : knownCampaign.summaryChannelName,
      isDefault: interaction.options.getBoolean("standard") ?? false
    });
    await interaction.reply({
      content:
        `✅ **${binding.campaignName}** ist mit <#${binding.voiceChannelId}> verbunden.` +
        (binding.summaryChannelId
          ? ` Zusammenfassungen gehen an <#${binding.summaryChannelId}>.`
          : " Zusammenfassungen gehen an den Kanal von `/record`."),
      ephemeral: true
    });
  }
};
