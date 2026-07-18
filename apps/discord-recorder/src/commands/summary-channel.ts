import {
  ChannelType,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction
} from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import {
  configureCampaignBinding,
  getGuildCampaigns,
  type GuildCampaignBinding
} from "../services/database.service.js";

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const focused = interaction.options.getFocused().toLowerCase();
  const { campaigns } = await getGuildCampaigns(interaction.guildId);
  await interaction.respond(
    campaigns
      .filter((binding) => binding.isActive)
      .map((binding) => ({
        name: `${binding.campaignName} · ${binding.voiceChannelName ?? "ohne Voice-Channel"}`,
        value: binding.bindingId
      }))
      .filter((choice) => choice.name.toLowerCase().includes(focused))
      .slice(0, 25)
  );
}

function resolveBinding(
  bindings: GuildCampaignBinding[],
  selectedId: string | null,
  voiceChannelId: string | null
): GuildCampaignBinding | null {
  if (selectedId) return bindings.find((binding) => binding.bindingId === selectedId) ?? null;
  if (voiceChannelId) {
    const voiceBinding = bindings.find((binding) => binding.voiceChannelId === voiceChannelId);
    if (voiceBinding) return voiceBinding;
  }
  const active = bindings.filter((binding) => binding.isActive);
  return active.length === 1 ? active[0]! : null;
}

export const summaryChannelCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("summary-channel")
    .setDescription("Summary-Kanal einer Kampagne verwalten")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Summary-Kanal für eine Kampagne setzen")
        .addStringOption((option) =>
          option
            .setName("kampagne")
            .setDescription("Bei mehreren Kampagnen auswählen")
            .setAutocomplete(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Zielkanal; Standard ist der aktuelle Kanal")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Konfigurierte Summary-Kanäle anzeigen")
        .addStringOption((option) =>
          option.setName("kampagne").setDescription("Optional filtern").setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear")
        .setDescription("Summary-Kanal einer Kampagne entfernen")
        .addStringOption((option) =>
          option
            .setName("kampagne")
            .setDescription("Bei mehreren Kampagnen auswählen")
            .setAutocomplete(true)
        )
    ),

  autocomplete,

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

    const { campaigns } = await getGuildCampaigns(interaction.guildId);
    const selectedId = interaction.options.getString("kampagne");
    const member = interaction.member instanceof GuildMember ? interaction.member : null;
    const binding = resolveBinding(campaigns, selectedId, member?.voice.channelId ?? null);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status" && !selectedId) {
      const lines = campaigns.map(
        (item) =>
          `**${item.campaignName}** (${item.voiceChannelId ? `<#${item.voiceChannelId}>` : "kein Voice-Channel"}): ` +
          (item.summaryChannelId ? `<#${item.summaryChannelId}>` : "Kanal von `/record`")
      );
      await interaction.reply({
        content: lines.length ? lines.join("\n") : "Noch keine Kampagne verbunden.",
        ephemeral: true
      });
      return;
    }

    if (!binding) {
      await interaction.reply({
        content:
          "Die Kampagne ist nicht eindeutig. Wähle sie im Befehl aus oder nutze den Befehl in ihrem Voice-Channel.",
        ephemeral: true
      });
      return;
    }
    if (!binding.voiceChannelId || !binding.voiceChannelName) {
      await interaction.reply({
        content: "Verbinde zuerst mit `/kampagne verbinden` einen Voice-Channel.",
        ephemeral: true
      });
      return;
    }

    if (subcommand === "status") {
      await interaction.reply({
        content: binding.summaryChannelId
          ? `📌 **${binding.campaignName}** postet Zusammenfassungen in <#${binding.summaryChannelId}>.`
          : `**${binding.campaignName}** verwendet den Kanal von \`/record\`.`,
        ephemeral: true
      });
      return;
    }

    const selectedChannel =
      subcommand === "clear"
        ? null
        : (interaction.options.getChannel("channel") ?? interaction.channel);
    if (
      selectedChannel &&
      selectedChannel.type !== ChannelType.GuildText &&
      selectedChannel.type !== ChannelType.GuildAnnouncement
    ) {
      await interaction.reply({ content: "Bitte wähle einen Textkanal aus.", ephemeral: true });
      return;
    }
    if (selectedChannel) {
      const botMember = interaction.guild.members.me;
      const permissions = botMember ? selectedChannel.permissionsFor(botMember) : null;
      if (
        !permissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks
        ])
      ) {
        await interaction.reply({
          content:
            "Mir fehlen dort **Kanal ansehen**, **Nachrichten senden** oder **Links einbetten**.",
          ephemeral: true
        });
        return;
      }
    }

    await configureCampaignBinding({
      guildId: interaction.guildId,
      guildName: interaction.guild.name,
      campaignId: binding.campaignId,
      voiceChannelId: binding.voiceChannelId,
      voiceChannelName: binding.voiceChannelName,
      summaryChannelId: selectedChannel?.id ?? null,
      summaryChannelName: selectedChannel?.name ?? null,
      isDefault: binding.isDefault
    });
    await interaction.reply({
      content: selectedChannel
        ? `✅ **${binding.campaignName}** postet Zusammenfassungen jetzt in <#${selectedChannel.id}>.`
        : `✅ **${binding.campaignName}** verwendet wieder den Kanal von \`/record\`.`,
      ephemeral: true
    });
  }
};
