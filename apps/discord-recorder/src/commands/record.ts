import {
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction
} from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";
import { makeRecordingKey } from "../services/voice-recorder.service.js";
import type { ChunkProcessorService } from "../services/chunk-processor.service.js";
import {
  BackendRequestError,
  getDiscordConnectLink,
  getGuildCampaigns
} from "../services/database.service.js";

async function campaignAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const focused = interaction.options.getFocused().toLowerCase();
  const { campaigns } = await getGuildCampaigns(interaction.guildId);
  const unique = new Map<string, string>();
  for (const binding of campaigns) {
    if (binding.isActive) unique.set(binding.campaignId, binding.campaignName);
  }
  await interaction.respond(
    [...unique.entries()]
      .filter(([, name]) => name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(([value, name]) => ({ name, value }))
  );
}

export function createRecordCommand(
  voiceRecorderService: VoiceRecorderService,
  chunkProcessor: ChunkProcessorService
): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("record")
      .setDescription("Startet die Aufnahme einer Session.")
      .addStringOption((option) =>
        option
          .setName("kampagne")
          .setDescription("Kampagne; bei eindeutiger Kanalzuordnung optional")
          .setAutocomplete(true)
      ),

    autocomplete: campaignAutocomplete,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.inCachedGuild() || !(interaction.member instanceof GuildMember)) {
        await interaction.reply({
          content: "Dieser Befehl kann nur auf einem Discord-Server verwendet werden.",
          ephemeral: true
        });
        return;
      }

      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        await interaction.reply({
          content: "Du musst in einem Voice-Channel sein, um die Aufnahme zu starten.",
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply();

      const guildId = interaction.guildId;
      const selectedCampaignId = interaction.options.getString("kampagne") ?? undefined;
      const recordingKey = makeRecordingKey(guildId, voiceChannel.id);

      try {
        const configured = await getGuildCampaigns(guildId);
        const activeBindings = configured.campaigns.filter((binding) => binding.isActive);
        const exactChannelBinding = activeBindings.find(
          (binding) => binding.voiceChannelId === voiceChannel.id
        );
        const selectedBinding = selectedCampaignId
          ? activeBindings.find((binding) => binding.campaignId === selectedCampaignId)
          : undefined;

        if (
          selectedCampaignId &&
          (!selectedBinding ||
            (exactChannelBinding && exactChannelBinding.campaignId !== selectedCampaignId))
        ) {
          await interaction.editReply(
            "Diese Kampagne ist hier nicht aktiv oder der Voice-Channel gehört bereits zu einer anderen Kampagne. Nutze `/kampagne verbinden`."
          );
          return;
        }

        const activeCampaignIds = new Set(activeBindings.map((binding) => binding.campaignId));
        const campaignId =
          selectedBinding?.campaignId ??
          exactChannelBinding?.campaignId ??
          (activeCampaignIds.size === 1 ? [...activeCampaignIds][0] : undefined);

        if (!campaignId && activeCampaignIds.size > 1) {
          await interaction.editReply(
            "Mehrere Kampagnen sind aktiv. Wähle bei `/record` eine Kampagne oder verbinde diesen Voice-Channel mit `/kampagne verbinden`."
          );
          return;
        }

        const participantIds: string[] = [];
        const participantNames = new Map<string, string>();
        const participantDisplayNames = new Map<string, string>();
        for (const [, member] of voiceChannel.members) {
          if (member.user.bot) continue;
          participantIds.push(member.user.id);
          participantNames.set(member.user.id, member.user.username);
          participantDisplayNames.set(member.user.id, member.displayName);
        }

        const onChunkReady = async (
          chunk: { filename: string; filePath: string; index: number },
          isLast: boolean
        ) => chunkProcessor.processChunk(recordingKey, chunk, isLast);

        const onAutoStop = async () => {
          if (!voiceRecorderService.isRecording(guildId, voiceChannel.id)) return;
          try {
            await voiceRecorderService.stop(recordingKey);
            await interaction.followUp(
              "🔇 **Auto-Stop:** Aufnahme wurde automatisch beendet.\n" +
                "🔄 Transkription läuft — du bekommst eine Nachricht, wenn die Zusammenfassung fertig ist."
            );
          } catch (error) {
            console.error("[AUTO-STOP] Error:", error);
          }
        };

        await voiceRecorderService.start(interaction.member, onChunkReady, onAutoStop);
        try {
          await chunkProcessor.initSession(recordingKey, {
            guildId,
            guildName: interaction.guild.name,
            campaignId,
            voiceChannelId: voiceChannel.id,
            voiceChannelName: voiceChannel.name,
            participantIds,
            participantNames,
            participantDisplayNames,
            discordChannelId: interaction.channelId
          });
        } catch (error) {
          await voiceRecorderService.cancel(recordingKey);
          throw error;
        }

        const participantList = participantIds
          .map((id) => participantDisplayNames.get(id) ?? participantNames.get(id) ?? id)
          .join(", ");
        const campaignName =
          activeBindings.find((binding) => binding.campaignId === campaignId)?.campaignName ??
          "neue Kampagne";

        await interaction.editReply(
          `🔴 **Aufnahme gestartet!**\n` +
            `🗺️ **Kampagne:** ${campaignName}\n` +
            `👥 **Teilnehmer:** ${participantList || "werden beim Sprechen erkannt"}\n` +
            `📦 Chunks alle 30 Min · Auto-Stop wenn alle weg · Max 4h\n` +
            `Stoppe mit \`/stop\`, wenn ihr fertig seid.`
        );

        if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          try {
            const link = await getDiscordConnectLink(guildId, interaction.guild.name);
            if (link.connectUrl) {
              await interaction.followUp({
                content:
                  `🔗 **Dieser Server ist noch nicht mit dem Web-Panel verbunden.**\n` +
                  `[Jetzt verbinden](${link.connectUrl}) — der Link ist 15 Minuten gültig und nur für dich sichtbar.`,
                flags: MessageFlags.Ephemeral
              });
            }
          } catch (error) {
            console.error(`[RECORD] Web-Verbindungslink für ${guildId} fehlgeschlagen`, error);
          }
        }
      } catch (error) {
        chunkProcessor.cleanup(recordingKey);
        if (error instanceof BackendRequestError) {
          if (error.errorCode === "CAMPAIGN_SELECTION_REQUIRED") {
            await interaction.editReply(
              "Mehrere Kampagnen kommen infrage. Bitte wähle eine Kampagne bei `/record`."
            );
            return;
          }
          if (error.errorCode === "VOICE_CHANNEL_BOUND_TO_OTHER_CAMPAIGN") {
            await interaction.editReply(
              "Dieser Voice-Channel ist bereits einer anderen Kampagne zugeordnet."
            );
            return;
          }
        }
        if (error instanceof Error && error.message === "RECORDING_ALREADY_ACTIVE") {
          await interaction.editReply("Auf diesem Server läuft bereits eine Aufnahme.");
          return;
        }
        if (error instanceof Error && error.message === "VOICE_CONNECTION_FAILED") {
          await interaction.editReply(
            "Die Voice-Verbindung konnte nicht hergestellt werden. Bitte versuche es erneut."
          );
          return;
        }
        throw error;
      }
    }
  };
}
