/**
 * ChunkProcessorService
 * Verwaltet Chunks einer Aufnahme-Session:
 * - Konvertiert WAV → MP3 per Chunk (downsampled 16kHz mono 64kbps)
 * - Beim letzten Chunk: enqueued Batch-Job mit allen MP3-Chunks
 * - Worker entscheidet ob concat oder per-chunk (abhängig vom Provider)
 */
import { convertWavToMp3 } from "./converter.service.js";
import { transcriptionQueue } from "./queue.service.js";
import { createSessionRecord } from "./database.service.js";

interface ChunkInfo {
  filename: string;
  filePath: string;
  index: number;
}

interface SessionMeta {
  guildId: string;
  guildName?: string | undefined;
  participantIds: string[];
  participantNames: Map<string, string>;
  participantDisplayNames?: Map<string, string>;
  discordChannelId: string;
  sessionId?: string;
}

/** Metadaten eines konvertierten Chunks für den Batch-Job */
interface ChunkJobMeta {
  filePath: string;
  filename: string;
  durationSeconds: number;
  wavPath: string; // original WAV path (für speaker logs)
}

export class ChunkProcessorService {
  private readonly pendingChunks = new Map<string, ChunkJobMeta[]>(); // guildId → converted mp3 chunks
  private readonly sessionMetas = new Map<string, SessionMeta>();

  public async initSession(guildId: string, meta: SessionMeta): Promise<void> {
    this.pendingChunks.set(guildId, []);
    this.sessionMetas.set(guildId, meta);

    try {
      const record = await createSessionRecord({
        guildId: meta.guildId,
        guildName: meta.guildName,
        filename: `session-${guildId}-pending.mp3`,
        filePath: "",
        durationSeconds: 0,
        participantIds: meta.participantIds,
        participantNames: meta.participantNames,
        participantDisplayNames: meta.participantDisplayNames
      });
      meta.sessionId = record.sessionId;
      this.sessionMetas.set(guildId, meta);
      console.log(`[CHUNK-PROCESSOR] Session ${record.sessionId} in DB angelegt`);
    } catch (e) {
      this.cleanup(guildId);
      console.error("[CHUNK-PROCESSOR] DB session creation failed:", e);
      throw e;
    }
  }

  public async processChunk(guildId: string, chunk: ChunkInfo, isLast: boolean): Promise<void> {
    const meta = this.sessionMetas.get(guildId);
    if (!meta) {
      console.error(`[CHUNK-PROCESSOR] No session meta for guild ${guildId}`);
      return;
    }

    console.log(
      `[CHUNK-PROCESSOR] Processing chunk ${chunk.index} for guild ${guildId} (isLast: ${isLast})`
    );

    // WAV → MP3 (downsampled 16kHz mono 64kbps)
    let mp3Path = chunk.filePath;
    let mp3Filename = chunk.filename;
    let durationSeconds = 0;

    try {
      const converted = await convertWavToMp3(chunk.filePath);
      mp3Path = converted.mp3Path;
      mp3Filename = converted.mp3Filename;
      durationSeconds = converted.durationSeconds;
      console.log(
        `[CHUNK-PROCESSOR] Chunk ${chunk.index} converted: ${mp3Filename} (${Math.round(durationSeconds)}s, 16kHz mono 64kbps)`
      );
    } catch (e) {
      console.error(`[CHUNK-PROCESSOR] Chunk ${chunk.index} conversion failed:`, e);
    }

    const chunks = this.pendingChunks.get(guildId) ?? [];
    chunks.push({
      filePath: mp3Path,
      filename: mp3Filename,
      durationSeconds,
      wavPath: chunk.filePath // original WAV path for speaker log lookup
    });
    this.pendingChunks.set(guildId, chunks);

    if (isLast) {
      // Session beendet → ALLE Chunks als Batch-Job enqueuen
      const allChunks = [...chunks].sort((a, b) => a.filename.localeCompare(b.filename));
      const totalDuration = allChunks.reduce((sum, c) => sum + c.durationSeconds, 0);

      console.log(
        `[CHUNK-PROCESSOR] Last chunk processed — ${allChunks.length} chunk(s) total, ${Math.round(totalDuration)}s duration`
      );
      console.log(
        `[CHUNK-PROCESSOR] Enqueuing batch transcription job for session ${meta.sessionId}`
      );

      await transcriptionQueue.add("transcribe-batch", {
        sessionId: meta.sessionId ?? guildId,
        guildId,
        filePath: allChunks[0]!.filePath, // first chunk path for compatibility
        filename: allChunks[0]!.filename,
        durationSeconds: totalDuration,
        discordChannelId: meta.discordChannelId,
        // Batch-spezifische Felder
        batchChunks: allChunks.map((c) => ({
          filePath: c.filePath,
          filename: c.filename,
          durationSeconds: c.durationSeconds,
          wavPath: c.wavPath
        }))
      });

      this.pendingChunks.delete(guildId);
      this.sessionMetas.delete(guildId);
    }
  }

  public cleanup(guildId: string): void {
    this.pendingChunks.delete(guildId);
    this.sessionMetas.delete(guildId);
  }
}
