/**
 * ChunkProcessorService
 * Verwaltet Chunks einer Aufnahme-Session:
 * - Konvertiert WAV → MP3 per Chunk (downsampled 16kHz mono 64kbps)
 * - Entfernt die sehr große WAV-Datei nach erfolgreicher MP3-Konvertierung
 * - Beim letzten Chunk: enqueued ein Batch-Job alle MP3-Chunks in numerischer Reihenfolge
 */
import { convertWavToMp3 } from "./converter.service.js";
import { transcriptionQueue } from "./queue.service.js";
import { createSessionRecord, markSessionRecordingComplete } from "./database.service.js";
import { promises as fs } from "node:fs";

interface ChunkInfo {
  filename: string;
  filePath: string;
  index: number;
}

interface SessionMeta {
  guildId: string;
  guildName?: string | undefined;
  campaignId?: string | undefined;
  voiceChannelId: string;
  voiceChannelName: string;
  participantIds: string[];
  participantNames: Map<string, string>;
  participantDisplayNames?: Map<string, string>;
  discordChannelId: string;
  sessionId?: string;
  bindingId?: string;
  summaryChannelId?: string | null;
}

/** Metadaten eines konvertierten Chunks für den Batch-Job */
interface ChunkJobMeta {
  index: number;
  filePath: string;
  filename: string;
  durationSeconds: number;
  wavPath: string; // original WAV path (für speaker logs)
}

export class ChunkProcessorService {
  private readonly pendingChunks = new Map<string, ChunkJobMeta[]>(); // recordingKey → MP3-Chunks
  private readonly sessionMetas = new Map<string, SessionMeta>();

  public async initSession(recordingKey: string, meta: SessionMeta): Promise<void> {
    this.pendingChunks.set(recordingKey, []);
    this.sessionMetas.set(recordingKey, meta);

    try {
      const record = await createSessionRecord({
        guildId: meta.guildId,
        guildName: meta.guildName,
        campaignId: meta.campaignId,
        voiceChannelId: meta.voiceChannelId,
        voiceChannelName: meta.voiceChannelName,
        textChannelId: meta.discordChannelId,
        filename: `session-${meta.guildId}-${meta.voiceChannelId}-pending.mp3`,
        filePath: "",
        durationSeconds: 0,
        participantIds: meta.participantIds,
        participantNames: meta.participantNames,
        participantDisplayNames: meta.participantDisplayNames
      });
      meta.sessionId = record.sessionId;
      meta.campaignId = record.campaignId;
      meta.bindingId = record.bindingId;
      meta.summaryChannelId = record.summaryChannelId;
      this.sessionMetas.set(recordingKey, meta);
      console.log(`[CHUNK-PROCESSOR] Session ${record.sessionId} in DB angelegt`);
    } catch (e) {
      this.cleanup(recordingKey);
      console.error("[CHUNK-PROCESSOR] DB session creation failed:", e);
      throw e;
    }
  }

  public async processChunk(
    recordingKey: string,
    chunk: ChunkInfo,
    isLast: boolean
  ): Promise<void> {
    const meta = this.sessionMetas.get(recordingKey);
    if (!meta) {
      console.error(`[CHUNK-PROCESSOR] Keine Session-Metadaten für ${recordingKey}`);
      return;
    }

    console.log(
      `[CHUNK-PROCESSOR] Processing chunk ${chunk.index} for ${recordingKey} (isLast: ${isLast})`
    );

    // WAV → MP3 (downsampled 16kHz mono 64kbps)
    let mp3Path = chunk.filePath;
    let mp3Filename = chunk.filename;
    let durationSeconds = 0;

    try {
      let converted: Awaited<ReturnType<typeof convertWavToMp3>> | null = null;
      let conversionError: unknown;
      for (let attempt = 1; attempt <= 3 && !converted; attempt++) {
        try {
          converted = await convertWavToMp3(chunk.filePath);
        } catch (error) {
          conversionError = error;
          await fs.unlink(chunk.filePath.replace(/\.wav$/i, ".mp3")).catch(() => undefined);
          console.warn(
            `[CHUNK-PROCESSOR] Conversion attempt ${attempt}/3 failed for chunk ${chunk.index}`
          );
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          }
        }
      }
      if (!converted) throw conversionError ?? new Error("Audio conversion failed");
      mp3Path = converted.mp3Path;
      mp3Filename = converted.mp3Filename;
      durationSeconds = converted.durationSeconds;
      console.log(
        `[CHUNK-PROCESSOR] Chunk ${chunk.index} converted: ${mp3Filename} (${Math.round(durationSeconds)}s, 16kHz mono 64kbps)`
      );
      // Die Sprecher-Zeitspur liegt separat als JSON vor. Nach erfolgreicher
      // Komprimierung wird die mehrere hundert MB große WAV-Datei nicht mehr
      // für Recovery benötigt; der MP3-Chunk bleibt für Verarbeitung/Playback.
      await fs.unlink(chunk.filePath).catch((error) => {
        console.warn(`[CHUNK-PROCESSOR] WAV cleanup failed for ${chunk.filePath}:`, error);
      });
    } catch (e) {
      console.error(`[CHUNK-PROCESSOR] Chunk ${chunk.index} conversion failed:`, e);
      // Eine unkomprimierte 30-Minuten-WAV ist für externe APIs ungeeignet.
      // Nach drei lokalen Versuchen bleibt die WAV zur Diagnose/Recovery liegen.
      throw e;
    }

    const chunks = this.pendingChunks.get(recordingKey) ?? [];
    chunks.push({
      index: chunk.index,
      filePath: mp3Path,
      filename: mp3Filename,
      durationSeconds,
      wavPath: chunk.filePath // original WAV path for speaker log lookup
    });
    this.pendingChunks.set(recordingKey, chunks);

    if (isLast) {
      // Session beendet → ALLE Chunks als Batch-Job enqueuen
      const allChunks = [...chunks].sort((a, b) => a.index - b.index);
      const totalDuration = allChunks.reduce((sum, c) => sum + c.durationSeconds, 0);

      console.log(
        `[CHUNK-PROCESSOR] Last chunk processed — ${allChunks.length} chunk(s) total, ${Math.round(totalDuration)}s duration`
      );
      console.log(
        `[CHUNK-PROCESSOR] Enqueuing batch transcription job for session ${meta.sessionId}`
      );

      if (!meta.sessionId) throw new Error(`Keine Backend-Session für ${recordingKey}`);
      await markSessionRecordingComplete(meta.sessionId);

      await transcriptionQueue.add("transcribe-batch", {
        sessionId: meta.sessionId,
        guildId: meta.guildId,
        campaignId: meta.campaignId,
        bindingId: meta.bindingId,
        voiceChannelId: meta.voiceChannelId,
        summaryChannelId: meta.summaryChannelId ?? undefined,
        filePath: allChunks[0]!.filePath, // first chunk path for compatibility
        filename: allChunks[0]!.filename,
        durationSeconds: totalDuration,
        discordChannelId: meta.discordChannelId,
        // Batch-spezifische Felder
        batchChunks: allChunks.map((c) => ({
          index: c.index,
          filePath: c.filePath,
          filename: c.filename,
          durationSeconds: c.durationSeconds,
          wavPath: c.wavPath
        }))
      });

      this.pendingChunks.delete(recordingKey);
      this.sessionMetas.delete(recordingKey);
    }
  }

  public cleanup(recordingKey: string): void {
    this.pendingChunks.delete(recordingKey);
    this.sessionMetas.delete(recordingKey);
  }
}
