import { GuildMember, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";
import type { ChunkProcessorService } from "../services/chunk-processor.service.js";

export function createRecordCommand(
  voiceRecorderService: VoiceRecorderService,
  chunkProcessor: ChunkProcessorService
): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("record")
      .setDescription("Start a recording session."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.inCachedGuild() || !(interaction.member instanceof GuildMember)) {
        await interaction.reply({ content: "This command can only be used in a Discord server.", ephemeral: true });
        return;
      }

      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const channelId = interaction.channelId;

      // Chunk-Ready Callback — wird für jeden Chunk aufgerufen
      const onChunkReady = async (chunk: { filename: string; filePath: string; index: number }, isLast: boolean) => {
        await chunkProcessor.processChunk(guildId, chunk, isLast);
      };

      // Auto-Stop Callback — wenn alle User weg sind oder Max-Zeit erreicht
      const onAutoStop = async () => {
        if (!voiceRecorderService.isRecording(guildId)) return;
        try {
          await voiceRecorderService.stop(guildId);
          await interaction.followUp(
            "🔇 **Auto-Stop:** Aufnahme wurde automatisch beendet.\n" +
            "🔄 Transkription läuft — du bekommst eine Nachricht wenn die Summary fertig ist."
          );
        } catch (e) {
          console.error("[AUTO-STOP] Error:", e);
        }
      };

      try {
        // Participant-Namen vorab sammeln
        const voiceChannel = interaction.member.voice.channel;
        const participantIds: string[] = [];
        const participantNames = new Map<string, string>();        // Username (eindeutig, z.B. "veganrevlady")
        const participantDisplayNames = new Map<string, string>(); // Anzeigename (z.B. "Rose")

        if (voiceChannel) {
          for (const [, member] of voiceChannel.members) {
            if (member.user.bot) continue;
            participantIds.push(member.user.id);
            // discordName = eindeutiger Username (matcht GroupMembership.discordName),
            // participantDisplayNames = Server-Nickname / globaler Anzeigename.
            participantNames.set(member.user.id, member.user.username);
            participantDisplayNames.set(member.user.id, member.displayName);
          }
        }

        // Session in DB anlegen
        await chunkProcessor.initSession(guildId, {
          guildId,
          guildName: interaction.guild?.name,
          participantIds,
          participantNames,
          participantDisplayNames,
          discordChannelId: channelId
        });

        await voiceRecorderService.start(interaction.member, onChunkReady, onAutoStop);

        const participantList = participantIds
          .map(id => participantDisplayNames.get(id) ?? participantNames.get(id) ?? id)
          .join(", ");

        await interaction.editReply(
          `🔴 **Aufnahme gestartet!**\n` +
          `👥 **Teilnehmer:** ${participantList || "wird erkannt wenn gesprochen wird"}\n` +
          `📦 Chunks alle 30 Min · Auto-Stop wenn alle weg · Max 4h\n` +
          `Stoppe mit \`/stop\` wenn ihr fertig seid.`
        );
      } catch (error) {
        chunkProcessor.cleanup(guildId);
        if (error instanceof Error && error.message === "USER_NOT_IN_VOICE_CHANNEL") {
          await interaction.editReply("Du musst in einem Voice-Channel sein um die Aufnahme zu starten.");
          return;
        }
        if (error instanceof Error && error.message === "RECORDING_ALREADY_ACTIVE") {
          await interaction.editReply("Es läuft bereits eine Aufnahme in diesem Server.");
          return;
        }
        throw error;
      }
    }
  };
}
