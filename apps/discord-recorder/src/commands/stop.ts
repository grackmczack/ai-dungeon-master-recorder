import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";
import { convertWavToMp3 } from "../services/converter.service.js";
import { transcriptionQueue } from "../services/queue.service.js";
import { createSessionRecord } from "../services/database.service.js";

export function createStopCommand(voiceRecorderService: VoiceRecorderService): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop the current recording session."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;

      if (!guildId) {
        await interaction.reply({ content: "This command can only be used in a Discord server.", ephemeral: true });
        return;
      }

      await interaction.deferReply();

      try {
        const recording = await voiceRecorderService.stop(guildId);

        await interaction.editReply("⏳ Aufnahme gestoppt. Konvertiere zu MP3...");

        let mp3Filename = recording.filename;
        let mp3Path = recording.filePath;
        let durationSeconds = 0;

        try {
          const converted = await convertWavToMp3(recording.filePath);
          mp3Filename = converted.mp3Filename;
          mp3Path = converted.mp3Path;
          durationSeconds = converted.durationSeconds;
        } catch (convErr) {
          console.error("[CONVERTER] FFmpeg conversion failed, keeping WAV:", convErr);
          await interaction.editReply("⚠️ MP3-Konvertierung fehlgeschlagen, WAV wird behalten.");
        }

        // Discord-Namen der Teilnehmer holen
        const participantNames = new Map<string, string>();
        for (const userId of recording.participantIds) {
          try {
            const member = await interaction.guild?.members.fetch(userId);
            participantNames.set(userId, member?.displayName ?? userId);
          } catch {
            participantNames.set(userId, userId);
          }
        }

        // Session + Recording in DB anlegen
        let sessionId: string | null = null;
        try {
          const dbRecord = await createSessionRecord({
            guildId,
            guildName: interaction.guild?.name,
            filename: mp3Filename,
            filePath: mp3Path,
            durationSeconds,
            participantIds: recording.participantIds,
            participantNames
          });
          sessionId = dbRecord.sessionId;
          console.log(`[DB] Session ${sessionId} gespeichert`);
        } catch (dbErr) {
          console.error("[DB] Fehler beim Speichern der Session:", dbErr);
          // Kein hard fail — Transcription trotzdem queuen
        }

        // BullMQ Job
        const job = await transcriptionQueue.add("transcribe", {
          sessionId: sessionId ?? mp3Filename.replace(/\.[^.]+$/, ""),
          guildId,
          filePath: mp3Path,
          filename: mp3Filename,
          durationSeconds,
          discordChannelId: interaction.channelId
        });

        console.log(`[QUEUE] Job ${job.id} für ${mp3Filename} eingereiht`);

        const durationStr = durationSeconds > 0 ? ` (${Math.round(durationSeconds)}s)` : "";
        const participantList = [...participantNames.values()].join(", ");

        await interaction.editReply(
          `✅ **Aufnahme gespeichert:** \`${mp3Filename}\`${durationStr}\n` +
          `👥 **Teilnehmer:** ${participantList || "keine erkannt"}\n` +
          `🔄 **Transkription läuft** — die Zusammenfassung erscheint hier wenn fertig.`
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
