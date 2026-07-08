import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";
import { convertWavToMp3 } from "../services/converter.service.js";
import { transcriptionQueue } from "../services/queue.service.js";

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

        await interaction.editReply("⏳ Recording stopped. Converting to MP3...");

        let mp3Filename = recording.filename;
        let mp3Path = recording.filePath;
        let durationSeconds = 0;

        try {
          const converted = await convertWavToMp3(recording.filePath);
          mp3Filename = converted.mp3Filename;
          mp3Path = converted.mp3Path;
          durationSeconds = converted.durationSeconds;

          await interaction.editReply(`⏳ MP3 ready (${Math.round(durationSeconds)}s). Queuing transcription...`);
        } catch (convErr) {
          console.error("[CONVERTER] FFmpeg conversion failed, keeping WAV:", convErr);
          await interaction.editReply("⚠️ MP3 conversion failed, keeping WAV. Queuing transcription anyway...");
        }

        // Push job to BullMQ
        const job = await transcriptionQueue.add("transcribe", {
          sessionId: recording.filename.replace(/\.[^.]+$/, ""),
          guildId,
          filePath: mp3Path,
          filename: mp3Filename,
          durationSeconds
        });

        console.log(`[QUEUE] Transcription job ${job.id} queued for ${mp3Filename}`);

        const durationStr = durationSeconds > 0 ? ` (${Math.round(durationSeconds)}s)` : "";
        await interaction.editReply(
          `✅ Recording saved: **${mp3Filename}**${durationStr}\n🔄 Transcription queued — I'll post the summary here when done.`
        );

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
