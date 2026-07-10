/**
 * ChunkProcessorService
 * Verwaltet Chunks einer Aufnahme-Session:
 * - Konvertiert WAV → MP3 per Chunk
 * - Schiebt Transcription-Jobs in die Queue
 * - Beim letzten Chunk: sendet Merge+Summarize-Job
 */
import { convertWavToMp3 } from "./converter.service.js";
import { transcriptionQueue } from "./queue.service.js";
import { createSessionRecord } from "./database.service.js";
import type { GuildMember } from "discord.js";

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

export class ChunkProcessorService {
  private readonly pendingChunks = new Map<string, ChunkInfo[]>(); // guildId → processed mp3 chunks
  private readonly sessionMetas = new Map<string, SessionMeta>();

  public async initSession(guildId: string, meta: SessionMeta): Promise<void> {
    this.pendingChunks.set(guildId, []);
    this.sessionMetas.set(guildId, meta);

    // Session in DB anlegen (einmalig beim Start)
    try {
      const record = await createSessionRecord({
        guildId: meta.guildId,
        guildName: meta.guildName,
        filename: `session-${guildId}-pending.mp3`, // Platzhalter, wird bei Stop aktualisiert
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
      console.error("[CHUNK-PROCESSOR] DB session creation failed:", e);
    }
  }

  public async processChunk(
    guildId: string,
    chunk: ChunkInfo,
    isLast: boolean
  ): Promise<void> {
    const meta = this.sessionMetas.get(guildId);
    if (!meta) {
      console.error(`[CHUNK-PROCESSOR] No session meta for guild ${guildId}`);
      return;
    }

    console.log(`[CHUNK-PROCESSOR] Processing chunk ${chunk.index} for guild ${guildId} (isLast: ${isLast})`);

    // WAV → MP3
    let mp3Path = chunk.filePath;
    let mp3Filename = chunk.filename;
    let durationSeconds = 0;

    try {
      const converted = await convertWavToMp3(chunk.filePath);
      mp3Path = converted.mp3Path;
      mp3Filename = converted.mp3Filename;
      durationSeconds = converted.durationSeconds;
      console.log(`[CHUNK-PROCESSOR] Chunk ${chunk.index} converted: ${mp3Filename} (${Math.round(durationSeconds)}s)`);
    } catch (e) {
      console.error(`[CHUNK-PROCESSOR] Chunk ${chunk.index} conversion failed:`, e);
    }

    // MP3-Chunk merken
    const chunks = this.pendingChunks.get(guildId) ?? [];
    chunks.push({ filename: mp3Filename, filePath: mp3Path, index: chunk.index });
    this.pendingChunks.set(guildId, chunks);

    // Transcription-Job für diesen Chunk
    await transcriptionQueue.add("transcribe-chunk", {
      sessionId: meta.sessionId ?? guildId,
      guildId,
      filePath: mp3Path,
      filename: mp3Filename,
      durationSeconds,
      chunkIndex: chunk.index,
      isLastChunk: isLast,
      totalChunks: isLast ? chunks.length : undefined,
      discordChannelId: meta.discordChannelId
    });

    console.log(`[CHUNK-PROCESSOR] Transcription job queued for chunk ${chunk.index}`);

    if (isLast) {
      console.log(`[CHUNK-PROCESSOR] Last chunk processed — ${chunks.length} chunk(s) total for session ${meta.sessionId}`);
      this.pendingChunks.delete(guildId);
      this.sessionMetas.delete(guildId);
    }
  }

  public cleanup(guildId: string): void {
    this.pendingChunks.delete(guildId);
    this.sessionMetas.delete(guildId);
  }
}
