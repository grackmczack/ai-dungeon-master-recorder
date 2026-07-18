export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  words?: TranscriptWord[];
  language: string;
  provider: string;
  speakerAttribution?: "discord-word-timestamps" | "discord-segment-overlap" | "provider";
}

export interface BatchChunkMeta {
  index?: number;
  filePath: string;
  filename: string;
  durationSeconds: number;
  wavPath: string; // original WAV for speaker log lookup
}

export interface TranscriptionJobData {
  sessionId: string;
  guildId: string;
  campaignId?: string;
  bindingId?: string;
  voiceChannelId?: string;
  summaryChannelId?: string;
  filePath: string;
  filename: string;
  durationSeconds?: number;
  discordChannelId?: string;
  // Manuelle Neuverarbeitung: vorhandenes Transkript direkt zusammenfassen.
  summaryOnly?: boolean;
  skipNotification?: boolean;
  // Per-chunk recording (legacy/OpenAI fallback)
  chunkIndex?: number;
  isLastChunk?: boolean;
  totalChunks?: number;
  // Batch mode: bounded audio chunks processed sequentially in one queue job.
  batchChunks?: BatchChunkMeta[];
}
