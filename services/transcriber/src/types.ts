export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface BatchChunkMeta {
  filePath: string;
  filename: string;
  durationSeconds: number;
  wavPath: string; // original WAV for speaker log lookup
}

export interface TranscriptionJobData {
  sessionId: string;
  guildId: string;
  filePath: string;
  filename: string;
  durationSeconds?: number;
  discordChannelId?: string;
  // Per-chunk recording (legacy/OpenAI fallback)
  chunkIndex?: number;
  isLastChunk?: boolean;
  totalChunks?: number;
  // Batch mode: all chunks in one job (for Replicate/selfhosted concat)
  batchChunks?: BatchChunkMeta[];
}
